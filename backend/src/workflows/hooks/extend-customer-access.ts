import {
  StepResponse,
  createStep,
  createWorkflow,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { Modules } from "@medusajs/framework/utils"

type ExtendAccessInput = {
  order_id: string
}

type ExtendAccessResult = {
  success: boolean
  customer_id?: string
  new_expiry?: string
  days_added?: number
}

type CompensateInput = {
  customer_id: string
  previous_metadata: Record<string, unknown>
}

// Step to extend customer access based on order items
const extendCustomerAccessStep = createStep(
  "extend-customer-access-step",
  async (input: ExtendAccessInput, { container }): Promise<StepResponse<ExtendAccessResult, CompensateInput | null>> => {
    const orderModuleService = container.resolve(Modules.ORDER)
    const customerModuleService = container.resolve(Modules.CUSTOMER)
    const productModuleService = container.resolve(Modules.PRODUCT)

    // Fetch order with items
    const order = await orderModuleService.retrieveOrder(input.order_id, {
      relations: ["items"]
    })

    if (!order.customer_id) {
      return new StepResponse({ success: false }, null)
    }

    // Calculate total days to add
    let totalDaysToAdd = 0

    for (const item of order.items) {
      if (!item.variant_id) continue
      
      const variant = await productModuleService.retrieveProductVariant(item.variant_id)
      const accessDays = variant?.metadata?.access_days

      if (accessDays && typeof accessDays === 'number') {
        totalDaysToAdd += accessDays * item.quantity
      } else if (accessDays && typeof accessDays === 'string') {
        const parsedDays = parseInt(accessDays, 10)
        if (!isNaN(parsedDays)) {
          totalDaysToAdd += parsedDays * item.quantity
        }
      }
    }

    if (totalDaysToAdd === 0) {
      return new StepResponse({ success: false }, null)
    }

    // Get customer
    const customer = await customerModuleService.retrieveCustomer(order.customer_id)
    const existingExpiry = customer.metadata?.access_expires_at as string | undefined

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
    const previousMetadata = customer.metadata || {}
    await customerModuleService.updateCustomers(order.customer_id, {
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
        previous_metadata: previousMetadata as Record<string, unknown>
      }
    )
  },
  async (compensateInput, { container }) => {
    // Rollback on error
    if (compensateInput?.customer_id && compensateInput?.previous_metadata) {
      const customerModuleService = container.resolve(Modules.CUSTOMER)
      await customerModuleService.updateCustomers(compensateInput.customer_id, {
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
