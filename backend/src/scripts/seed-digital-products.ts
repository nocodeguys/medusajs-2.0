import { ExecArgs } from "@medusajs/framework/types";
import {
  ContainerRegistrationKeys,
  Modules,
  ProductStatus,
} from "@medusajs/framework/utils";
import {
  createProductCategoriesWorkflow,
  createProductsWorkflow,
  createShippingOptionsWorkflow,
  createShippingProfilesWorkflow,
} from "@medusajs/medusa/core-flows";

/**
 * Seed script for digital products (time-based access passes)
 * 
 * Run with: npx medusa exec ./src/scripts/seed-digital-products.ts
 * 
 * This creates:
 * 1. A "Digital" shipping profile for non-physical products
 * 2. A free "Digital Delivery" shipping option
 * 3. A "Digital Products" category
 * 4. 30-day and 90-day access pass products with access_days metadata
 */
export default async function seedDigitalProducts({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const link = container.resolve(ContainerRegistrationKeys.LINK);
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const fulfillmentModuleService = container.resolve(Modules.FULFILLMENT);
  const salesChannelModuleService = container.resolve(Modules.SALES_CHANNEL);
  const regionModuleService = container.resolve(Modules.REGION);

  logger.info("🚀 Starting digital products seed...");

  // Get default sales channel
  const [defaultSalesChannel] = await salesChannelModuleService.listSalesChannels({
    name: "Default Sales Channel",
  });

  if (!defaultSalesChannel) {
    logger.error("❌ Default Sales Channel not found. Run the main seed first.");
    return;
  }

  // Get regions for pricing
  const regions = await regionModuleService.listRegions({});
  if (!regions.length) {
    logger.error("❌ No regions found. Run the main seed first.");
    return;
  }

  // Get existing fulfillment set for digital delivery (with service zones relation)
  const fulfillmentSets = await fulfillmentModuleService.listFulfillmentSets(
    {},
    { relations: ["service_zones"] }
  );
  
  let serviceZone;
  
  if (!fulfillmentSets.length || !fulfillmentSets[0].service_zones?.length) {
    logger.info("   No fulfillment sets found, creating one for digital products...");
    
    // Create a fulfillment set for digital products
    const digitalFulfillmentSet = await fulfillmentModuleService.createFulfillmentSets({
      name: "Digital Delivery",
      type: "shipping",
      service_zones: [
        {
          name: "Worldwide Digital",
          geo_zones: [
            { country_code: "us", type: "country" },
            { country_code: "gb", type: "country" },
            { country_code: "de", type: "country" },
            { country_code: "fr", type: "country" },
            { country_code: "es", type: "country" },
            { country_code: "it", type: "country" },
            { country_code: "pl", type: "country" },
            { country_code: "nl", type: "country" },
            { country_code: "se", type: "country" },
            { country_code: "dk", type: "country" },
          ],
        },
      ],
    });
    serviceZone = digitalFulfillmentSet.service_zones[0];
    logger.info("   ✅ Created Digital Delivery fulfillment set");
  } else {
    serviceZone = fulfillmentSets[0].service_zones[0];
    logger.info("   Using existing fulfillment set service zone");
  }

  // Step 1: Create Digital Shipping Profile
  logger.info("📦 Creating digital shipping profile...");
  
  let digitalShippingProfile;
  const existingProfiles = await fulfillmentModuleService.listShippingProfiles({
    name: "Digital Products",
  });

  if (existingProfiles.length) {
    digitalShippingProfile = existingProfiles[0];
    logger.info("   Using existing Digital Products shipping profile");
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
    logger.info("   ✅ Created Digital Products shipping profile");
  }

  // Step 2: Create Free Digital Delivery Shipping Option
  logger.info("🚚 Creating free digital delivery shipping option...");

  try {
    await createShippingOptionsWorkflow(container).run({
      input: [
        {
          name: "Digital Delivery (Instant)",
          price_type: "flat",
          provider_id: "manual_manual",
          service_zone_id: serviceZone.id,
          shipping_profile_id: digitalShippingProfile.id,
          type: {
            label: "Digital",
            description: "Instant digital delivery - no shipping required",
            code: "digital",
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
    logger.info("   ✅ Created Digital Delivery shipping option (free)");
  } catch (error: any) {
    if (error.message?.includes("already exists")) {
      logger.info("   Using existing Digital Delivery shipping option");
    } else {
      logger.warn(`   ⚠️ Could not create shipping option: ${error.message}`);
    }
  }

  // Step 3: Create Digital Products Category
  logger.info("📁 Creating digital products category...");

  let digitalCategory;
  try {
    const { result: categoryResult } = await createProductCategoriesWorkflow(container).run({
      input: {
        product_categories: [
          {
            name: "Digital Products",
            is_active: true,
          },
          {
            name: "Access Passes",
            is_active: true,
          },
        ],
      },
    });
    digitalCategory = categoryResult.find(cat => cat.name === "Access Passes");
    logger.info("   ✅ Created Digital Products and Access Passes categories");
  } catch (error: any) {
    logger.info("   Categories may already exist, continuing...");
  }

  // Step 4: Create Access Pass Products
  logger.info("🎫 Creating access pass products...");

  try {
    await createProductsWorkflow(container).run({
      input: {
        products: [
          {
            title: "30-Day Community Access",
            description: "Get 30 days of full access to our exclusive community. Access stacks - buy multiple to extend your membership!",
            handle: "30-day-pass",
            status: ProductStatus.PUBLISHED,
            shipping_profile_id: digitalShippingProfile.id,
            // No weight for digital products
            is_giftcard: false,
            discountable: true,
            ...(digitalCategory && { category_ids: [digitalCategory.id] }),
            images: [
              {
                url: "https://images.unsplash.com/photo-1557804506-669a67965ba0?w=800", // Placeholder - community image
              },
            ],
            options: [
              {
                title: "Duration",
                values: ["30 Days"],
              },
            ],
            variants: [
              {
                title: "30 Days Access",
                sku: "ACCESS-30-DAY",
                options: {
                  Duration: "30 Days",
                },
                // This is the key metadata for time-based access!
                metadata: {
                  access_days: 30,
                  is_digital: true,
                },
                manage_inventory: false, // Digital products don't need inventory
                prices: [
                  {
                    amount: 2900, // €29.00
                    currency_code: "eur",
                  },
                  {
                    amount: 2900, // $29.00
                    currency_code: "usd",
                  },
                ],
              },
            ],
            sales_channels: [
              {
                id: defaultSalesChannel.id,
              },
            ],
          },
          {
            title: "90-Day Community Access",
            description: "Get 90 days of full access to our exclusive community. Best value - save 20% compared to monthly!",
            handle: "90-day-pass",
            status: ProductStatus.PUBLISHED,
            shipping_profile_id: digitalShippingProfile.id,
            is_giftcard: false,
            discountable: true,
            ...(digitalCategory && { category_ids: [digitalCategory.id] }),
            images: [
              {
                url: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=800", // Placeholder - team image
              },
            ],
            options: [
              {
                title: "Duration",
                values: ["90 Days"],
              },
            ],
            variants: [
              {
                title: "90 Days Access",
                sku: "ACCESS-90-DAY",
                options: {
                  Duration: "90 Days",
                },
                metadata: {
                  access_days: 90,
                  is_digital: true,
                },
                manage_inventory: false,
                prices: [
                  {
                    amount: 6900, // €69.00 (save ~20%)
                    currency_code: "eur",
                  },
                  {
                    amount: 6900, // $69.00
                    currency_code: "usd",
                  },
                ],
              },
            ],
            sales_channels: [
              {
                id: defaultSalesChannel.id,
              },
            ],
          },
        ],
      },
    });
    logger.info("   ✅ Created 30-Day and 90-Day Access Pass products");
  } catch (error: any) {
    if (error.message?.includes("already exists") || error.message?.includes("unique")) {
      logger.info("   Products may already exist");
    } else {
      logger.error("   ❌ Error creating products:", error.message);
    }
  }

  logger.info("");
  logger.info("✅ Digital products seed completed!");
  logger.info("");
  logger.info("📋 Summary:");
  logger.info("   - Digital shipping profile: Created/Exists");
  logger.info("   - Free digital delivery option: Created/Exists");
  logger.info("   - 30-Day Pass: €29 with access_days: 30");
  logger.info("   - 90-Day Pass: €69 with access_days: 90");
  logger.info("");
  logger.info("🔧 Next steps:");
  logger.info("   1. Configure Stripe in .env (STRIPE_API_KEY, STRIPE_WEBHOOK_SECRET)");
  logger.info("   2. Add Stripe as payment provider to your region in Medusa Admin");
  logger.info("   3. Test checkout flow with a digital product");
}
