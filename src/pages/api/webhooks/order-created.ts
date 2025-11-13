import { SaleorAsyncWebhook } from "@saleor/app-sdk/handlers/next";
import { saleorApp } from "../../../saleor-app";
import { createClient } from "../../../lib/graphql/client";
import { FETCH_ORDER, UPDATE_LINE_DISCOUNT, UPDATE_LINE_METADATA } from "../../../lib/graphql/queries";
import { BulkDiscountCalculator } from "../../../lib/bulk-discount";
import { getBulkSettingsFromProduct } from "../../../lib/bulk-metadata";
import { gql } from "@apollo/client";
import { OrderData, OrderLine } from "../../../types/bulk-types";

interface OrderPayload {
  order: {
    id: string;
    created: string;
  };
}

interface ApolloQueryResult<T> {
  data?: T;
  loading: boolean;
  error?: any;
}

export const orderCreatedWebhook = new SaleorAsyncWebhook<OrderPayload>({
  name: "Order Created - Bulk Discounts",
  webhookPath: "api/webhooks/order-created",
  event: "ORDER_CREATED",
  apl: saleorApp.apl,
  query: gql`
    subscription {
      event {
        ... on OrderCreated {
          order {
            id
            created
          }
        }
      }
    }
  `,
});

export default orderCreatedWebhook.createHandler(async (req, res, context) => {
  console.log("===== Webhook triggered =====");

  const { payload, authData } = context;

  try {
    // 1️⃣ Log top-level info
    console.log("Webhook payload:", JSON.stringify(payload, null, 2));
    console.log("Auth data:", JSON.stringify(authData, null, 2));

    if (!payload || !payload.order) {
      console.error("No payload or order found in webhook context:", payload);
      return res.status(400).json({ error: "No order in payload" });
    }

    const order = payload.order;
    console.log("Processing order:", order.id, "created at", order.created);

    const client = createClient(authData.saleorApiUrl, authData.token);

    // 2️⃣ Fetch full order details
    let orderData: ApolloQueryResult<OrderData> | null = null;
    try {
      orderData = await client.query({
        query: gql(FETCH_ORDER),
        variables: { id: order.id },
      });
      console.log("Fetched order data:", JSON.stringify(orderData, null, 2));
    } catch (err: any) {
      console.error("Error fetching order data:", err?.graphQLErrors || err.message || err);
      return res.status(500).json({ error: "Error fetching order data", details: err });
    }

    const lines: OrderLine[] = orderData.data?.order?.lines || [];
    if (!lines.length) {
      console.warn("Order has no lines", order.id);
      return res.status(200).json({ message: "Order has no lines" });
    }

    console.log(`Order has ${lines.length} line(s)`);
    lines.forEach((line, idx) => {
      console.log(`\n--- Line ${idx} ---`);
      console.log("Line ID:", line.id);
      console.log("Quantity:", line.quantity);
      console.log("Unit Price:", line.unitPrice?.gross?.amount);
      console.log("Product ID:", line.product?.id || line.variant?.product?.id);
      console.log("Line privateMetadata:", line.privateMetadata);
      console.log("Product metadata:", line.product?.metadata || line.variant?.product?.metadata);
    });

    // 3️⃣ Calculate discounts
    let discounts: Map<string, { shouldApplyDiscount: boolean; discountValue: number }> = new Map();
    try {
      discounts = BulkDiscountCalculator.calculateDiscount(lines);
      console.log("Calculated discounts map:", discounts);
    } catch (err: any) {
      console.error("Error calculating discounts:", err);
    }

    // 4️⃣ Apply discounts and update metadata per line
    for (const line of lines) {
      try {
        const discount = discounts.get(line.id);
        const product = line.product || line.variant?.product;
        if (!product) {
          console.warn(`Line ${line.id} has no product or variant.product`);
          continue;
        }

        const settings = getBulkSettingsFromProduct(product);
        console.log(`Processing line ${line.id}`);
        console.log("Bulk settings:", settings);

        if (!settings || !settings.eligible) {
          console.log(`Line ${line.id} is not eligible for bulk discount`);
          continue;
        }

        if (discount && discount.shouldApplyDiscount && discount.discountValue > 0) {
          console.log(`Applying discount ${discount.discountValue} to line ${line.id}`);

          try {
            const discountResult = await client.mutate({
              mutation: gql(UPDATE_LINE_DISCOUNT),
              variables: {
                lineId: line.id,
                input: {
                  valueType: "FIXED",
                  value: discount.discountValue,
                  reason: "Bulk discount applied",
                },
              },
            });
            console.log(`Discount mutation result for line ${line.id}:`, JSON.stringify(discountResult, null, 2));
          } catch (err: any) {
            console.error(`Error applying discount to line ${line.id}:`, err?.graphQLErrors || err.message || err);
          }

          const metadata = [
            { key: "bulk_eligible", value: settings.eligible.toString() },
            { key: "bulk_threshold", value: settings.threshold.toString() },
            { key: "bulk_value", value: settings.value.toString() },
            { key: "bulk_discount_applied", value: discount.discountValue.toString() },
          ];

          console.log(`Updating metadata for line ${line.id}:`, metadata);

          try {
            const metadataResult = await client.mutate({
              mutation: gql(UPDATE_LINE_METADATA),
              variables: { id: line.id, input: metadata },
            });
            console.log(`Metadata mutation result for line ${line.id}:`, JSON.stringify(metadataResult, null, 2));
          } catch (err: any) {
            console.error(`Error updating metadata for line ${line.id}:`, err?.graphQLErrors || err.message || err);
          }
        } else {
          console.log(`No discount to apply for line ${line.id}`);
        }
      } catch (err: any) {
        console.error(`Unexpected error processing line ${line.id}:`, err?.graphQLErrors || err.message || err);
      }
    }

    console.log("===== Webhook finished processing order:", order.id, "=====");
    return res.status(200).json({ success: true });
  } catch (err: any) {
    console.error("Unexpected webhook error:", err?.graphQLErrors || err.message || err);
    return res.status(500).json({ error: "Unexpected webhook error", details: err });
  }
});
