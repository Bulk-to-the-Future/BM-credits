import { createManifestHandler } from "@saleor/app-sdk/handlers/next";
import { AppManifest } from "@saleor/app-sdk/types";

export default createManifestHandler({
  async manifestFactory({ appBaseUrl }) {
    const manifest: AppManifest = {
      id: "app.bulkmagic-credits",
      version: "1.0.0",
      name: "BulkMagic Credits",
      permissions: ["MANAGE_ORDERS", "MANAGE_DISCOUNTS", "MANAGE_APPS"],
      appUrl: appBaseUrl,
      configurationUrl: `${appBaseUrl}/configuration`,
      tokenTargetUrl: `${appBaseUrl}/api/register`,
      dataPrivacyUrl: "https://example.com/privacy",
      homepageUrl: "https://example.com/homepage",
      supportUrl: "https://example.com/support",
      extensions: [],
      webhooks: [
        {
          name: "Order Created Webhook",
          asyncEvents: ["ORDER_CREATED"],
          targetUrl: `${appBaseUrl}/api/webhooks/order-created`,
          query: "subscription { event { ... on OrderCreated { order { id } } } }",
        },
        {
          name: "Order Fulfilled Webhook",
          asyncEvents: ["ORDER_FULFILLED"],
          targetUrl: `${appBaseUrl}/api/webhooks/order-fulfilled`,
          // ✅ Updated query to remove invalid `fulfillment` field
          query: "subscription { event { ... on OrderFulfilled { order { id lines { id } } } } }",
        },
      ],
    };

    return manifest;
  },
});
