import { SaleorAsyncWebhook } from "@saleor/app-sdk/handlers/next";
import { saleorApp } from "../../../saleor-app";
import { createClient } from "../../../lib/graphql/client";
import { FETCH_ORDER, UPDATE_LINE_DISCOUNT, UPDATE_LINE_METADATA } from "../../../lib/graphql/queries";
import { getAppConfig } from "../../../lib/config";
import { BulkDiscountCalculator } from "../../../lib/bulk-discount";
import { BulkMetadataManager } from "../../../lib/bulk-metadata";
import { groupLinesByProduct } from "../../../lib/bulk-metadata";
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
  name: "Order Created - Bulk Credits",
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
  const { payload, authData } = context;
  const order = payload.order;

  if (!order) {
    return res.status(200).json({ message: "No order in payload" });
  }

  try {
    const client = createClient(authData.saleorApiUrl, authData.token);
    const config = await getAppConfig(client, authData.appId);

    // Fetch full order details with unit prices
    const orderData: ApolloQueryResult<OrderData> = await client.query({ query: gql(FETCH_ORDER), variables: { id: order.id } });

    if (!orderData.data?.order?.lines) {
      return res.status(400).json({ message: "No order lines found" });
    }

    const lines: OrderLine[] = orderData.data.order.lines;

    // Calculate discounts
    const discounts = BulkDiscountCalculator.calculateDiscount(lines, config);

    // Group lines for pooled metadata
    const groups: { [key: string]: OrderLine[] } = groupLinesByProduct(lines);

    // First pass: Apply discounts and set per-line metadata (excluding pooled values)
    for (const line of lines) {
      const discount = discounts.get(line.id);

      if (discount && discount.shouldApplyDiscount) {
        // Apply discount
        await client.mutate({
          mutation: gql(UPDATE_LINE_DISCOUNT),
          variables: { lineId: line.id, input: { valueType: "FIXED", value: discount.discountValue, reason: "Bulk Discount" } },
        });

        // Create per-line metadata
        const metadata = BulkMetadataManager.createBulkMetadata(
          line.quantity,
          line.product.id,
          new Date(order.created),
          config
        );

        // Update line metadata
        await client.mutate({
          mutation: gql(UPDATE_LINE_METADATA),
          variables: { id: line.id, input: BulkMetadataManager.toMetadataInput(metadata) },
        });
      }
    }

    // Second pass: Compute and set pooled values (bulk_remaining, bulk_deadline) on qualifying groups
    for (const [productId, groupLines] of Object.entries(groups)) {
      const totalQty = groupLines.reduce((sum: number, line: OrderLine) => sum + line.quantity, 0);
      if (totalQty < config.minQty) continue;

      // Compute pooled remaining (initially totalQty) and min deadline (all same initially)
      const deadlines = groupLines.map((line: OrderLine) => new Date(order.created).setDate(new Date(order.created).getDate() + config.windowDays));
      const minDeadline = new Date(Math.min(...deadlines));

      const pooledMetadata = [
        { key: "bulk_remaining", value: totalQty.toString() },
        { key: "bulk_deadline", value: minDeadline.toISOString() },
      ];

      for (const line of groupLines) {
        await client.mutate({
          mutation: gql(UPDATE_LINE_METADATA),
          variables: { id: line.id, input: pooledMetadata },
        });
      }
    }

    return res.status(200).json({ success: true });
  } catch (error: any) {
    console.error("Error processing order:", error);
    return res.status(500).json({ error: error.message });
  }
});