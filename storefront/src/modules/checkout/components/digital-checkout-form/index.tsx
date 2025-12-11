"use client"

import { useActionState } from "react"
import { HttpTypes } from "@medusajs/types"
import { Text } from "@medusajs/ui"

import { setDigitalCheckoutInfo } from "@lib/data/digital-checkout"
import Input from "@modules/common/components/input"
import CountrySelect from "@modules/checkout/components/country-select"
import ErrorMessage from "@modules/checkout/components/error-message"
import { SubmitButton } from "@modules/checkout/components/submit-button"

interface DigitalCheckoutFormProps {
  cart: HttpTypes.StoreCart
  customer: HttpTypes.StoreCustomer | null
  countryCode: string
}

export default function DigitalCheckoutForm({
  cart,
  customer,
  countryCode,
}: DigitalCheckoutFormProps) {
  const [message, formAction] = useActionState(setDigitalCheckoutInfo, null)

  const defaultEmail = cart.email || customer?.email || ""
  const defaultFirstName = cart.billing_address?.first_name || customer?.first_name || ""
  const defaultLastName = cart.billing_address?.last_name || customer?.last_name || ""
  const defaultCompany = cart.billing_address?.company || ""
  const defaultVat = (cart.metadata?.vat_number as string) || ""
  const defaultCountry = cart.billing_address?.country_code || countryCode

  const isComplete = !!(cart.email && cart.billing_address?.first_name && cart.shipping_methods?.length)

  return (
    <form action={formAction}>
      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Email"
          name="email"
          type="email"
          required
          defaultValue={defaultEmail}
          autoComplete="email"
          data-testid="digital-email-input"
        />
        <div className="flex items-end">
          <Text className="txt-compact-small text-ui-fg-muted pb-3">Order confirmation will be sent here</Text>
        </div>

        <Input
          label="First name"
          name="first_name"
          autoComplete="given-name"
          defaultValue={defaultFirstName}
          required
          data-testid="digital-first-name-input"
        />
        <Input
          label="Last name"
          name="last_name"
          autoComplete="family-name"
          defaultValue={defaultLastName}
          required
          data-testid="digital-last-name-input"
        />

        <CountrySelect
          name="country_code"
          autoComplete="country"
          region={cart.region}
          defaultValue={defaultCountry}
          required
          data-testid="digital-country-select"
        />
        <div className="flex items-end">
          <Text className="txt-compact-small text-ui-fg-muted pb-3">Used for tax calculation</Text>
        </div>

        <Input
          label="Company"
          name="company_name"
          defaultValue={defaultCompany}
          autoComplete="organization"
          data-testid="digital-company-input"
        />
        <Input
          label="VAT Number"
          name="vat_number"
          defaultValue={defaultVat}
          data-testid="digital-vat-input"
        />
      </div>

      <ErrorMessage error={message?.error} data-testid="digital-checkout-error" />

      <SubmitButton className="mt-6" data-testid="digital-submit-button">
        {isComplete ? "Update Information" : "Save & Continue"}
      </SubmitButton>
    </form>
  )
}
