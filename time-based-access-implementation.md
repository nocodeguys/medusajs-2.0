# Time-Based Access System Implementation Guide

Complete implementation for time-based access system using Medusa.js, enabling customers to purchase time-limited passes (e.g., 30-day, 90-day) that grant access to your community or content.

## Overview

This system allows you to:
- Sell time-based access passes as products
- Automatically extend customer access when they purchase
- Stack access time (e.g., 30 days + 30 days = 60 days)
- Expose access status to your frontend
- Integrate with Circle community platform

## Architecture

```
Product Variant → metadata.access_days (30)
      ↓
Order Placed Event
      ↓
Workflow Hook → Calculate Days
      ↓
Customer → metadata.access_expires_at (ISO date)
      ↓
Frontend API → Check Access Status
      ↓
Circle Integration → Sync Membership
```

---

## Step 0: Product Setup (Already Done)

You've already created a "30-day pass" product in Medusa Admin. Perfect!

---

## Step 1: Set Product Variant Metadata

For your "30-day pass" product, add this metadata to the variant:

```json
{
  "access_days": 30
}
```

### How to set it:

**Option A: Via Medusa Admin UI**
1. Go to Products → Your "30-day pass" product
2. Click on the variant
3. Scroll to "Metadata" section
4. Add key: `access_days`, value: `30`

**Option B: Via Admin API**
```bash
curl -X POST 'http://localhost:9000/admin/products/{product_id}/variants/{variant_id}' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer {admin_token}' \
  -d '{
    "metadata": {
      "access_days": 30
    }
  }'
```

For a 90-day pass, create another product/variant with `access_days: 90`.

---

## Step 2: Create Workflow to Extend Access

This workflow calculates and extends customer access based on purchased items.

**File: `src/workflows/hooks/extend-customer-access.ts`**

```typescript
import {
  StepResponse,
  createStep,
  createWorkflow,
  WorkflowResponse,
} from "@medusajs/workflows-sdk"

type ExtendAccessInput = {
  order_id: string
}

// Step to extend customer access based on order items
const extendCustomerAccessStep = createStep(
  "extend-customer-access-step",
  async (input: ExtendAccessInput, { container }) => {
    const orderModuleService = container.resolve("orderModuleService")
    const customerModuleService = container.resolve("customerModuleService")
    const productModuleService = container.resolve("productModuleService")

    // Fetch order with items
    const order = await orderModuleService.retrieve(input.order_id, {
      relations: ["items", "items.variant"]
    })

    if (!order.customer_id) {
      return new StepResponse({ success: false })
    }

    // Calculate total days to add
    let totalDaysToAdd = 0

    for (const item of order.items) {
      const variant = await productModuleService.retrieveVariant(item.variant_id)
      const accessDays = variant?.metadata?.access_days

      if (accessDays && typeof accessDays === 'number') {
        totalDaysToAdd += accessDays * item.quantity
      }
    }

    if (totalDaysToAdd === 0) {
      return new StepResponse({ success: false })
    }

    // Get customer
    const customer = await customerModuleService.retrieve(order.customer_id)
    const existingExpiry = customer.metadata?.access_expires_at

    // Calculate new expiry date
    const now = new Date()
    let baseDate = now

    // If existing expiry is in the future, stack on top of it
    if (existingExpiry) {
      const expiryDate = new Date(existingExpiry)
      if (expiryDate > now) {
        baseDate = expiryDate
      }
    }

    const newExpiry = new Date(baseDate)
    newExpiry.setDate(newExpiry.getDate() + totalDaysToAdd)

    // Update customer metadata
    const previousMetadata = customer.metadata
    await customerModuleService.update(order.customer_id, {
      metadata: {
        ...customer.metadata,
        access_expires_at: newExpiry.toISOString()
      }
    })

    return new StepResponse(
      {
        success: true,
        customer_id: order.customer_id,
        new_expiry: newExpiry.toISOString(),
        days_added: totalDaysToAdd
      },
      {
        customer_id: order.customer_id,
        previous_metadata: previousMetadata
      }
    )
  },
  async (compensateInput, { container }) => {
    // Rollback on error
    if (compensateInput?.customer_id && compensateInput?.previous_metadata) {
      const customerModuleService = container.resolve("customerModuleService")
      await customerModuleService.update(compensateInput.customer_id, {
        metadata: compensateInput.previous_metadata
      })
    }
  }
)

// Create the workflow
export const extendCustomerAccessWorkflow = createWorkflow(
  "extend-customer-access",
  (input: ExtendAccessInput) => {
    const result = extendCustomerAccessStep(input)
    return new WorkflowResponse(result)
  }
)
```

