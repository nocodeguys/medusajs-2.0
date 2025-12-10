"use client"

import { useFormState } from "react-dom"
import { HttpTypes } from "@medusajs/types"
import { Input, Label, Text } from "@medusajs/ui"

import { setDigitalCheckoutInfo } from "@lib/data/digital-checkout"
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
  const [message, formAction] = useFormState(setDigitalCheckoutInfo, null)

  const defaultEmail = cart.email || customer?.email || ""
  const defaultFirstName = cart.billing_address?.first_name || customer?.first_name || ""
  const defaultLastName = cart.billing_address?.last_name || customer?.last_name || ""
  const defaultCompany = cart.billing_address?.company || ""
  const defaultVat = (cart.metadata?.vat_number as string) || ""
  const defaultCountry = cart.billing_address?.country_code || countryCode

  const isComplete = !!(cart.email && cart.billing_address?.first_name && cart.shipping_methods?.length)

  return (
    <form action={formAction}>
      <div className="grid grid-cols-1 gap-4">
        <div>
          <Label htmlFor="email" className="txt-compact-medium-plus mb-1">
            Email <span className="text-rose-500">*</span>
          </Label>
          <Input id="email" name="email" type="email" required defaultValue={defaultEmail} placeholder="your@email.com" autoComplete="email" />
          <Text className="txt-compact-small text-ui-fg-muted mt-1">Order confirmation will be sent here</Text>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="first_name" className="txt-compact-medium-plus mb-1">First Name <span className="text-rose-500">*</span></Label>
            <Input id="first_name" name="first_name" type="text" required defaultValue={defaultFirstName} placeholder="John" autoComplete="given-name" />
          </div>
          <div>
            <Label htmlFor="last_name" className="txt-compact-medium-plus mb-1">Last Name <span className="text-rose-500">*</span></Label>
            <Input id="last_name" name="last_name" type="text" required defaultValue={defaultLastName} placeholder="Doe" autoComplete="family-name" />
          </div>
        </div>

        <div>
          <Label htmlFor="country_code" className="txt-compact-medium-plus mb-1">Country <span className="text-rose-500">*</span></Label>
          <CountrySelect name="country_code" region={cart.region} defaultValue={defaultCountry} required />
          <Text className="txt-compact-small text-ui-fg-muted mt-1">Used for tax calculation</Text>
        </div>

        <div>
          <Label htmlFor="company_name" className="txt-compact-medium-plus mb-1">Company Name <span className="text-ui-fg-muted">(optional)</span></Label>
          <Input id="company_name" name="company_name" type="text" defaultValue={defaultCompany} placeholder="Your Company Ltd." autoComplete="organization" />
        </div>

        <div>
          <Label htmlFor="vat_number" className="txt-compact-medium-plus mb-1">VAT Number <span className="text-ui-fg-muted">(optional)</span></Label>
          <Input id="vat_number" name="vat_number" type="text" defaultValue={defaultVat} placeholder="EU123456789" />
          <Text className="txt-compact-small text-ui-fg-muted mt-1">Enter your VAT number for B2B invoicing</Text>
        </div>

        <ErrorMessage error={message?.error} />

        <SubmitButton className="mt-6">{isComplete ? "Update Information" : "Save & Continue"}</SubmitButton>
      </div>
    </form>
  )
}
