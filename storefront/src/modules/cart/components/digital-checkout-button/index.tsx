"use client"

import { useState, useEffect } from "react"
import { Button, Text } from "@medusajs/ui"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { HttpTypes } from "@medusajs/types"

interface DigitalCheckoutButtonProps {
  cart: HttpTypes.StoreCart
  isDigital: boolean
  regularCheckoutStep: string
}

/**
 * Smart checkout button that routes to digital checkout for digital-only carts
 */
export default function DigitalCheckoutButton({
  cart,
  isDigital,
  regularCheckoutStep,
}: DigitalCheckoutButtonProps) {
  if (isDigital) {
    return (
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
          Streamlined checkout for digital products
        </Text>
      </div>
    )
  }

  return (
    <LocalizedClientLink
      href={"/checkout?step=" + regularCheckoutStep}
      data-testid="checkout-button"
    >
      <Button className="w-full h-10">Go to checkout</Button>
    </LocalizedClientLink>
  )
}