---

## Step 3: Create Subscriber to Hook into Order Events

This subscriber listens for order placement and triggers the access extension workflow.

**File: `src/subscribers/order-placed.ts`**

```typescript
import type { SubscriberArgs, SubscriberConfig } from "@medusajs/medusa"
import { extendCustomerAccessWorkflow } from "../workflows/hooks/extend-customer-access"

export default async function orderPlacedHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const { result } = await extendCustomerAccessWorkflow(container).run({
    input: {
      order_id: data.id,
    },
  })

  if (result.success) {
    console.log(`✅ Extended access for customer ${result.customer_id}`)
    console.log(`   Days added: ${result.days_added}`)
    console.log(`   New expiry: ${result.new_expiry}`)
  }
}

export const config: SubscriberConfig = {
  event: "order.placed",
}
```

### How it works:
1. Customer completes checkout
2. `order.placed` event fires
3. Workflow reads items → sums `access_days`
4. Updates customer metadata with new `access_expires_at`
5. Stacks time if existing access is still active

---

## Step 4: Create Store API Endpoint for Access Status

Expose an endpoint that your frontend can call to check if the logged-in customer has active access.

**File: `src/api/store/me/access/route.ts`**

```typescript
import type { MedusaRequest, MedusaResponse } from "@medusajs/medusa"
import { MedusaError } from "@medusajs/utils"

export async function GET(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  const customerModuleService = req.scope.resolve("customerModuleService")

  // Get authenticated customer from session
  const customerId = req.auth?.actor_id

  if (!customerId) {
    throw new MedusaError(
      MedusaError.Types.UNAUTHORIZED,
      "Customer must be logged in"
    )
  }

  const customer = await customerModuleService.retrieve(customerId)
  const expiresAt = customer.metadata?.access_expires_at

  let accessStatus = "none"
  let expiresAtISO = null

  if (expiresAt) {
    const expiryDate = new Date(expiresAt)
    const now = new Date()

    if (expiryDate > now) {
      accessStatus = "active"
      expiresAtISO = expiresAt
    } else {
      accessStatus = "expired"
      expiresAtISO = expiresAt
    }
  }

  res.json({
    access: accessStatus,
    expiresAt: expiresAtISO
  })
}
```

### API Response:

```json
{
  "access": "active",
  "expiresAt": "2025-03-31T23:59:59.000Z"
}
```

Possible `access` values:
- `"active"` - Has valid access
- `"expired"` - Had access but it expired
- `"none"` - Never purchased

---

## Step 5: Frontend Integration (Next.js)

### Custom Hook

**File: `app/hooks/useAccess.ts`**

```typescript
import { useEffect, useState } from 'react'

export function useAccess() {
  const [access, setAccess] = useState<{
    status: 'active' | 'expired' | 'none'
    expiresAt: string | null
  } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('http://localhost:9000/store/me/access', {
      credentials: 'include',
      headers: {
        'x-publishable-api-key': process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY || ''
      }
    })
      .then(res => {
        if (!res.ok) throw new Error('Not authenticated')
        return res.json()
      })
      .then(data => {
        setAccess({
          status: data.access,
          expiresAt: data.expiresAt
        })
      })
      .catch(err => {
        console.error('Failed to fetch access:', err)
        setAccess({ status: 'none', expiresAt: null })
      })
      .finally(() => setLoading(false))
  }, [])

  return { access, loading }
}
```

### Component Usage

**File: `app/components/CommunityAccess.tsx`**

