export function groupLinesByProduct(lines: any[]) {
    return lines.reduce((groups: any, line: any) => {
      const productId = line.product?.id || line.variant.product.id;
      if (!groups[productId]) groups[productId] = [];
      groups[productId].push(line);
      return groups;
    }, {});
  }
  
  export class BulkMetadataManager {
    static createBulkMetadata(quantity: number, productId: string, created: Date, config: any) {
      const deadline = new Date(created);
      deadline.setDate(deadline.getDate() + config.windowDays);
  
      return {
        bulk_pack: "true",
        bulk_quantity: quantity.toString(),
        bulk_discount: config.discountPercent.toString(),
        redemption_window_days: config.windowDays.toString(),
        bulk_internal_remaining: quantity.toString(), // Per-line internal tracker for FIFO
        bulk_group_product: productId,
        // bulk_remaining and bulk_deadline set in pooled pass
      };
    }
  
    static toMetadataInput(metadata: any) {
      return Object.entries(metadata).map(([key, value]) => ({ key, value: value as string }));
    }
  
    static parseMetadata(metadataItems: any[]): any {
      return metadataItems.reduce((acc: any, m: any) => ({ ...acc, [m.key]: m.value }), {});
    }
  }