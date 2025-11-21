import { OrderLine } from "../types/bulk-types";
import { groupLinesByProduct, getBulkSettingsFromProduct } from "./bulk-metadata";

interface DiscountResult {
  shouldApplyDiscount: boolean;
  discountValue: number;
}

export class BulkDiscountCalculator {
  static calculateDiscount(lines: OrderLine[]) {
    // Group lines by product
    const groups: Record<string, OrderLine[]> = groupLinesByProduct(lines);
    const discounts = new Map<string, DiscountResult>();

    // Loop through each product group
    for (const [productId, groupLines] of Object.entries(groups)) {
      const product = groupLines[0]?.product || groupLines[0]?.variant?.product;
      const settings = getBulkSettingsFromProduct(product);

      // Product is not bulk eligible → no discount
      if (!settings || !settings.eligible) {
        for (const line of groupLines) {
          discounts.set(line.id, { shouldApplyDiscount: false, discountValue: 0 });
        }
        continue;
      }

      // Calculate total quantity for this product
      const totalQty = groupLines.reduce((sum, line) => sum + line.quantity, 0);
      const shouldApply = totalQty >= settings.threshold;

      // Apply product-specific discount
      for (const line of groupLines) {
        const discountValue = shouldApply ? settings.value : 0;

        discounts.set(line.id, { shouldApplyDiscount: shouldApply, discountValue });
      }
    }

    return discounts;
  }
}
