import { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"

export default async function cleanupExpiredAccess(container: MedusaContainer) {
  const customerModuleService = container.resolve(Modules.CUSTOMER)

  // Get all customers
  const [customers] = await customerModuleService.listAndCountCustomers({})

  const now = new Date()
  let expiredCount = 0

  for (const customer of customers) {
    const expiresAt = customer.metadata?.access_expires_at as string | undefined

    if (expiresAt) {
      const expiryDate = new Date(expiresAt)

      // If expired, optionally remove from Circle
      if (expiryDate < now) {
        try {
          await removeFromCircle(customer.email)
          expiredCount++
          console.log(`🧹 Processed expired customer: ${customer.email}`)
        } catch (error) {
          console.error(`❌ Failed to process expired customer ${customer.email}:`, error)
        }
      }
    }
  }

  if (expiredCount > 0) {
    console.log(`✅ Cleanup job completed. Processed ${expiredCount} expired customers.`)
  }
}

async function removeFromCircle(email: string) {
  const CIRCLE_API_KEY = process.env.CIRCLE_API_KEY
  const CIRCLE_COMMUNITY_ID = process.env.CIRCLE_COMMUNITY_ID

  if (!CIRCLE_API_KEY || !CIRCLE_COMMUNITY_ID) {
    // Circle not configured, skip silently
    return
  }

  // First, search for the member by email
  const searchResponse = await fetch(
    `https://api.circle.so/v1/community_members?community_id=${CIRCLE_COMMUNITY_ID}&email=${encodeURIComponent(email)}`,
    {
      method: 'GET',
      headers: {
        'Authorization': `Token ${CIRCLE_API_KEY}`,
        'Content-Type': 'application/json'
      }
    }
  )

  if (!searchResponse.ok) {
    const error = await searchResponse.text()
    throw new Error(`Circle API search error: ${error}`)
  }

  const members = await searchResponse.json()
  
  if (!members || members.length === 0) {
    // Member not found in Circle, nothing to remove
    return
  }

  const memberId = members[0].id

  // Remove the member from the community
  const deleteResponse = await fetch(
    `https://api.circle.so/v1/community_members/${memberId}?community_id=${CIRCLE_COMMUNITY_ID}`,
    {
      method: 'DELETE',
      headers: {
        'Authorization': `Token ${CIRCLE_API_KEY}`,
        'Content-Type': 'application/json'
      }
    }
  )

  if (!deleteResponse.ok) {
    const error = await deleteResponse.text()
    throw new Error(`Circle API delete error: ${error}`)
  }

  console.log(`✅ Removed expired member from Circle: ${email}`)
}

export const config = {
  name: "cleanup-expired-access",
  schedule: "0 2 * * *", // Run daily at 2 AM
}
