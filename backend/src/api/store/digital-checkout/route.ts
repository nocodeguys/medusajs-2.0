import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import type { 
  ICartModuleService, 
  ICustomerModuleService,
  IPaymentModuleService,
  IProductModuleService,
  IFulfillmentModuleService
} from "@medusajs/framework/types"

interface DigitalCheckoutInput {
  cart_id: string
  email: string
  first_name: string
  last_name: string
  company_name?: string
  vat_number?: string
  country_code: string
}

interface DigitalCheckoutResponse {
  success: boolean
  cart_id: string
  requires_shipping: boolean
  message: string
}

/**
 * POST /store/digital-checkout
 * 
 * Prepares a cart for digital-only checkout:
 * - Sets email and billing address (minimal)
 * - Auto-selects free digital shipping if available
 * - Skips shipping address requirement
 */
export async function POST(
  req: MedusaRequest<DigitalCheckoutInput>,
  res: MedusaResponse<DigitalCheckoutResponse>
): Promise<void> {
  const cartModuleService: ICartModuleService = req.scope.resolve(Modules.CART)
  const productModuleService: IProductModuleService = req.scope.resolve(Modules.PRODUCT)
  const fulfillmentModuleService: IFulfillmentModuleService = req.scope.resolve(Modules.FULFILLMENT)

  const { 
    cart_id, 
    email, 
    first_name, 
    last_name, 
    company_name, 
    vat_number,
    country_code 
  } = req.body

  // Retrieve cart with items
  const cart = await cartModuleService.retrieveCart(cart_id, {
    relations: ["items"]
  })

  if (!cart) {
    res.status(404).json({
      success: false,
      cart_id,
      requires_shipping: false,
      message: "Cart not found"
    })
    return
  }

  // Check if all items are digital
  let allDigital = true
  for (const item of cart.items || []) {
    if (item.variant_id) {
      const variant = await productModuleService.retrieveProductVariant(item.variant_id)
      if (!variant.metadata?.is_digital) {
        allDigital = false
        break
      }
    }
  }

  if (!allDigital) {
    res.status(400).json({
      success: false,
      cart_id,
      requires_shipping: true,
      message: "Cart contains physical products that require shipping"
    })
    return
  }

  // Create minimal billing address for digital checkout
  const billingAddress = {
    first_name,
    last_name,
    company: company_name || "",
    address_1: "Digital Delivery", // Placeholder for digital products
    city: "N/A",
    postal_code: "00000",
    country_code: country_code.toLowerCase(),
    phone: "",
    metadata: {
      is_digital_checkout: true,
      vat_number: vat_number || null
    }
  }

  // Update cart with email and billing address
  // For digital products, we set shipping_address same as billing to satisfy Medusa requirements
  await cartModuleService.updateCarts(cart_id, {
    email,
    billing_address: billingAddress,
    shipping_address: billingAddress, // Required by Medusa, but won't be used for digital
    metadata: {
      ...cart.metadata,
      is_digital_checkout: true,
      company_name: company_name || null,
      vat_number: vat_number || null
    }
  })

  // Try to auto-select free digital shipping option
  try {
    const shippingOptions = await fulfillmentModuleService.listShippingOptions({
      // Look for digital/free shipping options
    })
    
    const digitalShippingOption = shippingOptions.find(
      opt => opt.name?.toLowerCase().includes("digital") || 
             opt.price_type === "flat"
    )

    if (digitalShippingOption) {
      // Note: Shipping method will be added via the standard cart API
      // This just identifies the option to use
      await cartModuleService.updateCarts(cart_id, {
        metadata: {
          ...cart.metadata,
          is_digital_checkout: true,
          suggested_shipping_option_id: digitalShippingOption.id
        }
      })
    }
  } catch (error) {
    console.log("Could not auto-select shipping option:", error)
  }

  res.json({
    success: true,
    cart_id,
    requires_shipping: false,
    message: "Cart prepared for digital checkout"
  })
}

