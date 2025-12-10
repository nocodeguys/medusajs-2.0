import { Modules } from '@medusajs/framework/utils'
import { INotificationModuleService, IOrderModuleService, ICustomerModuleService } from '@medusajs/framework/types'
import { SubscriberArgs, SubscriberConfig } from '@medusajs/medusa'
import { EmailTemplates } from '../modules/email-notifications/templates'
import { extendCustomerAccessWorkflow } from '../workflows/hooks/extend-customer-access'

export default async function orderPlacedHandler({
  event: { data },
  container,
}: SubscriberArgs<any>) {
  const notificationModuleService: INotificationModuleService = container.resolve(Modules.NOTIFICATION)
  const orderModuleService: IOrderModuleService = container.resolve(Modules.ORDER)
  
  const order = await orderModuleService.retrieveOrder(data.id, { relations: ['items', 'summary', 'shipping_address'] })
  const shippingAddress = await (orderModuleService as any).orderAddressService_.retrieve(order.shipping_address.id)

  // Send order confirmation email
  try {
    await notificationModuleService.createNotifications({
      to: order.email,
      channel: 'email',
      template: EmailTemplates.ORDER_PLACED,
      data: {
        emailOptions: {
          replyTo: 'info@example.com',
          subject: 'Your order has been placed'
        },
        order,
        shippingAddress,
        preview: 'Thank you for your order!'
      }
    })
  } catch (error) {
    console.error('Error sending order confirmation notification:', error)
  }

  // Extend customer access based on purchased items
  try {
    const { result } = await extendCustomerAccessWorkflow(container).run({
      input: {
        order_id: data.id,
      },
    })

    if (result.success) {
      console.log(`✅ Extended access for customer ${result.customer_id}`)
      console.log(`   Days added: ${result.days_added}`)
      console.log(`   New expiry: ${result.new_expiry}`)

      // Sync with Circle if configured
      await syncToCircle(container, result.customer_id!)
    }
  } catch (error) {
    console.error('Error extending customer access:', error)
  }
}

async function syncToCircle(container: any, customerId: string) {
  const CIRCLE_API_KEY = process.env.CIRCLE_API_KEY
  const CIRCLE_COMMUNITY_ID = process.env.CIRCLE_COMMUNITY_ID

  if (!CIRCLE_API_KEY || !CIRCLE_COMMUNITY_ID) {
    // Circle not configured, skip silently
    return
  }

  try {
    const customerModuleService: ICustomerModuleService = container.resolve(Modules.CUSTOMER)
    const customer = await customerModuleService.retrieveCustomer(customerId)

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
        skip_invitation: false,
      })
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Circle API error: ${error}`)
    }

    console.log(`✅ Synced customer to Circle: ${customer.email}`)
  } catch (error) {
    console.error('❌ Failed to sync to Circle:', error)
  }
}

export const config: SubscriberConfig = {
  event: 'order.placed'
}
