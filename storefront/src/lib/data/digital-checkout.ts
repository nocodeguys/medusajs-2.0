"use server"

import { sdk } from "@lib/config"
import medusaError from "@lib/util/medusa-error"
import { revalidateTag } from "next/cache"
import { redirect } from "next/navigation"
import { getAuthHeaders, getCartId, removeCartId, setCartId } from "./cookies"
import { retrieveCart, updateCart, initiatePaymentSession } from "./cart"
import { HttpTypes } from "@medusajs/types"

const BACKEND_URL = process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL || "http://localhost:9000"

interface DigitalCheckoutValidation {
  is_digital_eligible: boolean
  cart_id: string
  items: Array<{
    id: string
    title: string
    quantity: number
    is_digital: boolean
    access_days: number
  }>
  total_access_days: number
  message?: string
}

interface DigitalCheckoutInput {
  email: string
  first_name: string
  last_name: string
  company_name?: string
  vat_number?: string
  country_code: string
}

/**
 * Validates if the current cart is eligible for digital-only checkout
 * Uses the cart data directly instead of a custom API endpoint
 */
export async function validateDigitalCheckout(): Promise<DigitalCheckoutValidation> {
  const cartId = await getCartId()
  
  console.log("[Digital Checkout] Validating cart:", cartId)
  
  if (!cartId) {
    console.log("[Digital Checkout] No cart found")
    return {
      is_digital_eligible: false,
      cart_id: "",
      items: [],
      total_access_days: 0,
      message: "No cart found"
    }
  }

  try {
    // Get the cart
    const cart = await retrieveCart()
    
    if (!cart || !cart.items?.length) {
      console.log("[Digital Checkout] Cart empty or not found")
      return {
        is_digital_eligible: false,
        cart_id: cartId,
        items: [],
        total_access_days: 0,
        message: "Cart is empty"
      }
    }

    // Enrich items with variant data (includes metadata)
    const { enrichLineItems } = await import("./cart")
    const enrichedItems = await enrichLineItems(cart.items, cart.region_id!)
    
    console.log("[Digital Checkout] Cart items:", enrichedItems.length)

    // Check each item for digital flag in variant metadata
    const items: DigitalCheckoutValidation["items"] = []
    let allDigital = true

    for (const item of enrichedItems) {
      // Check variant metadata for is_digital flag
      const variant = (item as any).variant
      const isDigital = variant?.metadata?.is_digital === true || 
                        variant?.metadata?.is_digital === "true"
      const accessDays = Number(variant?.metadata?.access_days) || 0

      console.log("[Digital Checkout] Item:", item.title, "isDigital:", isDigital, "accessDays:", accessDays)

      items.push({
        id: item.id,
        title: item.title || "Unknown",
        quantity: Number(item.quantity),
        is_digital: isDigital,
        access_days: accessDays
      })

      if (!isDigital) {
        allDigital = false
      }
    }

    const totalAccessDays = items.reduce(
      (sum, item) => sum + (item.access_days * item.quantity), 
      0
    )

    console.log("[Digital Checkout] Result - allDigital:", allDigital, "totalAccessDays:", totalAccessDays)

    return {
      is_digital_eligible: allDigital,
      cart_id: cartId,
      items,
      total_access_days: totalAccessDays
    }
  } catch (error: any) {
    console.log("[Digital Checkout] Error:", error.message)
    return {
      is_digital_eligible: false,
      cart_id: cartId,
      items: [],
      total_access_days: 0,
      message: error.message || "Validation error"
    }
  }
}

/**
 * Prepares cart for digital checkout - sets billing info without shipping
 */
export async function prepareDigitalCheckout(input: DigitalCheckoutInput) {
  const cartId = await getCartId()
  
  if (!cartId) {
    throw new Error("No cart found")
  }

  try {
    const publishableKey = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY
    const authHeaders = await getAuthHeaders()
    const response = await fetch(
      `${BACKEND_URL}/store/digital-checkout`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(publishableKey && { "x-publishable-api-key": publishableKey }),
          ...authHeaders,
        },
        body: JSON.stringify({
          cart_id: cartId,
          ...input
        })
      }
    )

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || "Failed to prepare digital checkout")
    }

    revalidateTag("cart")
    return await response.json()
  } catch (error: any) {
    throw new Error(error.message || "Failed to prepare digital checkout")
  }
}

/**
 * Sets digital checkout billing address and email on cart
 * Uses the standard Medusa cart update but with minimal address
 */
