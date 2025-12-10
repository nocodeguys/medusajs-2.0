"use client"

import { HttpTypes } from "@medusajs/types"
import { Heading, Text } from "@medusajs/ui"

import { convertToLocale } from "@lib/util/money"
import Divider from "@modules/common/components/divider"
import DigitalCheckoutForm from "@modules/checkout/components/digital-checkout-form"
import PaymentButton from "@modules/checkout/components/payment-button"
import Thumbnail from "@modules/products/components/thumbnail"

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
}

interface DigitalCheckoutTemplateProps {
  cart: HttpTypes.StoreCart
  customer: HttpTypes.StoreCustomer | null
  paymentMethods: any[]
  validation: DigitalCheckoutValidation
  countryCode: string
}

export default function DigitalCheckoutTemplate({
  cart,
  customer,
  paymentMethods,
  validation,
  countryCode,
}: DigitalCheckoutTemplateProps) {
  const { currency_code } = cart

  const isInfoComplete = !!(
    cart.email &&
    cart.billing_address?.first_name &&
    cart.shipping_methods?.length
  )

  return (
    <div className="py-12">
      <div className="content-container" data-testid="digital-checkout-container">
        <div className="grid grid-cols-1 small:grid-cols-[1fr_416px] gap-x-40">
          {/* Left Column - Form */}
          <div className="flex flex-col gap-y-8">
            <div>
              <Heading level="h1" className="text-3xl-regular mb-2">Digital Checkout</Heading>
              <Text className="text-ui-fg-base">Complete your purchase for instant access</Text>
            </div>

            <div className="bg-white">
              <Heading level="h2" className="text-3xl-regular mb-6">Your Information</Heading>
              <DigitalCheckoutForm cart={cart} customer={customer} countryCode={countryCode} />
            </div>

            <Divider />

            {isInfoComplete && (
              <div className="bg-white">
                <Heading level="h2" className="text-3xl-regular mb-6">Complete Purchase</Heading>
                {paymentMethods?.length === 0 ? (
                  <Text className="text-ui-fg-muted">No payment methods available.</Text>
                ) : (
                  <div className="space-y-4">
                    <Text className="text-ui-fg-subtle text-sm">
                      By completing this purchase, you agree to our Terms of Service.
                    </Text>
                    <PaymentButton cart={cart} data-testid="submit-order-button" />
                  </div>
                )}
              </div>
            )}

            {!isInfoComplete && (
              <div className="bg-white">
                <Heading level="h2" className="text-3xl-regular mb-6 text-ui-fg-muted">Complete Purchase</Heading>
                <Text className="text-ui-fg-muted">Please fill in your information above to continue.</Text>
              </div>
            )}
          </div>

          {/* Right Column - Order Summary */}
          <div className="relative">
            <div className="flex flex-col gap-y-8 sticky top-12">
              <div className="bg-white py-6">
                <Heading level="h2" className="text-3xl-regular mb-6">Order Summary</Heading>

                <div className="flex flex-col gap-y-4 mb-6">
                  {cart.items?.map((item) => {
                    const validationItem = validation.items.find(v => v.id === item.id)
                    return (
                      <div key={item.id} className="flex gap-x-4">
                        <div className="w-20 h-20">
                          <Thumbnail thumbnail={item.thumbnail} images={[]} size="square" />
                        </div>
                        <div className="flex flex-col justify-between flex-1">
                          <div>
                            <Text className="txt-medium-plus text-ui-fg-base">{item.title}</Text>
                            <Text className="text-ui-fg-subtle text-sm">Qty: {Number(item.quantity)}</Text>
                            {validationItem?.access_days && validationItem.access_days > 0 && (
                              <Text className="text-ui-fg-interactive text-sm">
                                {validationItem.access_days * Number(item.quantity)} days access
                              </Text>
                            )}
                          </div>
                          <Text className="txt-medium text-ui-fg-base">
                            {convertToLocale({ amount: Number(item.total) || 0, currency_code })}
                          </Text>
                        </div>
                      </div>
                    )
                  })}
                </div>

                <Divider />

                <div className="flex flex-col gap-y-2 mt-6">
                  <div className="flex justify-between text-ui-fg-base">
                    <Text>Subtotal</Text>
                    <Text>{convertToLocale({ amount: Number(cart.subtotal) || 0, currency_code })}</Text>
                  </div>
                  <div className="flex justify-between text-ui-fg-base">
                    <Text>Shipping</Text>
                    <Text className="text-ui-fg-interactive">Free (Digital)</Text>
                  </div>
                  {cart.tax_total && Number(cart.tax_total) > 0 && (
                    <div className="flex justify-between text-ui-fg-base">
                      <Text>Tax</Text>
                      <Text>{convertToLocale({ amount: Number(cart.tax_total), currency_code })}</Text>
                    </div>
                  )}
                  <Divider className="my-2" />
                  <div className="flex justify-between text-ui-fg-base txt-medium-plus">
                    <Text>Total</Text>
                    <Text>{convertToLocale({ amount: Number(cart.total) || 0, currency_code })}</Text>
                  </div>
                </div>

                {validation.total_access_days > 0 && (
                  <div className="mt-6 bg-ui-bg-subtle rounded-lg p-4">
                    <Text className="txt-medium text-ui-fg-base mb-1">What you will get:</Text>
                    <Text className="text-sm text-ui-fg-subtle">
                      {validation.total_access_days} days of full community access, starting immediately after purchase.
                    </Text>
                  </div>
                )}

                <div className="mt-4 text-xs text-ui-fg-muted">
                  <Text>This is a digital product. No physical shipping required. Access will be granted instantly after payment.</Text>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
