"use client"

import { useCallback, useContext, useEffect, useMemo, useState } from "react"
import { RadioGroup } from "@headlessui/react"
import { Button, Text, clx } from "@medusajs/ui"
import { CardElement } from "@stripe/react-stripe-js"
import { StripeCardElementOptions } from "@stripe/stripe-js"

import ErrorMessage from "@modules/checkout/components/error-message"
import PaymentContainer from "@modules/checkout/components/payment-container"
import { StripeContext } from "@modules/checkout/components/payment-wrapper"
import { initiatePaymentSession } from "@lib/data/cart"
import { isStripe as isStripeFunc, paymentInfoMap } from "@lib/constants"
import { HttpTypes } from "@medusajs/types"

interface DigitalPaymentProps {
  cart: HttpTypes.StoreCart
  availablePaymentMethods: any[]
  onComplete: () => void
}

export default function DigitalPayment({
  cart,
  availablePaymentMethods,
  onComplete,
}: DigitalPaymentProps) {
  const activeSession = cart.payment_collection?.payment_sessions?.find(
    (paymentSession: any) => paymentSession.status === "pending"
  )

  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cardBrand, setCardBrand] = useState<string | null>(null)
  const [cardComplete, setCardComplete] = useState(false)
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState(
    activeSession?.provider_id ?? ""
  )

  const isStripe = isStripeFunc(activeSession?.provider_id)
  const stripeReady = useContext(StripeContext)

  const paidByGiftcard =
    (cart as any)?.gift_cards && (cart as any)?.gift_cards?.length > 0 && cart?.total === 0

  const useOptions: StripeCardElementOptions = useMemo(() => {
    return {
      style: {
        base: {
          fontFamily: "Inter, sans-serif",
          color: "#424270",
          "::placeholder": {
            color: "rgb(107 114 128)",
          },
        },
      },
      classes: {
        base: "pt-3 pb-1 block w-full h-11 px-4 mt-0 bg-ui-bg-field border rounded-md appearance-none focus:outline-none focus:ring-0 focus:shadow-borders-interactive-with-active border-ui-border-base hover:bg-ui-bg-field-hover transition-all duration-300 ease-in-out",
      },
    }
  }, [])

  const handleSubmit = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const shouldInputCard =
        isStripeFunc(selectedPaymentMethod) && !activeSession

      if (!activeSession) {
        await initiatePaymentSession(cart, {
          provider_id: selectedPaymentMethod,
        })
      }

      if (!shouldInputCard) {
        onComplete()
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    setError(null)
  }, [selectedPaymentMethod])

  return (
    <div className="space-y-4">
      {!paidByGiftcard && availablePaymentMethods?.length > 0 && (
        <>
          <RadioGroup
            value={selectedPaymentMethod}
            onChange={(value: string) => setSelectedPaymentMethod(value)}
          >
            {availablePaymentMethods
              .sort((a, b) => {
                return a.provider_id > b.provider_id ? 1 : -1
              })
              .map((paymentMethod) => {
                return (
                  <PaymentContainer
                    paymentInfoMap={paymentInfoMap}
                    paymentProviderId={paymentMethod.id}
                    key={paymentMethod.id}
                    selectedPaymentOptionId={selectedPaymentMethod}
                  />
                )
              })}
          </RadioGroup>

          {isStripe && stripeReady && (
            <div className="mt-4 transition-all duration-150 ease-in-out">
              <Text className="txt-medium-plus text-ui-fg-base mb-2">
                Enter your card details:
              </Text>
              <CardElement
                options={useOptions as StripeCardElementOptions}
                onChange={(e) => {
                  setCardBrand(
                    e.brand &&
                      e.brand.charAt(0).toUpperCase() + e.brand.slice(1)
                  )
                  setError(e.error?.message || null)
                  setCardComplete(e.complete)
                }}
              />
            </div>
          )}
        </>
      )}

      {paidByGiftcard && (
        <div className="p-4 bg-ui-bg-subtle rounded-lg">
          <Text className="txt-medium text-ui-fg-base">
            Your order will be paid with gift card
          </Text>
        </div>
      )}

      {availablePaymentMethods?.length === 0 && !paidByGiftcard && (
        <div className="p-4 bg-ui-bg-subtle rounded-lg">
          <Text className="txt-medium text-ui-fg-muted">
            No payment methods available. Please contact support.
          </Text>
        </div>
      )}

      <ErrorMessage error={error} />

      <Button
        size="large"
        className="w-full"
        onClick={handleSubmit}
        isLoading={isLoading}
        disabled={
          (isStripe && !cardComplete) ||
          (!selectedPaymentMethod && !paidByGiftcard)
        }
      >
        {!activeSession && isStripeFunc(selectedPaymentMethod)
          ? "Enter card details"
          : "Continue to Review"}
      </Button>
    </div>
  )
}
