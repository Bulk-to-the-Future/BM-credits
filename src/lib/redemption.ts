import { BulkMetadataManager, groupLinesByProduct } from "./bulk-metadata";

export class RedemptionManager {
  static calculatePooledRedemption(lines: any[], redemptions: Map<string, number>) {
    const groups: { [key: string]: any[] } = groupLinesByProduct(lines);
    const updatedMetadata = new Map<string, any>();

    for (const [productId, groupLines] of Object.entries(groups)) {
      const bulkLines = groupLines.filter((line: any) =>
        BulkMetadataManager.parseMetadata(line.privateMetadata).bulk_pack === "true"
      );

      if (bulkLines.length === 0) continue;

      // Compute total to deduct for group
      let totalToDeduct = 0;
      bulkLines.forEach((line: any) => {
        totalToDeduct += redemptions.get(line.id) || 0;
      });

      // Sort by bulk_deadline (earliest first) for FIFO
      bulkLines.sort((a: any, b: any) => {
        const metaA = BulkMetadataManager.parseMetadata(a.privateMetadata);
        const metaB = BulkMetadataManager.parseMetadata(b.privateMetadata);
        return new Date(metaA.bulk_deadline).getTime() - new Date(metaB.bulk_deadline).getTime();
      });

      let remainingToDeduct = totalToDeduct;
      const internals = new Map<string, number>();

      bulkLines.forEach((line: any) => {
        const meta = BulkMetadataManager.parseMetadata(line.privateMetadata);
        let currentInternal = parseInt(meta.bulk_internal_remaining || meta.bulk_quantity);

        if (currentInternal > 0 && remainingToDeduct > 0) {
          const deduct = Math.min(currentInternal, remainingToDeduct);
          currentInternal -= deduct;
          remainingToDeduct -= deduct;
        }

        internals.set(line.id, currentInternal);
      });

      if (remainingToDeduct > 0) {
        console.error(`Insufficient bulk remaining for product ${productId}`);
        // Could trigger notification, but continue
      }

      // Compute new pooled remaining and min deadline
      const newTotalRemaining = Array.from(internals.values()).reduce((sum, val) => sum + val, 0);
      const deadlines = bulkLines
        .map((line: any) => new Date(BulkMetadataManager.parseMetadata(line.privateMetadata).bulk_deadline))
        .filter((dl) => !isNaN(dl.getTime()));
      const minDeadline = deadlines.length > 0 ? new Date(Math.min(...deadlines.map((d) => d.getTime()))) : new Date();

      bulkLines.forEach((line: any) => {
        const meta = BulkMetadataManager.parseMetadata(line.privateMetadata);
        const newInternal = internals.get(line.id) || 0;
        updatedMetadata.set(line.id, {
          ...meta,
          bulk_internal_remaining: newInternal.toString(),
          bulk_remaining: newTotalRemaining.toString(),
          bulk_deadline: minDeadline.toISOString(),
        });
      });
    }

    return updatedMetadata;
  }
}