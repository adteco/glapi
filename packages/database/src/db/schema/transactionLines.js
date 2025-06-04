"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.transactionLineRelations = exports.transactionLines = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
const drizzle_orm_1 = require("drizzle-orm");
// import { transactions } from './transactions'; // Will be created - Will uncomment later
const products_1 = require("./products");
const unitsOfMeasure_1 = require("./unitsOfMeasure");
const departments_1 = require("./departments");
const classes_1 = require("./classes");
const locations_1 = require("./locations");
const activityCodes_1 = require("./activityCodes");
const enums_1 = require("./enums");
const performanceObligations_1 = require("./performanceObligations");
const taxCodes_1 = require("./taxCodes");
// import { timeEntries } from './timeEntries'; // For relation from transactionLines to timeEntries if needed (e.g. if a line groups multiple time entries)
exports.transactionLines = (0, pg_core_1.pgTable)('transaction_lines', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    transactionId: (0, pg_core_1.uuid)('transaction_id').notNull(), // .references(() => transactions.id) - Will uncomment when transactions.ts exists
    lineNumber: (0, pg_core_1.integer)('line_number').notNull(),
    itemId: (0, pg_core_1.uuid)('item_id').notNull().references(() => products_1.products.id),
    quantity: (0, pg_core_1.decimal)('quantity', { precision: 12, scale: 4 }).notNull(),
    unitsId: (0, pg_core_1.uuid)('units_id').references(() => unitsOfMeasure_1.unitsOfMeasure.id),
    rate: (0, pg_core_1.decimal)('rate', { precision: 14, scale: 4 }).notNull(),
    amount: (0, pg_core_1.decimal)('amount', { precision: 14, scale: 2 }).notNull(), // quantity * rate
    description: (0, pg_core_1.text)('description'),
    departmentId: (0, pg_core_1.uuid)('department_id').references(() => departments_1.departments.id),
    classId: (0, pg_core_1.uuid)('class_id').references(() => classes_1.classes.id),
    locationId: (0, pg_core_1.uuid)('location_id').references(() => locations_1.locations.id),
    activityCodeId: (0, pg_core_1.uuid)('activity_code_id').references(() => activityCodes_1.activityCodes.id),
    unitCost: (0, pg_core_1.decimal)('unit_cost', { precision: 14, scale: 4 }),
    costEstimateType: (0, enums_1.costEstimateTypeEnum)('cost_estimate_type'),
    ssp: (0, pg_core_1.decimal)('ssp', { precision: 14, scale: 2 }),
    allocatedTransactionPrice: (0, pg_core_1.decimal)('allocated_transaction_price', { precision: 14, scale: 2 }),
    performanceObligationId: (0, pg_core_1.uuid)('performance_obligation_id').references(() => performanceObligations_1.performanceObligations.id),
    isTaxable: (0, pg_core_1.boolean)('is_taxable').default(true),
    taxCodeId: (0, pg_core_1.uuid)('tax_code_id').references(() => taxCodes_1.taxCodes.id),
    taxAmount: (0, pg_core_1.decimal)('tax_amount', { precision: 12, scale: 2 }).default('0'),
    discountAmount: (0, pg_core_1.decimal)('discount_amount', { precision: 12, scale: 2 }).default('0'),
    grossAmount: (0, pg_core_1.decimal)('gross_amount', { precision: 14, scale: 2 }).notNull().default('0'), // amount - discount + tax
    linkedOrderLineId: (0, pg_core_1.uuid)('linked_order_line_id').references(() => exports.transactionLines.id), // Self-ref for linking Invoice/Fulfillment lines to SO lines
    customFields: (0, pg_core_1.jsonb)('custom_fields'),
});
exports.transactionLineRelations = (0, drizzle_orm_1.relations)(exports.transactionLines, ({ one, many }) => ({
    // transaction: one(transactions, { // Will uncomment when transactions.ts exists
    //   fields: [transactionLines.transactionId],
    //   references: [transactions.id],
    // }),
    product: one(products_1.products, {
        fields: [exports.transactionLines.itemId],
        references: [products_1.products.id],
    }),
    department: one(departments_1.departments, {
        fields: [exports.transactionLines.departmentId],
        references: [departments_1.departments.id],
    }),
    class: one(classes_1.classes, {
        fields: [exports.transactionLines.classId],
        references: [classes_1.classes.id],
    }),
    location: one(locations_1.locations, {
        fields: [exports.transactionLines.locationId],
        references: [locations_1.locations.id],
    }),
    activityCode: one(activityCodes_1.activityCodes, {
        fields: [exports.transactionLines.activityCodeId],
        references: [activityCodes_1.activityCodes.id]
    }),
    units: one(unitsOfMeasure_1.unitsOfMeasure, {
        fields: [exports.transactionLines.unitsId],
        references: [unitsOfMeasure_1.unitsOfMeasure.id],
    }),
    taxCode: one(taxCodes_1.taxCodes, {
        fields: [exports.transactionLines.taxCodeId],
        references: [taxCodes_1.taxCodes.id],
    }),
    performanceObligation: one(performanceObligations_1.performanceObligations, {
        fields: [exports.transactionLines.performanceObligationId],
        references: [performanceObligations_1.performanceObligations.id],
    }),
    linkedOrderLine: one(exports.transactionLines, {
        fields: [exports.transactionLines.linkedOrderLineId],
        references: [exports.transactionLines.id],
        relationName: 'linkedOrderLineRelation'
    }),
    // timeEntries: many(timeEntries) // If timeEntries has an invoiceLineId - Will uncomment later
}));
//# sourceMappingURL=transactionLines.js.map