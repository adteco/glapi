"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.contractLineItems = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
const contracts_1 = require("./contracts");
const products_1 = require("./products");
const performance_obligations_1 = require("./performance_obligations");
exports.contractLineItems = (0, pg_core_1.pgTable)("contract_line_items", {
    id: (0, pg_core_1.uuid)("id").defaultRandom().primaryKey(),
    contractId: (0, pg_core_1.uuid)("contract_id").references(() => contracts_1.contracts.id).notNull(),
    productId: (0, pg_core_1.uuid)("product_id").references(() => products_1.products.id).notNull(),
    lineItemNumber: (0, pg_core_1.integer)("line_item_number").notNull(),
    description: (0, pg_core_1.text)("description"),
    quantity: (0, pg_core_1.decimal)("quantity", { precision: 10, scale: 2 }).notNull().default("1"),
    listPrice: (0, pg_core_1.decimal)("list_price", { precision: 12, scale: 2 }).notNull(),
    discountPercent: (0, pg_core_1.decimal)("discount_percent", { precision: 5, scale: 2 }).default("0"),
    totalPrice: (0, pg_core_1.decimal)("total_price", { precision: 12, scale: 2 }).notNull(),
    ssp: (0, pg_core_1.decimal)("ssp", { precision: 12, scale: 2 }),
    allocatedTransactionPrice: (0, pg_core_1.decimal)("allocated_transaction_price", { precision: 12, scale: 2 }),
    performanceObligationId: (0, pg_core_1.uuid)("performance_obligation_id").references(() => performance_obligations_1.performanceObligations.id),
    createdAt: (0, pg_core_1.timestamp)("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at", { withTimezone: true }).defaultNow()
});
//# sourceMappingURL=contract_line_items.js.map