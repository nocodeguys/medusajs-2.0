import { Metadata } from "next"
import CartTemplate from "@modules/cart/templates"

import { enrichLineItems, retrieveCart } from "@lib/data/cart"
import { validateDigitalCheckout } from "@lib/data/digital-checkout"
import { HttpTypes } from "@medusajs/types"
import { getCustomer } from "@lib/data/customer"

export const metadata: Metadata = {
  title: "Cart",
  description: "View your cart",
}

const fetchCart = async () => {
  const cart = await retrieveCart()

  if (!cart) {
    return null
  }

  if (cart?.items?.length) {
    const enrichedItems = await enrichLineItems(cart?.items, cart?.region_id!)
    cart.items = enrichedItems as HttpTypes.StoreCartLineItem[]
  }

  return cart
}

export default async function Cart() {
  const cart = await fetchCart()
  const customer = await getCustomer()
  
  // Check if cart is eligible for digital checkout
  let digitalValidation = { is_digital_eligible: false, total_access_days: 0 }
  
  if (cart?.items?.length) {
    try {
      digitalValidation = await validateDigitalCheckout()
      console.log("[Cart Page] Digital validation result:", JSON.stringify(digitalValidation, null, 2))
    } catch (error) {
      console.error("[Cart Page] Digital validation error:", error)
    }
  }

  return (
    <CartTemplate 
      cart={cart} 
      customer={customer}
      isDigitalEligible={digitalValidation.is_digital_eligible}
      totalAccessDays={digitalValidation.total_access_days}
    />
  )
}
