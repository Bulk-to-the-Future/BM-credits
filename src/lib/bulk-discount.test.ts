import { describe, it, expect } from "vitest";
import { BulkDiscountCalculator } from "./bulk-discount";
import { OrderLine } from "../types/bulk-types";

describe("BulkDiscountCalculator", () => {
    it("should calculate discount correctly with new query structure (variant.product)", () => {
        const lines: any[] = [
            {
                id: "line-1",
                quantity: 5,
                unitPrice: { gross: { amount: 100 } },
                variant: {
                    product: {
                        id: "prod-1",
                        metadata: [
                            { key: "bulk_eligible", value: "true" },
                            { key: "bulk_threshold", value: "5" },
                            { key: "bulk_value", value: "10" }, // 10% discount
                        ],
                    },
                },
            },
        ];

        const discounts = BulkDiscountCalculator.calculateDiscount(lines);
        const result = discounts.get("line-1");

        expect(result).toBeDefined();
        expect(result?.shouldApplyDiscount).toBe(true);
        expect(result?.discountValue).toBe(10); // 10% of 100 is 10
    });

    it("should NOT apply discount if threshold not met", () => {
        const lines: any[] = [
            {
                id: "line-2",
                quantity: 4, // Threshold is 5
                unitPrice: { gross: { amount: 100 } },
                variant: {
                    product: {
                        id: "prod-1",
                        metadata: [
                            { key: "bulk_eligible", value: "true" },
                            { key: "bulk_threshold", value: "5" },
                            { key: "bulk_value", value: "10" },
                        ],
                    },
                },
            },
        ];

        const discounts = BulkDiscountCalculator.calculateDiscount(lines);
        const result = discounts.get("line-2");

        expect(result).toBeDefined();
        expect(result?.shouldApplyDiscount).toBe(false);
        expect(result?.discountValue).toBe(0);
    });

    it("should NOT apply discount if not eligible", () => {
        const lines: any[] = [
            {
                id: "line-3",
                quantity: 10,
                unitPrice: { gross: { amount: 100 } },
                variant: {
                    product: {
                        id: "prod-2",
                        metadata: [
                            { key: "bulk_eligible", value: "false" },
                        ],
                    },
                },
            },
        ];

        const discounts = BulkDiscountCalculator.calculateDiscount(lines);
        const result = discounts.get("line-3");

        expect(result).toBeDefined();
        expect(result?.shouldApplyDiscount).toBe(false);
    });
});
