import { ExecArgs } from "@medusajs/framework/types";
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";

export default async function debugShipping({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const productModuleService = container.resolve(Modules.PRODUCT);
  const fulfillmentModuleService = container.resolve(Modules.FULFILLMENT);

  logger.info("🔍 Debugging shipping setup...");

  // Get access pass products
  const products = await productModuleService.listProducts(
    {},
    { relations: ["variants"] }
  );

  logger.info(`\n📦 Products (${products.length}):`);
  for (const p of products) {
    logger.info(`   - ${p.title}`);
    logger.info(`     handle: ${p.handle}`);
    logger.info(`     shipping_profile_id: ${(p as any).shipping_profile_id || "NONE"}`);
  }

  // List shipping profiles
  const profiles = await fulfillmentModuleService.listShippingProfiles({});
  logger.info(`\n📋 Shipping Profiles (${profiles.length}):`);
  for (const sp of profiles) {
    logger.info(`   - ${sp.name} (${sp.id}) - type: ${sp.type}`);
  }

  // List shipping options with more details
  const options = await fulfillmentModuleService.listShippingOptions(
    {},
    { relations: ["type"] }
  );
  logger.info(`\n🚚 Shipping Options (${options.length}):`);
  for (const so of options) {
    logger.info(`   - ${so.name}`);
    logger.info(`     id: ${so.id}`);
    logger.info(`     shipping_profile_id: ${so.shipping_profile_id}`);
    logger.info(`     service_zone_id: ${so.service_zone_id}`);
  }

  // Check service zones
  const fulfillmentSets = await fulfillmentModuleService.listFulfillmentSets(
    {},
    { relations: ["service_zones", "service_zones.geo_zones"] }
  );
  logger.info(`\n🌍 Fulfillment Sets (${fulfillmentSets.length}):`);
  for (const fs of fulfillmentSets) {
    logger.info(`   - ${fs.name} (${fs.id})`);
    for (const sz of fs.service_zones || []) {
      logger.info(`     Service Zone: ${sz.name} (${sz.id})`);
      const countries = sz.geo_zones?.map((gz: any) => gz.country_code).join(", ");
      logger.info(`     Countries: ${countries}`);
    }
  }

  logger.info("\n✅ Debug complete");
}
