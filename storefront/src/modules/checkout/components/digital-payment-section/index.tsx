"use client"

import { useCallback, useContext, useEffect, useMemo, useState } from "react"
import { RadioGroup } from "@headlessui/react"
import { Button, Text, clx } from "@medusajs/ui"
import { CardElement } from "@stripe/react-stripe-js"
import { StripeCardElementOptions } from "@stripe/stripe-js"
import { useElements, useStripe } from "@stripe/react-stripe-js"

import ErrorMessage from "@modules/checkout/components/error-message"
import PaymentContainer from "@modules/checkout/components/payment-container"
import { StripeContext } from "@modules/checkout/components/payment-wrapper"
import { initiatePaymentSession, placeOrder } from "@lib/data/cart"
import { isStripe as isStripeFunc, isManual, paymentInfoMap } from "@lib/constants"
import { HttpTypes } from "@medusajs/types"

interface DigitalPaymentSectionProps {
  cart: HttpTypes.StoreCart
  availablePaymentMethods: any[]
}

export default function DigitalPaymentSection({
  cart,
  availablePaymentMethods,
}: DigitalPaymentSectionProps) {
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
  const stripe = useStripe()
  const elements = useElements()
  const card = elements?.getElement("card")

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

  // Initialize payment session when payment method is selected
  const handleSelectPaymentMethod = async (providerId: string) => {
    setSelectedPaymentMethod(providerId)
    setError(null)
    
    // Only initialize if no active session or different provider
    if (!activeSession || activeSession.provider_id !== providerId) {
      setIsLoading(true)
      try {
        await initiatePaymentSession(cart, {
          provider_id: providerId,
        })
      } catch (err: any) {
        setError(err.message || "Failed to initialize payment")
      } finally {
        setIsLoading(false)
      }
    }
  }

  // Handle placing the order
  const handlePlaceOrder = async () => {
    setIsLoading(true)
    setError(null)

    try {
      // For Stripe, confirm the card payment first
      if (isStripe && stripe && card && activeSession) {
        const { error: stripeError, paymentIntent } = await stripe.confirmCardPayment(
          activeSession.data.client_secret as string,
          {
            payment_method: {
              card: card,
              billing_details: {
                name: `${cart.billing_address?.first_name} ${cart.billing_address?.last_name}`,
                address: {
                  city: cart.billing_address?.city ?? undefined,
                  country: cart.billing_address?.country_code ?? undefined,
                  line1: cart.billing_address?.address_1 ?? undefined,
                  line2: cart.billing_address?.address_2 ?? undefined,
                  postal_code: cart.billing_address?.postal_code ?? undefined,
                  state: cart.billing_address?.province ?? undefined,
                },
                email: cart.email,
                phone: cart.billing_address?.phone ?? undefined,
              },
            },
          }
        )

        if (stripeError) {
          // Check if payment actually succeeded despite error
          if (
            stripeError.payment_intent?.status === "requires_capture" ||
            stripeError.payment_intent?.status === "succeeded"
          ) {
            await placeOrder()
            return
          }
          setError(stripeError.message || "Payment failed")
          setIsLoading(false)
          return
        }

        if (
          paymentIntent?.status === "requires_capture" ||
          paymentIntent?.status === "succeeded"
        ) {
          await placeOrder()
          return
        }
      } else {
        // For manual/other payment methods
        await placeOrder()
      }
    } catch (err: any) {
      setError(err.message || "Failed to place order")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    setError(null)
  }, [selectedPaymentMethod])

  // Auto-select first payment method if none selected
  useEffect(() => {
    if (!selectedPaymentMethod && availablePaymentMethods?.length > 0) {
      handleSelectPaymentMethod(availablePaymentMethods[0].id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availablePaymentMethods])

  const notReady =
    !cart ||
    !cart.shipping_address ||
    !cart.billing_address ||
    !cart.email ||
    (cart.shipping_methods?.length ?? 0) < 1

  const canPlaceOrder = 
    activeSession && 
    !notReady && 
    (isStripe ? cardComplete : true)

  return (
    <div className="space-y-4">
      {!paidByGiftcard && availablePaymentMethods?.length > 0 && (
        <>
          <RadioGroup
            value={selectedPaymentMethod}
            onChange={handleSelectPaymentMethod}
          >
            {availablePaymentMethods
              .sort((a, b) => (a.provider_id > b.provider_id ? 1 : -1))
              .map((paymentMethod) => (
                <PaymentContainer
                  paymentInfoMap={paymentInfoMap}
                  paymentProviderId={paymentMethod.id}
                  key={paymentMethod.id}
                  selectedPaymentOptionId={selectedPaymentMethod}
                />
              ))}
          </RadioGroup>

          {isStripe && stripeReady && (
            <div className="mt-5 transition-all duration-150 ease-in-out">
              <Text className="txt-medium-plus text-ui-fg-base mb-1">
                Enter your card details:
              </Text>
              <CardElement
                options={useOptions as StripeCardElementOptions}
                onChange={(e) => {
                  setCardBrand(
                    e.brand && e.brand.charAt(0).toUpperCase() + e.brand.slice(1)
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

      <ErrorMessage error={error} data-testid="digital-payment-error" />

      <Text className="text-ui-fg-subtle text-sm">
        By completing this purchase, you agree to our Terms of Service.
      </Text>

      <Button
        size="large"
        className="w-full"
        onClick={handlePlaceOrder}
        isLoading={isLoading}
        disabled={!canPlaceOrder}
        data-testid="digital-place-order-button"
      >
        Place Order
      </Button>

      {!activeSession && selectedPaymentMethod && (
        <Text className="text-ui-fg-muted text-sm text-center">
          Initializing payment...
        </Text>
      )}
    </div>
  )
}
