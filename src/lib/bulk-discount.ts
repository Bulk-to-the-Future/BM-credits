import { groupLinesByProduct } from "./bulk-metadata";

export class BulkDiscountCalculator {
  static calculateDiscount(lines: any[], config: any) {
    const groups: { [key: string]: any[] } = groupLinesByProduct(lines);
    const discounts = new Map<string, { shouldApplyDiscount: boolean; discountValue: number }>();

    for (const [productId, groupLines] of Object.entries(groups)) {
      const totalQty = groupLines.reduce((sum: number, line: any) => sum + line.quantity, 0);
      const shouldApply = totalQty >= config.minQty;

      for (const line of groupLines) {
        const discountValue = line.unitPrice?.gross.amount * (config.discountPercent / 100) || 0;
        discounts.set(line.id, { shouldApplyDiscount: shouldApply, discountValue });
      }
    }

    return discounts;
  }
}