export function groupLinesByProduct(lines: any[]) {
  return lines.reduce((groups: any, line: any) => {
    const productId = line.product?.id || line.variant.product.id;
    if (!groups[productId]) groups[productId] = [];
    groups[productId].push(line);
    return groups;
  }, {});
}

// New helper: parse metadata array to key-value map
export function parseMetadataItems(metadataItems: any[]): Record<string, string> {
  return metadataItems.reduce((acc: any, m: any) => ({ ...acc, [m.key]: m.value }), {});
}

// New helper: extract product-level bulk discount settings
export function getBulkSettingsFromProduct(product: any) {
  if (!product?.metadata) return null;
  const meta = parseMetadataItems(product.metadata);

  return {
    eligible: meta.bulk_eligible === "true",
    threshold: Number(meta.bulk_threshold || 0),
    value: Number(meta.bulk_value || 0)
  };
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
      bulk_internal_remaining: quantity.toString(),
      bulk_group_product: productId,
    };
  }

  static toMetadataInput(metadata: any) {
    return Object.entries(metadata).map(([key, value]) => ({ key, value: value as string }));
  }

  static parseMetadata(metadataItems: any[]): any {
    return metadataItems.reduce((acc: any, m: any) => ({ ...acc, [m.key]: m.value }), {});
  }
}