export async function setDigitalCheckoutInfo(
  currentState: unknown,
  formData: FormData
) {
  try {
    const cartId = getCartId()
    if (!cartId) {
      throw new Error("No cart found")
    }

    const email = formData.get("email") as string
    const firstName = formData.get("first_name") as string
    const lastName = formData.get("last_name") as string
    const companyName = formData.get("company_name") as string
    const vatNumber = formData.get("vat_number") as string
    const countryCode = formData.get("country_code") as string

    // Validate required fields
    if (!email || !firstName || !lastName || !countryCode) {
      return { error: "Please fill in all required fields" }
    }

    // Create minimal billing address for digital products
    const billingAddress = {
      first_name: firstName,
      last_name: lastName,
      company: companyName || "",
      address_1: "Digital Delivery",
      address_2: "",
      city: "N/A",
      postal_code: "00000",
      country_code: countryCode.toLowerCase(),
      province: "",
      phone: "",
    }

    // Update cart with email and billing address
    // Set shipping_address same as billing to satisfy Medusa requirements
    await updateCart({
      email,
      billing_address: billingAddress,
      shipping_address: billingAddress,
      metadata: {
        is_digital_checkout: true,
        company_name: companyName || null,
        vat_number: vatNumber || null
      }
    })

    revalidateTag("cart")
    return { success: true }
  } catch (error: any) {
    return { error: error.message || "Failed to update checkout info" }
  }
}

/**
 * Sets shipping method for digital checkout (auto-selects free digital delivery)
 */
export async function setDigitalShippingMethod() {
  const cartId = await getCartId()
  if (!cartId) {
    throw new Error("No cart found")
  }

  try {
    // Get available shipping methods
    const cart = await retrieveCart()
    if (!cart?.region_id) {
      throw new Error("Cart has no region")
    }

    // Fetch shipping options for the cart
    const authHeaders = await getAuthHeaders()
    const { shipping_options } = await sdk.store.fulfillment.listCartOptions(
      { cart_id: cartId },
      authHeaders
    )

    // Find digital/free shipping option
    const digitalOption = shipping_options?.find(
      (opt: any) => 
        opt.name?.toLowerCase().includes("digital") ||
        opt.amount === 0
    )

    if (!digitalOption) {
      // If no digital option, use the first available (should be configured in admin)
      const firstOption = shipping_options?.[0]
      if (!firstOption) {
        throw new Error("No shipping options available")
      }
      
      await sdk.store.cart.addShippingMethod(
        cartId,
        { option_id: firstOption.id },
        {},
        authHeaders
      )
    } else {
      await sdk.store.cart.addShippingMethod(
        cartId,
        { option_id: digitalOption.id },
        {},
        authHeaders
      )
    }

    revalidateTag("cart")
    return { success: true }
  } catch (error: any) {
    throw new Error(error.message || "Failed to set shipping method")
  }
}

/**
 * Complete digital checkout flow - combines all steps
 */
export async function completeDigitalCheckout(
  currentState: unknown,
  formData: FormData
) {
  try {
    // Step 1: Set checkout info
    const infoResult = await setDigitalCheckoutInfo(currentState, formData)
    if (infoResult.error) {
      return infoResult
    }

    // Step 2: Set shipping method (auto-select digital/free)
    await setDigitalShippingMethod()

    // Step 3: Redirect to payment step
    const countryCode = formData.get("country_code") as string
    return { success: true, redirect: `/${countryCode}/checkout/digital?step=payment` }
  } catch (error: any) {
    return { error: error.message || "Checkout failed" }
  }
}

/**
 * Place order for digital checkout
 */
export async function placeDigitalOrder() {
  const cartId = await getCartId()
  if (!cartId) {
    throw new Error("No cart found")
  }

  const authHeaders = await getAuthHeaders()
  const cartRes = await sdk.store.cart
    .complete(cartId, {}, authHeaders)
    .then((res) => {
      revalidateTag("cart")
      return res
    })
    .catch(medusaError)

  if (cartRes?.type === "order") {
    const countryCode = cartRes.order.billing_address?.country_code?.toLowerCase() || "us"
    await removeCartId()
    redirect(`/${countryCode}/order/confirmed/${cartRes.order.id}`)
  }

  return cartRes.cart
}

/**
 * Initialize payment for digital checkout
 */
export async function initializeDigitalPayment(providerId: string) {
  const cart = await retrieveCart()
  if (!cart) {
    throw new Error("No cart found")
  }

  return initiatePaymentSession(cart, {
    provider_id: providerId,
  })
}
