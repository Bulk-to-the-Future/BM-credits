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
  const { payload, authData } = context;
  const { order, fulfillment } = payload;

  if (!order || !fulfillment) {
    return res.status(200).json({ message: "No order/fulfillment in payload" });
  }

  try {
    const client = createClient(authData.saleorApiUrl, authData.token);

    // Get full order details
    const orderData: ApolloQueryResult<OrderDetailsData> = await client.query({ query: gql(ORDER_DETAILS_QUERY), variables: { id: order.id } });

    if (!orderData.data?.order?.lines) {
      return res.status(400).json({ message: "No order lines found" });
    }

    const fullOrder = orderData.data.order;

    // Build redemption map (fulfilled quantities per line)
    const redemptions = new Map<string, number>();
    fulfillment.lines.forEach((fulfillmentLine: FulfillmentLine) => {
      redemptions.set(fulfillmentLine.orderLine.id, fulfillmentLine.quantity);
    });

    // Calculate new remaining balances (pooled FIFO)
    const updatedMetadata = RedemptionManager.calculatePooledRedemption(
      fullOrder.lines,
      redemptions
    );

    // Update metadata for all affected lines
    for (const [lineId, metadata] of updatedMetadata.entries()) {
      await client.mutate({
        mutation: gql(UPDATE_LINE_METADATA),
        variables: { id: lineId, input: BulkMetadataManager.toMetadataInput(metadata) },
      });
    }

    return res.status(200).json({ success: true });
  } catch (error: any) {
    console.error("Error processing fulfillment:", error);
    return res.status(500).json({ error: error.message });
  }
});