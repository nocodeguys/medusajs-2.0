import { ExecArgs } from "@medusajs/framework/types";
import {
  ContainerRegistrationKeys,
  Modules,
  ProductStatus,
} from "@medusajs/framework/utils";
import {
  createProductsWorkflow,
  deleteProductsWorkflow,
} from "@medusajs/medusa/core-flows";

/**
 * Script to delete and recreate access pass products
 * 
 * Run with: npx medusa exec ./src/scripts/recreate-access-products.ts
 */
export default async function recreateAccessProducts({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const productModuleService = container.resolve(Modules.PRODUCT);
  const salesChannelModuleService = container.resolve(Modules.SALES_CHANNEL);
  const fulfillmentModuleService = container.resolve(Modules.FULFILLMENT);

  logger.info("🗑️  Deleting existing access pass products...");

  // Find existing access pass products
  const existingProducts = await productModuleService.listProducts({
    handle: ["30-day-pass", "90-day-pass"],
  });

  if (existingProducts.length > 0) {
    for (const product of existingProducts) {
      try {
        await deleteProductsWorkflow(container).run({
          input: { ids: [product.id] },
        });
        logger.info(`   ✅ Deleted: ${product.title} (${product.id})`);
      } catch (error: any) {
        logger.warn(`   ⚠️ Could not delete ${product.title}: ${error.message}`);
      }
    }
  } else {
    logger.info("   No existing access pass products found");
  }

  logger.info("🎫 Creating new access pass products...");

  // Get default sales channel
  const [defaultSalesChannel] = await salesChannelModuleService.listSalesChannels({
    name: "Default Sales Channel",
  });

  if (!defaultSalesChannel) {
    logger.error("❌ Default Sales Channel not found");
    return;
  }

  // Get digital shipping profile
  let shippingProfile;
  const profiles = await fulfillmentModuleService.listShippingProfiles({
    name: "Digital Products",
  });
  
  if (profiles.length) {
    shippingProfile = profiles[0];
  } else {
    // Fallback to default profile
    const defaultProfiles = await fulfillmentModuleService.listShippingProfiles({
      type: "default",
    });
    shippingProfile = defaultProfiles[0];
  }

  if (!shippingProfile) {
    logger.error("❌ No shipping profile found");
    return;
  }

  // Create the products
  try {
    await createProductsWorkflow(container).run({
      input: {
        products: [
          {
            title: "30-Day Community Access",
            description: "Get 30 days of full access to our exclusive community. Access stacks - buy multiple to extend your membership!",
            handle: "30-day-pass",
            status: ProductStatus.PUBLISHED,
            shipping_profile_id: shippingProfile.id,
            is_giftcard: false,
            discountable: true,
            images: [
              {
                url: "https://images.unsplash.com/photo-1557804506-669a67965ba0?w=800",
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
                metadata: {
                  access_days: 30,
                  is_digital: true,
                },
                manage_inventory: false,
                prices: [
                  {
                    amount: 2900,
                    currency_code: "eur",
                  },
                  {
                    amount: 2900,
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
            shipping_profile_id: shippingProfile.id,
            is_giftcard: false,
            discountable: true,
            images: [
              {
                url: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=800",
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
                    amount: 6900,
                    currency_code: "eur",
                  },
                  {
                    amount: 6900,
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
    logger.info("   ✅ Created 30-Day Community Access (€29, access_days: 30)");
    logger.info("   ✅ Created 90-Day Community Access (€69, access_days: 90)");
  } catch (error: any) {
    logger.error(`   ❌ Error creating products: ${error.message}`);
  }

  logger.info("");
  logger.info("✅ Done! Access pass products have been recreated.");
}