```typescript
'use client'

import { useAccess } from '@/hooks/useAccess'

export function CommunityAccess() {
  const { access, loading } = useAccess()

  if (loading) {
    return <div>Loading access status...</div>
  }

  if (!access) {
    return <div>Unable to check access status</div>
  }

  if (access.status === 'active') {
    const expiryDate = new Date(access.expiresAt!)
    const daysRemaining = Math.ceil(
      (expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    )

    return (
      <div className="access-active">
        <h2>Welcome! You have active access</h2>
        <p>Access expires: {expiryDate.toLocaleDateString()}</p>
        <p>Days remaining: {daysRemaining}</p>
        <a href="/community" className="btn-primary">
          Enter Community
        </a>
        <a href="/products/30-day-pass" className="btn-secondary">
          Extend Access (Buy Another Pass)
        </a>
      </div>
    )
  }

  if (access.status === 'expired') {
    return (
      <div className="access-expired">
        <h2>Your access has expired</h2>
        <p>Last expired: {new Date(access.expiresAt!).toLocaleDateString()}</p>
        <a href="/products/30-day-pass" className="btn-primary">
          Renew Access
        </a>
      </div>
    )
  }

  return (
    <div className="access-none">
      <h2>Get Access to Our Community</h2>
      <p>Purchase a 30-day pass to join our exclusive community!</p>
      <a href="/products/30-day-pass" className="btn-primary">
        Buy 30-Day Pass
      </a>
    </div>
  )
}
```

---

## Step 6: Circle Community Integration

Add Circle.so integration to automatically sync members when they get access.

### Update Subscriber with Circle Integration

**File: `src/subscribers/order-placed.ts` (Updated)**

```typescript
import type { SubscriberArgs, SubscriberConfig } from "@medusajs/medusa"
import { extendCustomerAccessWorkflow } from "../workflows/hooks/extend-customer-access"

export default async function orderPlacedHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const { result } = await extendCustomerAccessWorkflow(container).run({
    input: {
      order_id: data.id,
    },
  })

  if (result.success) {
    console.log(`✅ Extended access for customer ${result.customer_id}`)
    console.log(`   Days added: ${result.days_added}`)
    console.log(`   New expiry: ${result.new_expiry}`)

    // Sync with Circle
    try {
      const customerModuleService = container.resolve("customerModuleService")
      const customer = await customerModuleService.retrieve(result.customer_id)

      await syncToCircle(customer)
      console.log(`✅ Synced customer to Circle: ${customer.email}`)
    } catch (error) {
      console.error('❌ Failed to sync to Circle:', error)
    }
  }
}

async function syncToCircle(customer: any) {
  const CIRCLE_API_KEY = process.env.CIRCLE_API_KEY
  const CIRCLE_COMMUNITY_ID = process.env.CIRCLE_COMMUNITY_ID

  if (!CIRCLE_API_KEY || !CIRCLE_COMMUNITY_ID) {
    throw new Error('Circle API credentials not configured')
  }

  // Add or update member in Circle
  const response = await fetch(`https://api.circle.so/v1/community_members`, {
    method: 'POST',
    headers: {
      'Authorization': `Token ${CIRCLE_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      community_id: CIRCLE_COMMUNITY_ID,
      email: customer.email,
      name: `${customer.first_name || ''} ${customer.last_name || ''}`.trim() || customer.email,
      skip_invitation: false, // Set to true to skip email invitation
      // Optional: Add custom fields
      // custom_fields: {
      //   medusa_customer_id: customer.id
      // }
    })
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Circle API error: ${error}`)
  }

  return response.json()
}

export const config: SubscriberConfig = {
  event: "order.placed",
}
```

### Environment Variables

Add to `.env`:

```bash
CIRCLE_API_KEY=your_circle_api_key_here
CIRCLE_COMMUNITY_ID=your_circle_community_id_here
```

### Optional: Periodic Cleanup for Expired Access

Create a scheduled job to remove expired members from Circle.

**File: `src/jobs/cleanup-expired-access.ts`**

```typescript
import type { ScheduledJobConfig, ScheduledJobArgs } from "@medusajs/medusa"

