/**
 * Inventory Valuation Service
 *
 * Provides inventory valuation reports including:
 * - On-hand quantities and costs per item/location
 * - Cost layer details for FIFO/LIFO tracking
 * - Valuation summaries by warehouse, subsidiary, or item category
 * - Export functionality for valuation reports
 */

import { eq, and, desc, asc, sql, inArray, isNull, or } from 'drizzle-orm';
import {
  itemCostLayers,
  items,
  locations,
  subsidiaries,
  itemCategories,
  type ItemCostLayerRecord,
  type CostingMethodValue,
} from '@glapi/database';
import { getDb } from '@glapi/database';
import { DatabaseType } from '@glapi/database';
import { ItemCostingConfigService, EffectiveCostingConfig } from './item-costing-config-service';

// Service context for multi-tenant operations
export interface ValuationServiceContext {
  organizationId: string;
  userId?: string;
}

// Single item valuation record
export interface ItemValuation {
  itemId: string;
  itemCode: string;
  itemName: string;
  subsidiaryId: string;
  subsidiaryName?: string;
  locationId?: string;
  locationName?: string;
  categoryId?: string;
  categoryName?: string;
  costingMethod: CostingMethodValue;
  quantityOnHand: number;
  unitCost: number;
  totalValue: number;
  layerCount: number;
  oldestLayerDate?: Date;
  newestLayerDate?: Date;
}

// Cost layer detail for reports
export interface CostLayerDetail {
  layerId: string;
  layerNumber: number;
  itemId: string;
  itemCode: string;
  itemName: string;
  subsidiaryId: string;
  locationId?: string;
  receiptDate: Date;
  transactionId?: string;
  transactionType?: string;
  documentNumber?: string;
  quantityReceived: number;
  quantityRemaining: number;
  quantityReserved: number;
  unitCost: number;
  totalCost: number;
  currencyCode: string;
  isFullyDepleted: boolean;
  depletedAt?: Date;
  lotNumber?: string;
  serialNumber?: string;
}

// Valuation summary for aggregated reports
export interface ValuationSummary {
  groupBy: 'subsidiary' | 'location' | 'category' | 'item';
  groupId: string;
  groupName: string;
  itemCount: number;
  totalQuantity: number;
  totalValue: number;
  averageUnitCost: number;
  layerCount: number;
}

// Report filters
export interface ValuationReportFilters {
  subsidiaryId?: string;
  locationId?: string;
  categoryId?: string;
  itemId?: string;
  itemIds?: string[];
  includeZeroQuantity?: boolean;
  asOfDate?: Date;
  costingMethod?: CostingMethodValue;
}

// Export format options
export type ExportFormat = 'json' | 'csv' | 'xlsx';

// Export result
export interface ExportResult {
  format: ExportFormat;
  data: string | Buffer;
  filename: string;
  mimeType: string;
  recordCount: number;
}

// Pagination options
export interface PaginationOptions {
  limit?: number;
  offset?: number;
  orderBy?: 'itemCode' | 'totalValue' | 'quantityOnHand';
  orderDirection?: 'asc' | 'desc';
}

// Report result with pagination
export interface ValuationReportResult {
  items: ItemValuation[];
  summary: {
    totalItems: number;
    totalQuantity: number;
    totalValue: number;
    averageUnitCost: number;
  };
  pagination: {
    limit: number;
    offset: number;
    hasMore: boolean;
  };
  asOfDate: Date;
  filters: ValuationReportFilters;
}

export class InventoryValuationService {
  private db: DatabaseType;
  private context: ValuationServiceContext;
  private costingService: ItemCostingConfigService;

  constructor(context: ValuationServiceContext) {
    this.db = getDb();
    this.context = context;
    this.costingService = new ItemCostingConfigService({
      organizationId: context.organizationId,
      userId: context.userId,
    });
  }

  // ========================================
  // Item Valuation Reports
  // ========================================

