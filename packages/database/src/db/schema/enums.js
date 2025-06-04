"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.accountCategoryEnum = exports.timeEntryBilledStatusEnum = exports.jobStatusEnum = exports.costEstimateTypeEnum = exports.entityTypeEnum = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
// Enum for entity types
exports.entityTypeEnum = (0, pg_core_1.pgEnum)('entity_type_enum', [
    'Customer',
    'Vendor',
    'Employee',
    'Partner',
    'Lead',
    'Prospect',
    'Contact',
]);
// Enum for cost estimate types, used in transaction lines
exports.costEstimateTypeEnum = (0, pg_core_1.pgEnum)('cost_estimate_type_enum', [
    'Estimated', // Cost is an estimate
    'Actual', // Cost is actual
    'Derived', // Cost is derived from other sources or calculations
    'None', // No cost applicable or not yet determined
]);
// Enum for Job Statuses (from original jobStatuses.ts)
exports.jobStatusEnum = (0, pg_core_1.pgEnum)('job_status_enum', [
    'Planning',
    'InProgress',
    'OnHold',
    'Completed',
    'Billed',
    'Cancelled',
]);
// Enum for Time Entry Billed Status (from original timeEntries.ts reference)
exports.timeEntryBilledStatusEnum = (0, pg_core_1.pgEnum)('time_entry_billed_status_enum', [
    'NotBilled',
    'Billed',
    'NonBillable',
]);
// Enum for Account Categories for General Ledger
exports.accountCategoryEnum = (0, pg_core_1.pgEnum)('account_category_enum', [
    'Asset',
    'Liability',
    'Equity',
    'Revenue',
    'COGS', // Cost of Goods Sold
    'Expense',
]);
// Add other shared enums here as your schema evolves 
//# sourceMappingURL=enums.js.map