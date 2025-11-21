import { describe, it, expect, vi, beforeEach } from "vitest";
import { handlerFn } from "./order-created";
import * as clientModule from "../../../lib/graphql/client";
import * as bulkDiscountModule from "../../../lib/bulk-discount";
import * as bulkMetadataModule from "../../../lib/bulk-metadata";

// Mock dependencies
vi.mock("../../../lib/graphql/client");
vi.mock("../../../lib/bulk-discount");
vi.mock("../../../lib/bulk-metadata");

describe("order-created webhook handler", () => {
    let req: any;
    let res: any;
    let context: any;
    let mockClient: any;

    beforeEach(() => {
        req = {};
        res = {
            status: vi.fn().mockReturnThis(),
            json: vi.fn(),
        };
        context = {
            payload: {
                order: {
                    id: "order-123",
                    created: "2023-01-01T00:00:00Z",
                },
            },
            authData: {
                saleorApiUrl: "https://example.saleor.cloud/graphql/",
                token: "test-token",
            },
        };

        mockClient = {
            query: vi.fn(),
            mutate: vi.fn(),
        };

        (clientModule.createClient as any).mockReturnValue(mockClient);
        (bulkDiscountModule.BulkDiscountCalculator.calculateDiscount as any).mockReturnValue(new Map());
        (bulkMetadataModule.getBulkSettingsFromProduct as any).mockReturnValue({ eligible: false });
    });

    it("should handle missing authData gracefully", async () => {
        context.authData = null;
        await handlerFn(req, res, context);
        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: "Missing authData" }));
    });

    it("should handle createClient failure", async () => {
        (clientModule.createClient as any).mockImplementation(() => {
            throw new Error("Client creation failed");
        });
        await handlerFn(req, res, context);
        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: "Error creating GraphQL client" }));
    });

    it("should handle fetch order failure", async () => {
        mockClient.query.mockRejectedValue(new Error("Network error"));
        await handlerFn(req, res, context);
        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: "Error fetching order data" }));
    });

    it("should handle missing order data", async () => {
        mockClient.query.mockResolvedValue({ data: null });
        await handlerFn(req, res, context);
        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: "Order data malformed" }));
    });

    it("should process valid order with no lines", async () => {
        mockClient.query.mockResolvedValue({
            data: {
                order: {
                    lines: [],
                },
            },
        });
        await handlerFn(req, res, context);
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: "Order has no lines" }));
    });

    it("should process valid order with lines and no discount", async () => {
        mockClient.query.mockResolvedValue({
            data: {
                order: {
                    lines: [
                        {
                            id: "line-1",
                            quantity: 10,
                            product: { id: "prod-1" },
                        },
                    ],
                },
            },
        });
        await handlerFn(req, res, context);
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({ success: true });
    });
});
