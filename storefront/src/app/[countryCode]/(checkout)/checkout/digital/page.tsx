import { Metadata } from "next"
import { notFound, redirect } from "next/navigation"

import { enrichLineItems, retrieveCart } from "@lib/data/cart"
import { validateDigitalCheckout } from "@lib/data/digital-checkout"
import { listCartPaymentMethods } from "@lib/data/payment"
import { getCustomer } from "@lib/data/customer"
import { HttpTypes } from "@medusajs/types"
import DigitalCheckoutTemplate from "@modules/checkout/templates/digital-checkout"
import Wrapper from "@modules/checkout/components/payment-wrapper"

export const metadata: Metadata = {
  title: "Digital Checkout",
  description: "Complete your digital product purchase",
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

export default async function DigitalCheckout({
  params,
}: {
  params: Promise<{ countryCode: string }>
}) {
  const { countryCode } = await params
  const cart = await fetchCart()
  
  if (!cart) {
    return notFound()
  }

  // Validate cart is digital-eligible
  const validation = await validateDigitalCheckout()
  
  if (!validation.is_digital_eligible) {
    // Redirect to regular checkout if cart has physical products
    redirect(`/${countryCode}/checkout`)
  }

  const customer = await getCustomer()
  const paymentMethods = await listCartPaymentMethods(cart.region?.id ?? "")

  return (
    <Wrapper cart={cart}>
      <DigitalCheckoutTemplate 
        cart={cart} 
        customer={customer}
        paymentMethods={paymentMethods || []}
        validation={validation}
        countryCode={countryCode}
      />
    </Wrapper>
  )
}
