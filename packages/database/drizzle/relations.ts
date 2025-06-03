import { relations } from "drizzle-orm/relations";
import { organizations, users, subsidiaries, revenueRecognitionPatterns, products, contracts, contractSspAllocations, contractLineItems, revenueJournalEntries, performanceObligations, revenueSchedules, activityCodes, transactionLines, classes, departments, locations, taxCodes, unitsOfMeasure, entities, sspEvidence } from "./schema";

export const usersRelations = relations(users, ({one}) => ({
	organization: one(organizations, {
		fields: [users.organizationId],
		references: [organizations.id]
	}),
}));

export const organizationsRelations = relations(organizations, ({many}) => ({
	users: many(users),
	contracts: many(contracts),
}));

export const subsidiariesRelations = relations(subsidiaries, ({one, many}) => ({
	subsidiary: one(subsidiaries, {
		fields: [subsidiaries.parentId],
		references: [subsidiaries.id],
		relationName: "subsidiaries_parentId_subsidiaries_id"
	}),
	subsidiaries: many(subsidiaries, {
		relationName: "subsidiaries_parentId_subsidiaries_id"
	}),
}));

export const productsRelations = relations(products, ({one, many}) => ({
	revenueRecognitionPattern: one(revenueRecognitionPatterns, {
		fields: [products.defaultRecognitionPatternId],
		references: [revenueRecognitionPatterns.id]
	}),
	transactionLines: many(transactionLines),
	sspEvidences: many(sspEvidence),
	contractLineItems: many(contractLineItems),
}));

export const revenueRecognitionPatternsRelations = relations(revenueRecognitionPatterns, ({many}) => ({
	products: many(products),
}));

export const contractSspAllocationsRelations = relations(contractSspAllocations, ({one}) => ({
	contract: one(contracts, {
		fields: [contractSspAllocations.contractId],
		references: [contracts.id]
	}),
	contractLineItem: one(contractLineItems, {
		fields: [contractSspAllocations.lineItemId],
		references: [contractLineItems.id]
	}),
}));

export const contractsRelations = relations(contracts, ({one, many}) => ({
	contractSspAllocations: many(contractSspAllocations),
	revenueJournalEntries: many(revenueJournalEntries),
	entity: one(entities, {
		fields: [contracts.entityId],
		references: [entities.id]
	}),
	organization: one(organizations, {
		fields: [contracts.organizationId],
		references: [organizations.id]
	}),
	contractLineItems: many(contractLineItems),
}));

export const contractLineItemsRelations = relations(contractLineItems, ({one, many}) => ({
	contractSspAllocations: many(contractSspAllocations),
	performanceObligations: many(performanceObligations, {
		relationName: "performanceObligations_contractLineItemId_contractLineItems_id"
	}),
	contract: one(contracts, {
		fields: [contractLineItems.contractId],
		references: [contracts.id]
	}),
	performanceObligation: one(performanceObligations, {
		fields: [contractLineItems.performanceObligationId],
		references: [performanceObligations.id],
		relationName: "contractLineItems_performanceObligationId_performanceObligations_id"
	}),
	product: one(products, {
		fields: [contractLineItems.productId],
		references: [products.id]
	}),
}));

export const revenueJournalEntriesRelations = relations(revenueJournalEntries, ({one}) => ({
	contract: one(contracts, {
		fields: [revenueJournalEntries.contractId],
		references: [contracts.id]
	}),
	performanceObligation: one(performanceObligations, {
		fields: [revenueJournalEntries.performanceObligationId],
		references: [performanceObligations.id]
	}),
}));

export const performanceObligationsRelations = relations(performanceObligations, ({one, many}) => ({
	revenueJournalEntries: many(revenueJournalEntries),
	revenueSchedules: many(revenueSchedules),
	transactionLines: many(transactionLines),
	contractLineItem: one(contractLineItems, {
		fields: [performanceObligations.contractLineItemId],
		references: [contractLineItems.id],
		relationName: "performanceObligations_contractLineItemId_contractLineItems_id"
	}),
	contractLineItems: many(contractLineItems, {
		relationName: "contractLineItems_performanceObligationId_performanceObligations_id"
	}),
}));

export const revenueSchedulesRelations = relations(revenueSchedules, ({one}) => ({
	performanceObligation: one(performanceObligations, {
		fields: [revenueSchedules.performanceObligationId],
		references: [performanceObligations.id]
	}),
}));

export const transactionLinesRelations = relations(transactionLines, ({one, many}) => ({
	activityCode: one(activityCodes, {
		fields: [transactionLines.activityCodeId],
		references: [activityCodes.id]
	}),
	class: one(classes, {
		fields: [transactionLines.classId],
		references: [classes.id]
	}),
	department: one(departments, {
		fields: [transactionLines.departmentId],
		references: [departments.id]
	}),
	product: one(products, {
		fields: [transactionLines.itemId],
		references: [products.id]
	}),
	transactionLine: one(transactionLines, {
		fields: [transactionLines.linkedOrderLineId],
		references: [transactionLines.id],
		relationName: "transactionLines_linkedOrderLineId_transactionLines_id"
	}),
	transactionLines: many(transactionLines, {
		relationName: "transactionLines_linkedOrderLineId_transactionLines_id"
	}),
	location: one(locations, {
		fields: [transactionLines.locationId],
		references: [locations.id]
	}),
	performanceObligation: one(performanceObligations, {
		fields: [transactionLines.performanceObligationId],
		references: [performanceObligations.id]
	}),
	taxCode: one(taxCodes, {
		fields: [transactionLines.taxCodeId],
		references: [taxCodes.id]
	}),
	unitsOfMeasure: one(unitsOfMeasure, {
		fields: [transactionLines.unitsId],
		references: [unitsOfMeasure.id]
	}),
}));

export const activityCodesRelations = relations(activityCodes, ({many}) => ({
	transactionLines: many(transactionLines),
}));

export const classesRelations = relations(classes, ({many}) => ({
	transactionLines: many(transactionLines),
}));

export const departmentsRelations = relations(departments, ({many}) => ({
	transactionLines: many(transactionLines),
}));

export const locationsRelations = relations(locations, ({many}) => ({
	transactionLines: many(transactionLines),
}));

export const taxCodesRelations = relations(taxCodes, ({many}) => ({
	transactionLines: many(transactionLines),
}));

export const unitsOfMeasureRelations = relations(unitsOfMeasure, ({many}) => ({
	transactionLines: many(transactionLines),
}));

export const entitiesRelations = relations(entities, ({one, many}) => ({
	contracts: many(contracts),
	entity_parentEntityId: one(entities, {
		fields: [entities.parentEntityId],
		references: [entities.id],
		relationName: "entities_parentEntityId_entities_id"
	}),
	entities_parentEntityId: many(entities, {
		relationName: "entities_parentEntityId_entities_id"
	}),
	entity_primaryContactId: one(entities, {
		fields: [entities.primaryContactId],
		references: [entities.id],
		relationName: "entities_primaryContactId_entities_id"
	}),
	entities_primaryContactId: many(entities, {
		relationName: "entities_primaryContactId_entities_id"
	}),
}));

export const sspEvidenceRelations = relations(sspEvidence, ({one}) => ({
	product: one(products, {
		fields: [sspEvidence.productId],
		references: [products.id]
	}),
}));