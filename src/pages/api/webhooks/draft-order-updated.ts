import { NextApiRequest, NextApiResponse } from "next";
import { SaleorAsyncWebhook } from "@saleor/app-sdk/handlers/next";
import { gql } from "@apollo/client";
import { createClient } from "../../../lib/graphql/client";
import { FETCH_ORDER, UPDATE_LINE_DISCOUNT } from "../../../lib/graphql/queries";
import { BulkDiscountCalculator } from "../../../lib/bulk-discount";

export const config = {
    api: {
        bodyParser: false,
    },
};

export const handlerFn = async (req: NextApiRequest, res: NextApiResponse) => {
    console.log("===== Webhook triggered: DRAFT_ORDER_UPDATED =====");

    const draftOrderUpdatedWebhook = new SaleorAsyncWebhook({
        name: "Draft Order Updated Webhook",
        webhookPath: "api/webhooks/draft-order-updated",
        event: "DRAFT_ORDER_UPDATED",
        apl: (await import("../../../saleor-app")).saleorApp.apl,
        query: gql`
            subscription {
                event {
                    ... on DraftOrderUpdated {
                        order {
                            id
                        }
                    }
                }
            }
        `,
    });

    const draftOrderCreatedWebhook = new SaleorAsyncWebhook({
        name: "Draft Order Created Webhook",
        webhookPath: "api/webhooks/draft-order-updated",
        event: "DRAFT_ORDER_CREATED",
        apl: (await import("../../../saleor-app")).saleorApp.apl,
        query: gql`
            subscription {
                event {
                    ... on DraftOrderCreated {
                        order {
                            id
                        }
                    }
                }
            }
        `,
    });

    try {
        // Try to handle as Updated event first
        await draftOrderUpdatedWebhook.createHandler(async (req, res, context) => {
            await processWebhook(req, res, context);
        })(req, res);
    } catch (e) {
        // If it fails (e.g. event mismatch), try Created event
        try {
            await draftOrderCreatedWebhook.createHandler(async (req, res, context) => {
                await processWebhook(req, res, context);
            })(req, res);
        } catch (err: any) {
            console.error("Unexpected webhook error:", JSON.stringify(err, Object.getOwnPropertyNames(err)));
            return res.status(500).json({ error: "Unexpected webhook error", details: err.message || err });
        }
    }
};

async function processWebhook(req: NextApiRequest, res: NextApiResponse, context: any) {
    const { payload, authData } = context;
    console.log("Payload received:", JSON.stringify(payload, null, 2));
    console.log("Auth data received:", JSON.stringify(authData, null, 2));

    if (!authData || !authData.token || !authData.saleorApiUrl) {
        console.error("Missing auth data (token or saleorApiUrl)");
        return res.status(401).json({ error: "Missing auth data" });
    }

    const client = createClient(authData.saleorApiUrl, authData.token);

    // The payload for DraftOrderUpdated/Created contains 'order' field
    // structure: { order: { id: "..." } }
    const orderId = payload.order?.id;

    if (!orderId) {
        console.error("No order ID found in payload. Payload keys:", Object.keys(payload));
        return res.status(400).json({ error: "No order ID found in payload" });
    }

    console.log(`Processing draft order: ${orderId}`);

    try {
        // 1. Fetch full order details including lines and product metadata
        console.log(`Fetching order details for ID: ${orderId}`);
        const { data, error: fetchError } = await client.query({
            query: gql(FETCH_ORDER),
            variables: { id: orderId },
            fetchPolicy: "network-only",
        });

        if (fetchError) {
            console.error("Error fetching order:", JSON.stringify(fetchError, null, 2));
            throw new Error(`Error fetching order: ${fetchError.message}`);
        }

        if (!data || !data.order) {
            console.error("Order not found or data is empty:", JSON.stringify(data, null, 2));
            return res.status(404).json({ error: "Order not found" });
        }

        const order = data.order;
        console.log(`Order fetched successfully. Status: ${order.status}, Lines: ${order.lines.length}`);

        // Log line details for debugging
        order.lines.forEach((line: any, index: number) => {
            console.log(`Line ${index}: ID=${line.id}, Product=${line.variant?.product?.id}, Metadata=${JSON.stringify(line.variant?.product?.privateMetadata)}`);
        });

        console.log("Calculating discounts...");
        const discounts = BulkDiscountCalculator.calculateDiscount(order.lines);

        // 3. Apply discounts
        for (const line of order.lines) {
            const discount = discounts.get(line.id);
            if (discount && discount.shouldApplyDiscount) {
                console.log(`Applying discount to line ${line.id}: ${discount.discountValue}%`);

                try {
                    const mutationVariables = {
                        orderLineId: line.id, // Correct argument name for orderLineDiscountUpdate
                        input: {
                            valueType: "PERCENTAGE",
                            value: discount.discountValue.toString(),
                            reason: "Bulk discount applied",
                        },
                    };
                    console.log("Mutation variables:", JSON.stringify(mutationVariables, null, 2));

                    const discountResult = await client.mutate({
                        mutation: gql(UPDATE_LINE_DISCOUNT),
                        variables: mutationVariables,
                    });
                    console.log(`Discount mutation result for line ${line.id}:`, JSON.stringify(discountResult, null, 2));

                    if (discountResult.data?.orderLineDiscountUpdate?.errors?.length > 0) {
                        console.error(`GraphQL errors applying discount to line ${line.id}:`, JSON.stringify(discountResult.data.orderLineDiscountUpdate.errors, null, 2));
                    } else {
                        console.log(`Successfully applied discount to line ${line.id}`);
                    }

                } catch (err: any) {
                    console.error(`Error applying discount to line ${line.id}:`, JSON.stringify(err, Object.getOwnPropertyNames(err)));
                }
            } else {
                console.log(`No discount to apply for line ${line.id}. Eligible: ${discount?.shouldApplyDiscount}, Value: ${discount?.discountValue}`);
            }
        }

        console.log(`===== Webhook finished processing draft order: ${orderId} =====`);
        return res.status(200).json({ success: true });

    } catch (err: any) {
        console.error("Error processing draft order:", JSON.stringify(err, Object.getOwnPropertyNames(err)));
        return res.status(500).json({ error: "Internal server error", details: err.message });
    }
}

export default handlerFn;