  /**
   * Get detailed valuation for items based on cost layers
   */
  async getItemValuations(
    filters: ValuationReportFilters = {},
    pagination: PaginationOptions = {}
  ): Promise<ValuationReportResult> {
    const { limit = 100, offset = 0, orderBy = 'itemCode', orderDirection = 'asc' } = pagination;
    const asOfDate = filters.asOfDate || new Date();

    // Build base query conditions
    const conditions: any[] = [
      eq(itemCostLayers.organizationId, this.context.organizationId),
    ];

    if (filters.subsidiaryId) {
      conditions.push(eq(itemCostLayers.subsidiaryId, filters.subsidiaryId));
    }
    if (filters.locationId) {
      conditions.push(eq(itemCostLayers.locationId, filters.locationId));
    }
    if (filters.itemId) {
      conditions.push(eq(itemCostLayers.itemId, filters.itemId));
    }
    if (filters.itemIds && filters.itemIds.length > 0) {
      conditions.push(inArray(itemCostLayers.itemId, filters.itemIds));
    }

    // Get aggregated cost layer data
    const layerData = await this.db
      .select({
        itemId: itemCostLayers.itemId,
        subsidiaryId: itemCostLayers.subsidiaryId,
        locationId: itemCostLayers.locationId,
        totalQuantity: sql<string>`SUM(CASE WHEN ${itemCostLayers.isFullyDepleted} = false THEN CAST(${itemCostLayers.quantityRemaining} AS DECIMAL) ELSE 0 END)`,
        totalValue: sql<string>`SUM(CASE WHEN ${itemCostLayers.isFullyDepleted} = false THEN CAST(${itemCostLayers.quantityRemaining} AS DECIMAL) * CAST(${itemCostLayers.unitCost} AS DECIMAL) ELSE 0 END)`,
        layerCount: sql<number>`COUNT(CASE WHEN ${itemCostLayers.isFullyDepleted} = false THEN 1 END)`,
        oldestLayerDate: sql<Date>`MIN(CASE WHEN ${itemCostLayers.isFullyDepleted} = false THEN ${itemCostLayers.receiptDate} END)`,
        newestLayerDate: sql<Date>`MAX(CASE WHEN ${itemCostLayers.isFullyDepleted} = false THEN ${itemCostLayers.receiptDate} END)`,
      })
      .from(itemCostLayers)
      .where(and(...conditions))
      .groupBy(
        itemCostLayers.itemId,
        itemCostLayers.subsidiaryId,
        itemCostLayers.locationId
      );

    // Filter out zero quantities if not requested
    const filteredData = filters.includeZeroQuantity
      ? layerData
      : layerData.filter((d) => Number(d.totalQuantity) > 0);

    // Get item and reference details
    const itemIds = [...new Set(filteredData.map((d) => d.itemId))];
    const subsidiaryIds = [...new Set(filteredData.map((d) => d.subsidiaryId))];
    const locationIds = [...new Set(filteredData.filter((d) => d.locationId).map((d) => d.locationId!))];

    // Fetch reference data
    const [itemsData, subsidiariesData, locationsData] = await Promise.all([
      itemIds.length > 0
        ? this.db.select().from(items).where(inArray(items.id, itemIds))
        : Promise.resolve([]),
      subsidiaryIds.length > 0
        ? this.db.select().from(subsidiaries).where(inArray(subsidiaries.id, subsidiaryIds))
        : Promise.resolve([]),
      locationIds.length > 0
        ? this.db.select().from(locations).where(inArray(locations.id, locationIds))
        : Promise.resolve([]),
    ]);

    // Create lookup maps
    const itemMap = new Map(itemsData.map((i) => [i.id, i]));
    const subsidiaryMap = new Map(subsidiariesData.map((s) => [s.id, s]));
    const locationMap = new Map(locationsData.map((l) => [l.id, l]));

    // Build valuation records
    const valuations: ItemValuation[] = await Promise.all(
      filteredData.map(async (data) => {
        const item = itemMap.get(data.itemId);
        const subsidiary = subsidiaryMap.get(data.subsidiaryId);
        const location = data.locationId ? locationMap.get(data.locationId) : undefined;

        // Get effective costing config
        const costingConfig = await this.costingService.getEffectiveConfig(
          data.itemId,
          data.subsidiaryId
        );

        const totalQuantity = Number(data.totalQuantity);
        const totalValue = Number(data.totalValue);

        return {
          itemId: data.itemId,
          itemCode: item?.itemCode || 'Unknown',
          itemName: item?.name || 'Unknown Item',
          subsidiaryId: data.subsidiaryId,
          subsidiaryName: subsidiary?.name,
          locationId: data.locationId || undefined,
          locationName: location?.name,
          categoryId: item?.categoryId || undefined,
          costingMethod: costingConfig.costingMethod,
          quantityOnHand: totalQuantity,
          unitCost: totalQuantity > 0 ? totalValue / totalQuantity : 0,
          totalValue,
          layerCount: Number(data.layerCount),
          oldestLayerDate: data.oldestLayerDate,
          newestLayerDate: data.newestLayerDate,
        };
      })
    );

    // Sort results
    const sorted = [...valuations].sort((a, b) => {
      let comparison = 0;
      switch (orderBy) {
        case 'totalValue':
          comparison = a.totalValue - b.totalValue;
          break;
        case 'quantityOnHand':
          comparison = a.quantityOnHand - b.quantityOnHand;
          break;
        case 'itemCode':
        default:
          comparison = a.itemCode.localeCompare(b.itemCode);
      }
      return orderDirection === 'desc' ? -comparison : comparison;
    });

    // Apply pagination
    const paginatedItems = sorted.slice(offset, offset + limit);

    // Calculate summary
    const totalQuantity = valuations.reduce((sum, v) => sum + v.quantityOnHand, 0);
    const totalValue = valuations.reduce((sum, v) => sum + v.totalValue, 0);

    return {
      items: paginatedItems,
      summary: {
        totalItems: valuations.length,
        totalQuantity,
        totalValue,
        averageUnitCost: totalQuantity > 0 ? totalValue / totalQuantity : 0,
      },
      pagination: {
        limit,
        offset,
        hasMore: offset + limit < valuations.length,
      },
      asOfDate,
      filters,
    };
  }

