"use client"

import { useState } from "react"
import { useElements, useStripe } from "@stripe/react-stripe-js"
import { Button, Text } from "@medusajs/ui"
import { HttpTypes } from "@medusajs/types"

import ErrorMessage from "@modules/checkout/components/error-message"
import { placeOrder } from "@lib/data/cart"
import { isStripe, isManual, isPaypal } from "@lib/constants"

interface DigitalReviewProps {
  cart: HttpTypes.StoreCart
}

export default function DigitalReview({ cart }: DigitalReviewProps) {
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const stripe = useStripe()
  const elements = useElements()
  const card = elements?.getElement("card")

  const paymentSession = cart.payment_collection?.payment_sessions?.find(
    (s: any) => s.status === "pending"
  )

  const onPaymentCompleted = async () => {
    await placeOrder()
      .catch((err) => {
        setErrorMessage(err.message)
      })
      .finally(() => {
        setSubmitting(false)
      })
  }

  const handleStripePayment = async () => {
    setSubmitting(true)
    setErrorMessage(null)

    if (!stripe || !elements || !card || !cart) {
      setSubmitting(false)
      return
    }

    await stripe
      .confirmCardPayment(paymentSession?.data?.client_secret as string, {
        payment_method: {
          card: card,
          billing_details: {
            name:
              cart.billing_address?.first_name +
              " " +
              cart.billing_address?.last_name,
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
      })
      .then(({ error, paymentIntent }) => {
        if (error) {
          const pi = error.payment_intent

          if (
            (pi && pi.status === "requires_capture") ||
            (pi && pi.status === "succeeded")
          ) {
            onPaymentCompleted()
          }

          setErrorMessage(error.message || null)
          return
        }

        if (
          (paymentIntent && paymentIntent.status === "requires_capture") ||
          paymentIntent?.status === "succeeded"
        ) {
          return onPaymentCompleted()
        }

        return
      })
  }

  const handleManualPayment = async () => {
    setSubmitting(true)
    setErrorMessage(null)
    await onPaymentCompleted()
  }

  const handlePlaceOrder = () => {
    if (isStripe(paymentSession?.provider_id)) {
      handleStripePayment()
    } else if (isManual(paymentSession?.provider_id)) {
      handleManualPayment()
    } else {
      // Default to manual for unknown providers
      handleManualPayment()
    }
  }

  return (
    <div className="space-y-4">
      <div className="bg-ui-bg-subtle rounded-lg p-4">
        <Text className="text-sm text-ui-fg-base">
          By clicking &quot;Place Order&quot;, you confirm that you have read, 
          understand and accept our Terms of Use, Terms of Sale and Returns Policy.
        </Text>
      </div>

      <div className="space-y-2">
        <Text className="text-sm text-ui-fg-muted">
          ✓ Your information has been saved
        </Text>
        <Text className="text-sm text-ui-fg-muted">
          ✓ Payment method selected
        </Text>
        <Text className="text-sm text-ui-fg-muted">
          ✓ Digital delivery - instant access after payment
        </Text>
      </div>

      <ErrorMessage error={errorMessage} />

      <Button
        size="large"
        className="w-full"
        onClick={handlePlaceOrder}
        isLoading={submitting}
        disabled={submitting}
      >
        Place Order
      </Button>

      <Text className="text-xs text-center text-ui-fg-muted">
        You will receive an email confirmation with access details
      </Text>
    </div>
  )
}
