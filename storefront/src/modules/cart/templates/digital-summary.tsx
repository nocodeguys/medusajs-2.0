"use client"

import { Button, Heading, Text } from "@medusajs/ui"

import CartTotals from "@modules/common/components/cart-totals"
import Divider from "@modules/common/components/divider"
import DiscountCode from "@modules/checkout/components/discount-code"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { HttpTypes } from "@medusajs/types"

type DigitalSummaryProps = {
  cart: HttpTypes.StoreCart & {
    promotions: HttpTypes.StorePromotion[]
  }
  isDigitalEligible: boolean
  totalAccessDays: number
}

function getCheckoutStep(cart: HttpTypes.StoreCart) {
  if (!cart?.shipping_address?.address_1 || !cart.email) {
    return "address"
  } else if (cart?.shipping_methods?.length === 0) {
    return "delivery"
  } else {
    return "payment"
  }
}

const DigitalSummary = ({ cart, isDigitalEligible, totalAccessDays }: DigitalSummaryProps) => {
  const step = getCheckoutStep(cart)

  return (
    <div className="flex flex-col gap-y-4">
      <Heading level="h2" className="text-[2rem] leading-[2.75rem]">
        Summary
      </Heading>
      
      {/* Digital product indicator */}
      {isDigitalEligible && totalAccessDays > 0 && (
        <div className="bg-ui-bg-subtle rounded-lg p-3">
          <Text className="text-sm font-medium text-ui-fg-base">
            🎫 Digital Product
          </Text>
          <Text className="text-xs text-ui-fg-muted">
            {totalAccessDays} days of access included
          </Text>
        </div>
      )}
      
      <DiscountCode cart={cart} />
      <Divider />
      <CartTotals totals={cart} />
      
      {isDigitalEligible ? (
        <div className="space-y-2">
          <LocalizedClientLink
            href="/checkout/digital"
            data-testid="digital-checkout-button"
          >
            <Button className="w-full h-10">
              Quick Digital Checkout
            </Button>
          </LocalizedClientLink>
          <Text className="text-xs text-center text-ui-fg-muted">
            No shipping required • Instant access
          </Text>
          
          {/* Alternative regular checkout */}
          <LocalizedClientLink
            href={"/checkout?step=" + step}
            data-testid="regular-checkout-button"
            className="block"
          >
            <Button variant="secondary" className="w-full h-10">
              Standard Checkout
            </Button>
          </LocalizedClientLink>
        </div>
      ) : (
        <LocalizedClientLink
          href={"/checkout?step=" + step}
          data-testid="checkout-button"
        >
          <Button className="w-full h-10">Go to checkout</Button>
        </LocalizedClientLink>
      )}
    </div>
  )
}

export default DigitalSummary
