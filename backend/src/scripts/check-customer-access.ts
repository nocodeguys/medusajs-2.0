import { ExecArgs } from "@medusajs/framework/types";
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";

export default async function checkCustomerAccess({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const customerModuleService = container.resolve(Modules.CUSTOMER);

  logger.info("🔍 Checking customer access...\n");

  // List all customers
  const customers = await customerModuleService.listCustomers({});

  for (const customer of customers) {
    logger.info(`👤 Customer: ${customer.email}`);
    logger.info(`   ID: ${customer.id}`);
    logger.info(`   Name: ${customer.first_name} ${customer.last_name}`);
    
    const metadata = customer.metadata as Record<string, any> | null;
    if (metadata?.access_expires_at) {
      const expiresAt = new Date(metadata.access_expires_at);
      const now = new Date();
      const daysRemaining = Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      
      logger.info(`   ✅ Access expires: ${metadata.access_expires_at}`);
      logger.info(`   📅 Days remaining: ${daysRemaining}`);
      logger.info(`   Status: ${daysRemaining > 0 ? "ACTIVE" : "EXPIRED"}`);
    } else {
      logger.info(`   ❌ No access (no access_expires_at in metadata)`);
    }
    logger.info("");
  }

  logger.info("✅ Done");
}
