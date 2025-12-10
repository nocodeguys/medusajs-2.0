import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError, Modules } from "@medusajs/framework/utils"
import type { ICustomerModuleService } from "@medusajs/framework/types"

type AccessStatus = "active" | "expired" | "none"

interface AccessResponse {
  access: AccessStatus
  expiresAt: string | null
  daysRemaining?: number
}

export async function GET(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse<AccessResponse>
): Promise<void> {
  const customerModuleService: ICustomerModuleService = req.scope.resolve(Modules.CUSTOMER)

  // Get authenticated customer from session
  const customerId = req.auth_context?.actor_id

  if (!customerId) {
    throw new MedusaError(
      MedusaError.Types.UNAUTHORIZED,
      "Customer must be logged in"
    )
  }

  const customer = await customerModuleService.retrieveCustomer(customerId)
  const expiresAt = customer.metadata?.access_expires_at as string | undefined

  let accessStatus: AccessStatus = "none"
  let expiresAtISO: string | null = null
  let daysRemaining: number | undefined = undefined

  if (expiresAt) {
    const expiryDate = new Date(expiresAt)
    const now = new Date()

    if (expiryDate > now) {
      accessStatus = "active"
      expiresAtISO = expiresAt
      daysRemaining = Math.ceil(
        (expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      )
    } else {
      accessStatus = "expired"
      expiresAtISO = expiresAt
    }
  }

  res.json({
    access: accessStatus,
    expiresAt: expiresAtISO,
    ...(daysRemaining !== undefined && { daysRemaining })
  })
}
