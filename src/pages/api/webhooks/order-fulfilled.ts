// Force recompile
import { SaleorAsyncWebhook } from "@saleor/app-sdk/handlers/next";
import { saleorApp } from "../../../saleor-app";
import { createClient } from "../../../lib/graphql/client";
import { ORDER_DETAILS_QUERY, UPDATE_LINE_METADATA } from "../../../lib/graphql/queries";
import { RedemptionManager } from "../../../lib/redemption";
import { BulkMetadataManager } from "../../../lib/bulk-metadata";
import { gql } from "@apollo/client";
import { OrderDetailsData, FulfillmentLine } from "../../../types/bulk-types";

interface OrderFulfilledPayload {
  order: { id: string };
  fulfillment: { id: string; lines: FulfillmentLine[] };
}

interface ApolloQueryResult<T> {
  data?: T;
  loading: boolean;
  error?: any;
}

export const orderFulfilledWebhook = new SaleorAsyncWebhook<OrderFulfilledPayload>({
  name: "Order Fulfilled - Redemption",
  webhookPath: "api/webhooks/order-fulfilled",
  event: "ORDER_FULFILLED",
  apl: saleorApp.apl,
  query: gql`
    subscription {
      event {
        ... on OrderFulfilled {
          order {
            id
          }
          fulfillment {
            id
            lines {
              quantity
              orderLine {
                id
              }
            }
          }
        }
      }
    }
  `,
});

export default orderFulfilledWebhook.createHandler(async (req, res, context) => {
  console.log("===== Webhook triggered: ORDER_FULFILLED =====");
  const { payload, authData } = context;

  try {
    console.log("Payload received:", JSON.stringify(payload, null, 2));
    console.log("Auth data received:", JSON.stringify(authData, null, 2));

    const { order, fulfillment } = payload;

    if (!order || !fulfillment) {
      console.error("Missing order or fulfillment in payload");
      return res.status(200).json({ message: "No order/fulfillment in payload" });
    }

    console.log(`Processing fulfillment ${fulfillment.id} for order ${order.id}`);

    const client = createClient(authData.saleorApiUrl, authData.token);

    // Get full order details
    console.log("Fetching full order details...");
    const orderData: ApolloQueryResult<OrderDetailsData> = await client.query({ query: gql(ORDER_DETAILS_QUERY), variables: { id: order.id } });
    console.log("Order details fetched.");

    if (!orderData.data?.order?.lines) {
      console.error("No order lines found in fetched data");
      return res.status(400).json({ message: "No order lines found" });
    }

    const fullOrder = orderData.data.order;
    console.log(`Order has ${fullOrder.lines.length} lines.`);

    // Build redemption map (fulfilled quantities per line)
    const redemptions = new Map<string, number>();
    fulfillment.lines.forEach((fulfillmentLine: FulfillmentLine) => {
      if (fulfillmentLine.orderLine) {
        redemptions.set(fulfillmentLine.orderLine.id, fulfillmentLine.quantity);
      } else {
        console.warn("Fulfillment line missing orderLine reference:", fulfillmentLine);
      }
    });
    console.log("Redemptions map built:", JSON.stringify(Array.from(redemptions.entries())));

    // Calculate new remaining balances (pooled FIFO)
    console.log("Calculating pooled redemption...");
    const updatedMetadata = RedemptionManager.calculatePooledRedemption(
      fullOrder.lines,
      redemptions
    );
    console.log("Updated metadata calculated:", JSON.stringify(Array.from(updatedMetadata.entries())));

    // Update metadata for all affected lines
    for (const [lineId, metadata] of updatedMetadata.entries()) {
      console.log(`Updating metadata for line ${lineId}...`);
      await client.mutate({
        mutation: gql(UPDATE_LINE_METADATA),
        variables: { id: lineId, input: BulkMetadataManager.toMetadataInput(metadata) },
      });
      console.log(`Metadata updated for line ${lineId}`);
    }

    console.log("===== Webhook finished processing fulfillment =====");
    return res.status(200).json({ success: true });
  } catch (error: any) {
    console.error("Error processing fulfillment:", error);
    return res.status(500).json({ error: error.message });
  }
});

export const config = {
  api: {
    bodyParser: false,
  },
};