  /**
   * Get valuation for a single item across all locations
   */
  async getItemValuation(itemId: string): Promise<ItemValuation[]> {
    const result = await this.getItemValuations({ itemId });
    return result.items;
  }

  // ========================================
  // Cost Layer Details
  // ========================================

  /**
   * Get detailed cost layers for an item
   */
  async getCostLayers(
    itemId: string,
    options: {
      subsidiaryId?: string;
      locationId?: string;
      includeFullyDepleted?: boolean;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<CostLayerDetail[]> {
    const conditions: any[] = [
      eq(itemCostLayers.organizationId, this.context.organizationId),
      eq(itemCostLayers.itemId, itemId),
    ];

    if (options.subsidiaryId) {
      conditions.push(eq(itemCostLayers.subsidiaryId, options.subsidiaryId));
    }
    if (options.locationId) {
      conditions.push(eq(itemCostLayers.locationId, options.locationId));
    }
    if (!options.includeFullyDepleted) {
      conditions.push(eq(itemCostLayers.isFullyDepleted, false));
    }

    let query = this.db
      .select()
      .from(itemCostLayers)
      .where(and(...conditions))
      .orderBy(asc(itemCostLayers.layerNumber));

    if (options.limit) {
      query = query.limit(options.limit) as typeof query;
    }
    if (options.offset) {
      query = query.offset(options.offset) as typeof query;
    }

    const layers = await query;

    // Get item details
    const [item] = await this.db.select().from(items).where(eq(items.id, itemId));

    return layers.map((layer) => ({
      layerId: layer.id,
      layerNumber: layer.layerNumber,
      itemId: layer.itemId,
      itemCode: item?.itemCode || 'Unknown',
      itemName: item?.name || 'Unknown Item',
      subsidiaryId: layer.subsidiaryId,
      locationId: layer.locationId || undefined,
      receiptDate: layer.receiptDate,
      transactionId: layer.transactionId || undefined,
      transactionType: layer.transactionType || undefined,
      documentNumber: layer.documentNumber || undefined,
      quantityReceived: Number(layer.quantityReceived),
      quantityRemaining: Number(layer.quantityRemaining),
      quantityReserved: Number(layer.quantityReserved || 0),
      unitCost: Number(layer.unitCost),
      totalCost: Number(layer.totalCost),
      currencyCode: layer.currencyCode,
      isFullyDepleted: layer.isFullyDepleted,
      depletedAt: layer.depletedAt || undefined,
      lotNumber: layer.lotNumber || undefined,
      serialNumber: layer.serialNumber || undefined,
    }));
  }

  /**
   * Get all cost layers for reporting (with filtering)
   */
  async getAllCostLayers(
    filters: ValuationReportFilters = {},
    pagination: PaginationOptions = {}
  ): Promise<{ layers: CostLayerDetail[]; totalCount: number }> {
    const { limit = 100, offset = 0 } = pagination;

    const conditions: any[] = [
      eq(itemCostLayers.organizationId, this.context.organizationId),
    ];

    if (filters.subsidiaryId) {
      conditions.push(eq(itemCostLayers.subsidiaryId, filters.subsidiaryId));
    }
    if (filters.locationId) {
      conditions.push(eq(itemCostLayers.locationId, filters.locationId));
    }
    if (filters.itemId) {
      conditions.push(eq(itemCostLayers.itemId, filters.itemId));
    }
    if (filters.itemIds && filters.itemIds.length > 0) {
      conditions.push(inArray(itemCostLayers.itemId, filters.itemIds));
    }
    if (!filters.includeZeroQuantity) {
      conditions.push(eq(itemCostLayers.isFullyDepleted, false));
    }

    // Get total count
    const [countResult] = await this.db
      .select({ count: sql<number>`COUNT(*)` })
      .from(itemCostLayers)
      .where(and(...conditions));

    const totalCount = countResult?.count || 0;

    // Get layers with pagination
    const layers = await this.db
      .select()
      .from(itemCostLayers)
      .where(and(...conditions))
      .orderBy(asc(itemCostLayers.itemId), asc(itemCostLayers.layerNumber))
      .limit(limit)
      .offset(offset);

    // Get item details
    const itemIds = [...new Set(layers.map((l) => l.itemId))];
    const itemsData = itemIds.length > 0
      ? await this.db.select().from(items).where(inArray(items.id, itemIds))
      : [];
    const itemMap = new Map(itemsData.map((i) => [i.id, i]));

    const details: CostLayerDetail[] = layers.map((layer) => {
      const item = itemMap.get(layer.itemId);
      return {
        layerId: layer.id,
        layerNumber: layer.layerNumber,
        itemId: layer.itemId,
        itemCode: item?.itemCode || 'Unknown',
        itemName: item?.name || 'Unknown Item',
        subsidiaryId: layer.subsidiaryId,
        locationId: layer.locationId || undefined,
        receiptDate: layer.receiptDate,
        transactionId: layer.transactionId || undefined,
        transactionType: layer.transactionType || undefined,
        documentNumber: layer.documentNumber || undefined,
        quantityReceived: Number(layer.quantityReceived),
        quantityRemaining: Number(layer.quantityRemaining),
        quantityReserved: Number(layer.quantityReserved || 0),
        unitCost: Number(layer.unitCost),
        totalCost: Number(layer.totalCost),
        currencyCode: layer.currencyCode,
        isFullyDepleted: layer.isFullyDepleted,
        depletedAt: layer.depletedAt || undefined,
        lotNumber: layer.lotNumber || undefined,
        serialNumber: layer.serialNumber || undefined,
      };
    });

    return { layers: details, totalCount };
  }

  // ========================================
  // Valuation Summaries
  // ========================================

  /**
   * Get valuation summary grouped by a dimension
   */
  async getValuationSummary(
    groupBy: 'subsidiary' | 'location' | 'category',
    filters: ValuationReportFilters = {}
  ): Promise<ValuationSummary[]> {
    const conditions: any[] = [
      eq(itemCostLayers.organizationId, this.context.organizationId),
      eq(itemCostLayers.isFullyDepleted, false),
    ];

    if (filters.subsidiaryId) {
      conditions.push(eq(itemCostLayers.subsidiaryId, filters.subsidiaryId));
    }
    if (filters.locationId) {
      conditions.push(eq(itemCostLayers.locationId, filters.locationId));
    }

    let groupField: any;
    switch (groupBy) {
      case 'subsidiary':
        groupField = itemCostLayers.subsidiaryId;
        break;
      case 'location':
        groupField = itemCostLayers.locationId;
        break;
      case 'category':
        // Need to join with items to get category
        groupField = items.categoryId;
        break;
    }

    let query;
    if (groupBy === 'category') {
      query = this.db
        .select({
          groupId: items.categoryId,
          itemCount: sql<number>`COUNT(DISTINCT ${itemCostLayers.itemId})`,
          totalQuantity: sql<string>`SUM(CAST(${itemCostLayers.quantityRemaining} AS DECIMAL))`,
          totalValue: sql<string>`SUM(CAST(${itemCostLayers.quantityRemaining} AS DECIMAL) * CAST(${itemCostLayers.unitCost} AS DECIMAL))`,
          layerCount: sql<number>`COUNT(*)`,
        })
        .from(itemCostLayers)
        .innerJoin(items, eq(itemCostLayers.itemId, items.id))
        .where(and(...conditions))
        .groupBy(items.categoryId);
    } else {
      query = this.db
        .select({
          groupId: groupField,
          itemCount: sql<number>`COUNT(DISTINCT ${itemCostLayers.itemId})`,
          totalQuantity: sql<string>`SUM(CAST(${itemCostLayers.quantityRemaining} AS DECIMAL))`,
          totalValue: sql<string>`SUM(CAST(${itemCostLayers.quantityRemaining} AS DECIMAL) * CAST(${itemCostLayers.unitCost} AS DECIMAL))`,
          layerCount: sql<number>`COUNT(*)`,
        })
        .from(itemCostLayers)
        .where(and(...conditions))
        .groupBy(groupField);
    }

    const results = await query;

    // Get names for the groups
    const groupIds = results.filter((r) => r.groupId).map((r) => r.groupId as string);

    let nameMap: Map<string, string> = new Map();
    if (groupIds.length > 0) {
      switch (groupBy) {
        case 'subsidiary': {
          const subs = await this.db.select().from(subsidiaries).where(inArray(subsidiaries.id, groupIds));
          nameMap = new Map(subs.map((s) => [s.id, s.name]));
          break;
        }
        case 'location': {
          const locs = await this.db.select().from(locations).where(inArray(locations.id, groupIds));
          nameMap = new Map(locs.map((l) => [l.id, l.name]));
          break;
        }
        case 'category': {
          const cats = await this.db.select().from(itemCategories).where(inArray(itemCategories.id, groupIds));
          nameMap = new Map(cats.map((c) => [c.id, c.name]));
          break;
        }
      }
    }

    return results
      .filter((r) => r.groupId) // Filter out null groups
      .map((r) => {
        const totalQuantity = Number(r.totalQuantity);
        const totalValue = Number(r.totalValue);
        return {
          groupBy,
          groupId: r.groupId as string,
          groupName: nameMap.get(r.groupId as string) || 'Unknown',
          itemCount: Number(r.itemCount),
          totalQuantity,
          totalValue,
          averageUnitCost: totalQuantity > 0 ? totalValue / totalQuantity : 0,
          layerCount: Number(r.layerCount),
        };
      });
  }

  /**
   * Get overall inventory valuation totals
   */
  async getTotalValuation(filters: ValuationReportFilters = {}): Promise<{
    totalItems: number;
    totalQuantity: number;
    totalValue: number;
    averageUnitCost: number;
    totalLayers: number;
    asOfDate: Date;
  }> {
    const conditions: any[] = [
      eq(itemCostLayers.organizationId, this.context.organizationId),
      eq(itemCostLayers.isFullyDepleted, false),
    ];

    if (filters.subsidiaryId) {
      conditions.push(eq(itemCostLayers.subsidiaryId, filters.subsidiaryId));
    }
    if (filters.locationId) {
      conditions.push(eq(itemCostLayers.locationId, filters.locationId));
    }

    const [result] = await this.db
      .select({
        totalItems: sql<number>`COUNT(DISTINCT ${itemCostLayers.itemId})`,
        totalQuantity: sql<string>`COALESCE(SUM(CAST(${itemCostLayers.quantityRemaining} AS DECIMAL)), 0)`,
        totalValue: sql<string>`COALESCE(SUM(CAST(${itemCostLayers.quantityRemaining} AS DECIMAL) * CAST(${itemCostLayers.unitCost} AS DECIMAL)), 0)`,
        totalLayers: sql<number>`COUNT(*)`,
      })
      .from(itemCostLayers)
      .where(and(...conditions));

    const totalQuantity = Number(result?.totalQuantity || 0);
    const totalValue = Number(result?.totalValue || 0);

    return {
      totalItems: Number(result?.totalItems || 0),
      totalQuantity,
      totalValue,
      averageUnitCost: totalQuantity > 0 ? totalValue / totalQuantity : 0,
      totalLayers: Number(result?.totalLayers || 0),
      asOfDate: filters.asOfDate || new Date(),
    };
  }

  // ========================================
  // Export Functionality
  // ========================================

  /**
   * Export valuation report to specified format
   */
  async exportValuationReport(
    filters: ValuationReportFilters = {},
    format: ExportFormat = 'csv'
  ): Promise<ExportResult> {
    // Get all data without pagination for export
    const result = await this.getItemValuations(filters, { limit: 10000, offset: 0 });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    let data: string | Buffer;
    let filename: string;
    let mimeType: string;

    switch (format) {
      case 'json':
        data = JSON.stringify(result, null, 2);
        filename = `inventory-valuation-${timestamp}.json`;
        mimeType = 'application/json';
        break;

      case 'csv':
        data = this.convertToCSV(result.items);
        filename = `inventory-valuation-${timestamp}.csv`;
        mimeType = 'text/csv';
        break;

      case 'xlsx':
        // For XLSX, we return CSV data and let the API layer convert it
        // In a full implementation, you'd use a library like xlsx
        data = this.convertToCSV(result.items);
        filename = `inventory-valuation-${timestamp}.csv`;
        mimeType = 'text/csv';
        break;

      default:
        throw new Error(`Unsupported export format: ${format}`);
    }

    return {
      format,
      data,
      filename,
      mimeType,
      recordCount: result.items.length,
    };
  }

  /**
   * Export cost layer details to specified format
   */
  async exportCostLayers(
    filters: ValuationReportFilters = {},
    format: ExportFormat = 'csv'
  ): Promise<ExportResult> {
    const { layers } = await this.getAllCostLayers(filters, { limit: 10000 });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    let data: string | Buffer;
    let filename: string;
    let mimeType: string;

    switch (format) {
      case 'json':
        data = JSON.stringify(layers, null, 2);
        filename = `cost-layers-${timestamp}.json`;
        mimeType = 'application/json';
        break;

      case 'csv':
        data = this.convertLayersToCSV(layers);
        filename = `cost-layers-${timestamp}.csv`;
        mimeType = 'text/csv';
        break;

      default:
        data = this.convertLayersToCSV(layers);
        filename = `cost-layers-${timestamp}.csv`;
        mimeType = 'text/csv';
    }

    return {
      format,
      data,
      filename,
      mimeType,
      recordCount: layers.length,
    };
  }

  // ========================================
  // Helper Methods
  // ========================================

  private convertToCSV(items: ItemValuation[]): string {
    const headers = [
      'Item Code',
      'Item Name',
      'Subsidiary',
      'Location',
      'Category',
      'Costing Method',
      'Quantity On Hand',
      'Unit Cost',
      'Total Value',
      'Layer Count',
      'Oldest Layer Date',
      'Newest Layer Date',
    ];

    const rows = items.map((item) => [
      this.escapeCSV(item.itemCode),
      this.escapeCSV(item.itemName),
      this.escapeCSV(item.subsidiaryName || ''),
      this.escapeCSV(item.locationName || ''),
      this.escapeCSV(item.categoryName || ''),
      item.costingMethod,
      item.quantityOnHand.toFixed(4),
      item.unitCost.toFixed(4),
      item.totalValue.toFixed(2),
      item.layerCount.toString(),
      item.oldestLayerDate?.toISOString() || '',
      item.newestLayerDate?.toISOString() || '',
    ]);

    return [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
  }

  private convertLayersToCSV(layers: CostLayerDetail[]): string {
    const headers = [
      'Layer Number',
      'Item Code',
      'Item Name',
      'Receipt Date',
      'Document Number',
      'Transaction Type',
      'Quantity Received',
      'Quantity Remaining',
      'Quantity Reserved',
      'Unit Cost',
      'Total Cost',
      'Currency',
      'Lot Number',
      'Serial Number',
      'Is Depleted',
      'Depleted At',
    ];

    const rows = layers.map((layer) => [
      layer.layerNumber.toString(),
      this.escapeCSV(layer.itemCode),
      this.escapeCSV(layer.itemName),
      layer.receiptDate.toISOString(),
      this.escapeCSV(layer.documentNumber || ''),
      this.escapeCSV(layer.transactionType || ''),
      layer.quantityReceived.toFixed(4),
      layer.quantityRemaining.toFixed(4),
      layer.quantityReserved.toFixed(4),
      layer.unitCost.toFixed(4),
      layer.totalCost.toFixed(2),
      layer.currencyCode,
      this.escapeCSV(layer.lotNumber || ''),
      this.escapeCSV(layer.serialNumber || ''),
      layer.isFullyDepleted ? 'Yes' : 'No',
      layer.depletedAt?.toISOString() || '',
    ]);

    return [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
  }

  private escapeCSV(value: string): string {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }
}
