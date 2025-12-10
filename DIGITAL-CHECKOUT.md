# Digital-Only Checkout Implementation

This document describes the one-page digital checkout system for Medusa + Next.js.

## Overview

A streamlined checkout flow for digital products that:
- Skips shipping address collection
- Auto-selects free digital delivery
- Collects only essential billing information
- Grants instant access after purchase

## Architecture

### Backend (Medusa)

#### 1. Digital Checkout API
**Location:** `backend/src/api/store/digital-checkout/`

- `POST /store/digital-checkout` - Prepares cart for digital checkout
- `GET /store/digital-checkout/validate/:cart_id` - Validates if cart is digital-eligible

#### 2. Digital Product Detection
Products are marked as digital via variant metadata:
```json
{
  "is_digital": true,
  "access_days": 30
}
```

#### 3. Access Granting Workflow
**Location:** `backend/src/workflows/hooks/extend-customer-access.ts`

Automatically extends customer access when order is placed:
- Reads `access_days` from purchased variants
- Stacks access time if customer already has active access
- Stores expiry in customer metadata (`access_expires_at`)

#### 4. Access Check API
**Location:** `backend/src/api/store/me/access/route.ts`

Returns customer's current access status:
```json
{
  "access": "active",
  "expiresAt": "2024-03-15T00:00:00.000Z",
  "daysRemaining": 25
}
```

### Frontend (Next.js)

#### 1. Digital Checkout Page
**Location:** `storefront/src/app/[countryCode]/(checkout)/checkout/digital/page.tsx`

One-page checkout with three steps:
1. **Your Information** - Email, name, country, company (optional), VAT (optional)
2. **Payment** - Payment method selection and card entry
3. **Review & Complete** - Final review and place order

#### 2. Server Actions
**Location:** `storefront/src/lib/data/digital-checkout.ts`

- `validateDigitalCheckout()` - Check if cart is digital-eligible
- `setDigitalCheckoutInfo()` - Set billing info without shipping
- `setDigitalShippingMethod()` - Auto-select free digital delivery
- `placeDigitalOrder()` - Complete the order

#### 3. Components
**Location:** `storefront/src/modules/checkout/components/`

- `digital-checkout-form/` - Customer info form
- `digital-payment/` - Payment method selection
- `digital-checkout-summary/` - Order summary sidebar
- `digital-review/` - Final review and place order button

#### 4. Cart Integration
**Location:** `storefront/src/modules/cart/templates/`

- `digital-summary.tsx` - Shows "Quick Digital Checkout" button for digital carts
- Cart page automatically detects digital products and shows appropriate checkout option

## Flow

```
1. Customer adds digital product to cart
2. Cart page detects digital-only cart
3. Shows "Quick Digital Checkout" button
4. Customer clicks → Digital checkout page
5. Step 1: Enter email, name, country (VAT optional)
6. Auto-select free digital shipping
7. Step 2: Select payment method, enter card
8. Step 3: Review and place order
9. Order completed → Access granted instantly
10. Redirect to confirmation page
```

## Form Fields

| Field | Required | Purpose |
|-------|----------|---------|
| Email | Yes | Order confirmation, account |
| First Name | Yes | Billing |
| Last Name | Yes | Billing |
| Country | Yes | Tax calculation |
| Company Name | No | B2B invoicing |
| VAT Number | No | B2B tax exemption |

## Setup

### 1. Seed Digital Products
```bash
cd backend
npx medusa exec ./src/scripts/seed-digital-products.ts
```

This creates:
- Digital shipping profile
- Free digital delivery option
- Sample 30-day and 90-day access passes

### 2. Configure Payment
1. Set up Stripe in `.env`:
   ```
   STRIPE_API_KEY=sk_...
   STRIPE_WEBHOOK_SECRET=whsec_...
   ```
2. Add Stripe as payment provider to your region in Medusa Admin

### 3. Test the Flow
1. Add a digital product to cart
2. Go to cart → Click "Quick Digital Checkout"
3. Complete the one-page checkout
4. Verify access is granted

## Customization

### Adding More Fields
Edit `digital-checkout-form/index.tsx` to add fields like:
- Phone number
- Address (for invoicing)
- Custom metadata

### VAT Validation
To add VIES VAT validation:
1. Create API endpoint for VAT validation
2. Call before payment step
3. Apply tax exemption if valid

### Post-Purchase Actions
Edit `backend/src/subscribers/order-placed.ts` to:
- Send custom emails
- Sync with external systems (Circle, Discord, etc.)
- Generate license keys

## API Reference

### POST /store/digital-checkout
```typescript
// Request
{
  cart_id: string
  email: string
  first_name: string
  last_name: string
  company_name?: string
  vat_number?: string
  country_code: string
}

// Response
{
  success: boolean
  cart_id: string
  requires_shipping: boolean
  message: string
}
```

### GET /store/digital-checkout/validate/:cart_id
```typescript
// Response
{
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
```

### GET /store/me/access
```typescript
// Response (authenticated)
{
  access: "active" | "expired" | "none"
  expiresAt: string | null
  daysRemaining?: number
}
```
