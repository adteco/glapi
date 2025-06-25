import { pgTable, uuid, integer, decimal, text, boolean, jsonb, AnyPgColumn } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
// import { transactions } from './transactions'; // Will be created - Will uncomment later
import { products } from './products';
import { unitsOfMeasure } from './unitsOfMeasure';
import { departments } from './departments';
import { classes } from './classes';
import { locations } from './locations';
import { activityCodes } from './activityCodes';
import { costEstimateTypeEnum } from './enums';
import { performanceObligations } from './performanceObligations';
import { taxCodes } from './taxCodes';
// import { timeEntries } from './timeEntries'; // For relation from transactionLines to timeEntries if needed (e.g. if a line groups multiple time entries)

export const transactionLines = pgTable('transaction_lines', {
  id: uuid('id').primaryKey().defaultRandom(),
  transactionId: uuid('transaction_id').notNull(), // .references(() => transactions.id) - Will uncomment when transactions.ts exists
  lineNumber: integer('line_number').notNull(),
  itemId: uuid('item_id').notNull().references(() => products.id),
  quantity: decimal('quantity', { precision: 12, scale: 4 }).notNull(),
  unitsId: uuid('units_id').references(() => unitsOfMeasure.id),
  rate: decimal('rate', { precision: 14, scale: 4 }).notNull(),
  amount: decimal('amount', { precision: 14, scale: 2 }).notNull(), // quantity * rate
  description: text('description'),
  departmentId: uuid('department_id').references(() => departments.id),
  classId: uuid('class_id').references(() => classes.id),
  locationId: uuid('location_id').references(() => locations.id),
  activityCodeId: uuid('activity_code_id').references(() => activityCodes.id),
  unitCost: decimal('unit_cost', { precision: 14, scale: 4 }),
  costEstimateType: costEstimateTypeEnum('cost_estimate_type'),
  ssp: decimal('ssp', { precision: 14, scale: 2 }),
  allocatedTransactionPrice: decimal('allocated_transaction_price', { precision: 14, scale: 2 }),
  performanceObligationId: uuid('performance_obligation_id').references(() => performanceObligations.id),
  isTaxable: boolean('is_taxable').default(true),
  taxCodeId: uuid('tax_code_id').references(() => taxCodes.id),
  taxAmount: decimal('tax_amount', { precision: 12, scale: 2 }).default('0'),
  discountAmount: decimal('discount_amount', { precision: 12, scale: 2 }).default('0'),
  grossAmount: decimal('gross_amount', { precision: 14, scale: 2 }).notNull().default('0'), // amount - discount + tax
  linkedOrderLineId: uuid('linked_order_line_id').references((): AnyPgColumn => transactionLines.id), // Self-ref for linking Invoice/Fulfillment lines to SO lines
  customFields: jsonb('custom_fields'),
});

export const transactionLineRelations = relations(transactionLines, ({ one, many }) => ({
  // transaction: one(transactions, { // Will uncomment when transactions.ts exists
  //   fields: [transactionLines.transactionId],
  //   references: [transactions.id],
  // }),
  product: one(products, {
    fields: [transactionLines.itemId],
    references: [products.id],
  }),
  department: one(departments, {
    fields: [transactionLines.departmentId],
    references: [departments.id],
  }),
  class: one(classes, {
    fields: [transactionLines.classId],
    references: [classes.id],
  }),
  location: one(locations, {
    fields: [transactionLines.locationId],
    references: [locations.id],
  }),
  activityCode: one(activityCodes, {
      fields: [transactionLines.activityCodeId],
      references: [activityCodes.id]
  }),
  units: one(unitsOfMeasure, {
    fields: [transactionLines.unitsId],
    references: [unitsOfMeasure.id],
  }),
  taxCode: one(taxCodes, {
    fields: [transactionLines.taxCodeId],
    references: [taxCodes.id],
  }),
  performanceObligation: one(performanceObligations, {
    fields: [transactionLines.performanceObligationId],
    references: [performanceObligations.id],
  }),
  linkedOrderLine: one(transactionLines, {
    fields: [transactionLines.linkedOrderLineId],
    references: [transactionLines.id],
    relationName: 'linkedOrderLineRelation'
  }),
  // timeEntries: many(timeEntries) // If timeEntries has an invoiceLineId - Will uncomment later
})); 