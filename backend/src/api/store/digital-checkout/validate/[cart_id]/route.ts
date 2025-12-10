import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import type { 
  ICartModuleService, 
  IProductModuleService
} from "@medusajs/framework/types"

interface ValidateResponse {
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

/**
 * GET /store/digital-checkout/validate/:cart_id
 * 
 * Validates if a cart is eligible for digital-only checkout
 */
export async function GET(
  req: MedusaRequest,
  res: MedusaResponse<ValidateResponse>
): Promise<void> {
  const cartModuleService: ICartModuleService = req.scope.resolve(Modules.CART)
  const productModuleService: IProductModuleService = req.scope.resolve(Modules.PRODUCT)

  const cartId = req.params.cart_id

  if (!cartId) {
    res.status(400).json({
      is_digital_eligible: false,
      cart_id: "",
      items: [],
      total_access_days: 0,
      message: "cart_id is required"
    })
    return
  }

  try {
    const cart = await cartModuleService.retrieveCart(cartId, {
      relations: ["items"]
    })

    if (!cart) {
      res.status(404).json({
        is_digital_eligible: false,
        cart_id: cartId,
        items: [],
        total_access_days: 0,
        message: "Cart not found"
      })
      return
    }

    // Check all items for digital flag
    let allDigital = true
    const items: ValidateResponse["items"] = []

    for (const item of cart.items || []) {
      let isDigital = false
      let accessDays = 0

      if (item.variant_id) {
        try {
          const variant = await productModuleService.retrieveProductVariant(item.variant_id)
          isDigital = !!variant.metadata?.is_digital
          accessDays = Number(variant.metadata?.access_days) || 0
        } catch (e) {
          // Variant not found, treat as non-digital
          isDigital = false
        }
      }

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

    res.json({
      is_digital_eligible: allDigital,
      cart_id: cartId,
      items,
      total_access_days: items.reduce((sum, item) => sum + (item.access_days * item.quantity), 0)
    })
  } catch (error: any) {
    res.status(500).json({
      is_digital_eligible: false,
      cart_id: cartId,
      items: [],
      total_access_days: 0,
      message: error.message || "Internal server error"
    })
  }
}
