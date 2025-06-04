"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.performanceObligationRelations = exports.performanceObligations = exports.performanceObligationStatusEnum = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
const drizzle_orm_1 = require("drizzle-orm");
const contract_line_items_1 = require("./contract_line_items"); // Assuming this is the correct file for contract line items
const transactionLines_1 = require("./transactionLines"); // For relation back from POBs to transaction lines
exports.performanceObligationStatusEnum = (0, pg_core_1.pgEnum)('performance_obligation_status_enum', [
    'Pending',
    'InProcess',
    'Fulfilled',
    'PartiallyFulfilled',
    'Cancelled',
]);
exports.performanceObligations = (0, pg_core_1.pgTable)('performance_obligations', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    contractLineItemId: (0, pg_core_1.uuid)('contract_line_item_id').notNull().references(() => contract_line_items_1.contractLineItems.id),
    name: (0, pg_core_1.varchar)('name', { length: 255 }).notNull(),
    description: (0, pg_core_1.text)('description'),
    ssp: (0, pg_core_1.decimal)('ssp', { precision: 14, scale: 2 }).notNull(),
    allocatedTransactionPrice: (0, pg_core_1.decimal)('allocated_transaction_price', { precision: 14, scale: 2 }),
    revenueRecognized: (0, pg_core_1.decimal)('revenue_recognized', { precision: 14, scale: 2 }).default('0'),
    status: (0, exports.performanceObligationStatusEnum)('status').default('Pending'),
    fulfillmentDate: (0, pg_core_1.timestamp)('fulfillment_date', { withTimezone: true }),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at', { withTimezone: true }).defaultNow(),
});
exports.performanceObligationRelations = (0, drizzle_orm_1.relations)(exports.performanceObligations, ({ one, many }) => ({
    contractLineItem: one(contract_line_items_1.contractLineItems, {
        fields: [exports.performanceObligations.contractLineItemId],
        references: [contract_line_items_1.contractLineItems.id],
    }),
    transactionLines: many(transactionLines_1.transactionLines), // Each POB can be on many transaction lines (e.g., for billing schedules)
}));
//# sourceMappingURL=performanceObligations.js.map