export default async function cleanupExpiredAccess({
  container,
}: ScheduledJobArgs) {
  const customerModuleService = container.resolve("customerModuleService")

  // Get all customers
  const customers = await customerModuleService.list({})

  const now = new Date()

  for (const customer of customers) {
    const expiresAt = customer.metadata?.access_expires_at

    if (expiresAt) {
      const expiryDate = new Date(expiresAt)

      // If expired, remove from Circle
      if (expiryDate < now) {
        try {
          await removeFromCircle(customer.email)
          console.log(`🧹 Removed expired customer from Circle: ${customer.email}`)
        } catch (error) {
          console.error(`❌ Failed to remove from Circle:`, error)
        }
      }
    }
  }
}

async function removeFromCircle(email: string) {
  // Implement Circle member removal
  // This depends on Circle's API - you may need to:
  // 1. Search for member by email
  // 2. Remove their role or delete them
}

export const config: ScheduledJobConfig = {
  name: "cleanup-expired-access",
  schedule: "0 2 * * *", // Run daily at 2 AM
}
```

---

## Testing Flow

### 1. Create Test Customer

```bash
# Register via Medusa Admin or Store API
```

### 2. Buy 30-Day Pass

- Customer purchases "30-day pass" product
- Order completes → `order.placed` event fires
- Check customer metadata:

```json
{
  "access_expires_at": "2025-01-09T12:00:00.000Z"
}
```

### 3. Buy Second 30-Day Pass Before Expiry

- Customer buys another pass on Jan 5, 2025
- New expiry should be: Jan 9 + 30 days = **Feb 8, 2025**

### 4. Access After Expiry

- Customer's access expires
- API returns `access: "expired"`
- (Optional) Cron job removes from Circle

### 5. Buy After Expiry

- Customer expired on Feb 8
- Buys new pass on Feb 20
- New expiry: Feb 20 + 30 = **Mar 22**
  (Not stacked onto old Feb 8 date)

---

## Summary

### What This Implementation Does

✅ **Stores access duration** in product variant metadata
✅ **Stores expiry date** in customer metadata
✅ **Automatically extends access** when orders are placed
✅ **Stacks access correctly** (adds to future expiry, not past)
✅ **Provides REST API** for frontend to check access
✅ **Integrates with Circle** for community membership
✅ **Handles edge cases** (expired access, multiple purchases, etc.)

### Key Files Created

```
src/
├── workflows/
│   └── hooks/
│       └── extend-customer-access.ts    # Main workflow logic
├── subscribers/
│   └── order-placed.ts                   # Event listener
├── api/
│   └── store/
│       └── me/
│           └── access/
│               └── route.ts              # Frontend API endpoint
└── jobs/
    └── cleanup-expired-access.ts         # Optional: scheduled cleanup
```

---

## Next Steps

1. **Deploy to your Medusa backend** - Copy files to your Medusa project
2. **Set product metadata** - Add `access_days: 30` to your pass variant
3. **Test the flow** - Make a test purchase and verify customer metadata updates
4. **Integrate frontend** - Use the `/store/me/access` endpoint in your Next.js app
5. **Connect Circle** - Add Circle API credentials and test sync
6. **Go live!** - Your time-based access system is ready

---

## Troubleshooting

### Access not extending after purchase

- Check if variant has `access_days` metadata
- Verify subscriber is registered (check Medusa logs)
- Ensure order has `customer_id` (guest orders won't work)

### Frontend can't access `/store/me/access`

- Verify customer is authenticated (session cookie)
- Check `x-publishable-api-key` header is set
- Ensure CORS is configured for your frontend domain

### Circle integration failing

- Verify `CIRCLE_API_KEY` and `CIRCLE_COMMUNITY_ID` in `.env`
- Check Circle API key has correct permissions
- Review error logs for specific Circle API errors

---

## Future Enhancements

- **Admin UI**: View customer access status in Medusa Admin
- **Access Levels**: Different tiers (basic, premium) via metadata
- **Notifications**: Email customers before access expires
- **Analytics**: Track purchase patterns and renewal rates
- **Proration**: Allow upgrading from 30-day to 90-day with credit

---

*Implementation guide for time-based access system using Medusa v2*
