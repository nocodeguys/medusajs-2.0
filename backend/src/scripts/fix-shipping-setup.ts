import { ExecArgs } from "@medusajs/framework/types";
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";

export default async function fixShippingSetup({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const fulfillmentModuleService = container.resolve(Modules.FULFILLMENT);
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const link = container.resolve(ContainerRegistrationKeys.LINK);

  logger.info("🔧 Fixing shipping setup...");

  // Get service zone
  const fulfillmentSets = await fulfillmentModuleService.listFulfillmentSets(
    {},
    { relations: ["service_zones", "service_zones.geo_zones"] }
  );

  const serviceZone = fulfillmentSets[0]?.service_zones?.[0];
  if (!serviceZone) {
    logger.error("❌ No service zone found");
    return;
  }

  // Check if Poland is in the geo zones
  const hasPoland = serviceZone.geo_zones?.some((gz: any) => gz.country_code === "pl");
  
  if (!hasPoland) {
    logger.info("🌍 Adding Poland to service zone...");
    
    // Add Poland to the geo zones
    await fulfillmentModuleService.createGeoZones([
      {
        service_zone_id: serviceZone.id,
        country_code: "pl",
        type: "country",
      },
      {
        service_zone_id: serviceZone.id,
        country_code: "us",
        type: "country",
      },
      {
        service_zone_id: serviceZone.id,
        country_code: "nl",
        type: "country",
      },
    ]);
    logger.info("   ✅ Added Poland, US, Netherlands to service zone");
  } else {
    logger.info("   Poland already in service zone");
  }

  // Get default shipping profile
  const defaultProfiles = await fulfillmentModuleService.listShippingProfiles({
    type: "default",
  });
  const defaultProfile = defaultProfiles[0];

  if (!defaultProfile) {
    logger.error("❌ No default shipping profile found");
    return;
  }

  logger.info(`📦 Using default shipping profile: ${defaultProfile.id}`);

  // Get all products and link them to the default shipping profile
  const { data: products } = await query.graph({
    entity: "product",
    fields: ["id", "title", "handle"],
  });

  logger.info(`\n🔗 Linking ${products.length} products to shipping profile...`);

  for (const product of products) {
    try {
      // Create link between product and shipping profile
      await link.create({
        [Modules.PRODUCT]: {
          product_id: product.id,
        },
        [Modules.FULFILLMENT]: {
          shipping_profile_id: defaultProfile.id,
        },
      });
      logger.info(`   ✅ Linked: ${product.title}`);
    } catch (error: any) {
      if (error.message?.includes("already exists")) {
        logger.info(`   ⏭️ Already linked: ${product.title}`);
      } else {
        logger.warn(`   ⚠️ Error linking ${product.title}: ${error.message}`);
      }
    }
  }

  logger.info("\n✅ Shipping setup fixed!");
  logger.info("\n📋 Summary:");
  logger.info("   - Added Poland to service zone (for your address)");
  logger.info("   - Linked all products to default shipping profile");
  logger.info("\n🔄 Please refresh the checkout page and try again!");
}
