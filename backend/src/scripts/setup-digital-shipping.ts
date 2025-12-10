import { ExecArgs } from "@medusajs/framework/types";
import {
  ContainerRegistrationKeys,
  Modules,
} from "@medusajs/framework/utils";
import {
  createShippingOptionsWorkflow,
  createShippingProfilesWorkflow,
} from "@medusajs/medusa/core-flows";

/**
 * Setup digital/free shipping for digital products
 * 
 * Run with: npx medusa exec ./src/scripts/setup-digital-shipping.ts
 */
export default async function setupDigitalShipping({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const fulfillmentModuleService = container.resolve(Modules.FULFILLMENT);
  const regionModuleService = container.resolve(Modules.REGION);

  logger.info("🚀 Setting up digital shipping...");

  // Get regions for pricing
  const regions = await regionModuleService.listRegions({});
  if (!regions.length) {
    logger.error("❌ No regions found.");
    return;
  }
  logger.info(`   Found ${regions.length} region(s)`);

  // Get existing fulfillment sets with service zones
  const fulfillmentSets = await fulfillmentModuleService.listFulfillmentSets(
    {},
    { relations: ["service_zones"] }
  );

  if (!fulfillmentSets.length) {
    logger.error("❌ No fulfillment sets found.");
    return;
  }

  // Find a service zone
  let serviceZone;
  for (const fs of fulfillmentSets) {
    if (fs.service_zones?.length) {
      serviceZone = fs.service_zones[0];
      logger.info(`   Using service zone: ${serviceZone.name} (${serviceZone.id})`);
      break;
    }
  }

  if (!serviceZone) {
    logger.error("❌ No service zones found in any fulfillment set.");
    return;
  }

  // Get or create Digital shipping profile
  logger.info("📦 Setting up digital shipping profile...");
  
  let digitalShippingProfile;
  const existingProfiles = await fulfillmentModuleService.listShippingProfiles({
    name: "Digital Products",
  });

  if (existingProfiles.length) {
    digitalShippingProfile = existingProfiles[0];
    logger.info(`   Using existing profile: ${digitalShippingProfile.id}`);
  } else {
    const { result: profileResult } = await createShippingProfilesWorkflow(container).run({
      input: {
        data: [
          {
            name: "Digital Products",
            type: "default",
          },
        ],
      },
    });
    digitalShippingProfile = profileResult[0];
    logger.info(`   ✅ Created Digital Products shipping profile`);
  }

  // Check if Digital Delivery shipping option exists
  const existingOptions = await fulfillmentModuleService.listShippingOptions({
    name: "Digital Delivery (Free)",
  });

  if (existingOptions.length) {
    logger.info("   Digital Delivery shipping option already exists");
  } else {
    // Create free Digital Delivery shipping option
    logger.info("🚚 Creating free Digital Delivery shipping option...");

    try {
      await createShippingOptionsWorkflow(container).run({
        input: [
          {
            name: "Digital Delivery (Free)",
            price_type: "flat",
            provider_id: "manual_manual",
            service_zone_id: serviceZone.id,
            shipping_profile_id: digitalShippingProfile.id,
            type: {
              label: "Digital",
              description: "Instant digital delivery - no shipping required",
              code: "digital-free",
            },
            prices: [
              {
                currency_code: "eur",
                amount: 0,
              },
              {
                currency_code: "usd",
                amount: 0,
              },
              ...regions.map(region => ({
                region_id: region.id,
                amount: 0,
              })),
            ],
            rules: [
              {
                attribute: "enabled_in_store",
                value: "true",
                operator: "eq",
              },
              {
                attribute: "is_return",
                value: "false",
                operator: "eq",
              },
            ],
          },
        ],
      });
      logger.info("   ✅ Created Digital Delivery (Free) shipping option");
    } catch (error: any) {
      logger.error(`   ❌ Error: ${error.message}`);
    }
  }

  // List all shipping options
  logger.info("");
  logger.info("📋 Current shipping options:");
  const allOptions = await fulfillmentModuleService.listShippingOptions({});
  for (const opt of allOptions) {
    logger.info(`   - ${opt.name} (${opt.id})`);
  }

  logger.info("");
  logger.info("✅ Digital shipping setup complete!");
}
