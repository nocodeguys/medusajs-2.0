"use client"

import { HttpTypes } from "@medusajs/types"
import { Heading, Text } from "@medusajs/ui"
import { convertToLocale } from "@lib/util/money"
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

interface DigitalCheckoutSummaryProps {
  cart: HttpTypes.StoreCart
  validation: DigitalCheckoutValidation
}

export default function DigitalCheckoutSummary({
  cart,
  validation,
}: DigitalCheckoutSummaryProps) {
  const { items, currency_code, total, subtotal, tax_total, discount_total } = cart

  return (
    <div className="bg-white rounded-lg border border-ui-border-base p-6 space-y-6">
      <Heading level="h2" className="text-xl font-semibold">
        Order Summary
      </Heading>

      {/* Items */}
      <div className="space-y-4">
        {items?.map((item) => {
          const validationItem = validation.items.find(v => v.id === item.id)
          
          return (
            <div key={item.id} className="flex gap-4">
              <div className="w-16 h-16 flex-shrink-0">
                <Thumbnail
                  thumbnail={item.thumbnail}
                  images={[]}
                  size="square"
                />
              </div>
              <div className="flex-1 min-w-0">
                <Text className="font-medium truncate">{item.title}</Text>
                <Text className="text-sm text-ui-fg-muted">
                  Qty: {Number(item.quantity)}
                </Text>
                {validationItem?.access_days && validationItem.access_days > 0 && (
                  <Text className="text-sm text-ui-fg-interactive">
                    {validationItem.access_days * Number(item.quantity)} days access
                  </Text>
                )}
              </div>
              <div className="text-right">
                <Text className="font-medium">
                  {convertToLocale({
                    amount: Number(item.total) || 0,
                    currency_code: currency_code,
                  })}
                </Text>
              </div>
            </div>
          )
        })}
      </div>

      {/* Divider */}
      <div className="border-t border-ui-border-base" />

      {/* Totals */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <Text className="text-ui-fg-muted">Subtotal</Text>
          <Text>
            {convertToLocale({
              amount: Number(subtotal) || 0,
              currency_code: currency_code,
            })}
          </Text>
        </div>

        {discount_total && Number(discount_total) > 0 && (
          <div className="flex justify-between text-sm">
            <Text className="text-ui-fg-muted">Discount</Text>
            <Text className="text-ui-fg-interactive">
              -{convertToLocale({
                amount: Number(discount_total),
                currency_code: currency_code,
              })}
            </Text>
          </div>
        )}

        <div className="flex justify-between text-sm">
          <Text className="text-ui-fg-muted">Shipping</Text>
          <Text className="text-ui-fg-interactive">Free (Digital)</Text>
        </div>

        {tax_total && Number(tax_total) > 0 && (
          <div className="flex justify-between text-sm">
            <Text className="text-ui-fg-muted">Tax</Text>
            <Text>
              {convertToLocale({
                amount: Number(tax_total),
                currency_code: currency_code,
              })}
            </Text>
          </div>
        )}

        <div className="border-t border-ui-border-base pt-2 mt-2">
          <div className="flex justify-between">
            <Text className="font-semibold">Total</Text>
            <Text className="font-semibold text-lg">
              {convertToLocale({
                amount: Number(total) || 0,
                currency_code: currency_code,
              })}
            </Text>
          </div>
        </div>
      </div>

      {/* Access Summary */}
      {validation.total_access_days > 0 && (
        <div className="bg-ui-bg-subtle rounded-lg p-4">
          <Text className="text-sm font-medium text-ui-fg-base mb-1">
            What you&apos;ll get:
          </Text>
          <Text className="text-sm text-ui-fg-subtle">
            {validation.total_access_days} days of full community access, 
            starting immediately after purchase.
          </Text>
        </div>
      )}

      {/* Digital Product Notice */}
      <div className="text-xs text-ui-fg-muted">
        <Text>
          This is a digital product. No physical shipping required. 
          Access will be granted instantly after payment.
        </Text>
      </div>
    </div>
  )
}
