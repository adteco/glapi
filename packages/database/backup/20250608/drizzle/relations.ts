import { relations } from "drizzle-orm/relations";
import { users, accountingPeriods, glPostingRules, transactionTypes, glAccountBalances, glAuditTrail, glTransactions, businessTransactions, organizations, accounts, businessTransactionLines, activityCodes, classes, departments, entities, products, locations, taxCodes, paymentTerms, subsidiaries, glTransactionLines, transactionRelationships, addresses, revenueRecognitionPatterns, contracts, contractSspAllocations, contractLineItems, revenueJournalEntries, performanceObligations, revenueSchedules, transactionLines, unitsOfMeasure, sspEvidence, permissions, rolePermissions, roles, userSubsidiaryAccess, userRoles } from "./schema";

export const accountingPeriodsRelations = relations(accountingPeriods, ({one, many}) => ({
	user: one(users, {
		fields: [accountingPeriods.closedBy],
		references: [users.id]
	}),
	glAccountBalances: many(glAccountBalances),
	glTransactions: many(glTransactions),
}));

export const usersRelations = relations(users, ({one, many}) => ({
	accountingPeriods: many(accountingPeriods),
	glPostingRules: many(glPostingRules),
	glAuditTrails: many(glAuditTrail),
	glTransactions_createdBy: many(glTransactions, {
		relationName: "glTransactions_createdBy_users_id"
	}),
	glTransactions_modifiedBy: many(glTransactions, {
		relationName: "glTransactions_modifiedBy_users_id"
	}),
	glTransactions_postedBy: many(glTransactions, {
		relationName: "glTransactions_postedBy_users_id"
	}),
	organization: one(organizations, {
		fields: [users.organizationId],
		references: [organizations.id]
	}),
	businessTransactions_approvedBy: many(businessTransactions, {
		relationName: "businessTransactions_approvedBy_users_id"
	}),
	businessTransactions_createdBy: many(businessTransactions, {
		relationName: "businessTransactions_createdBy_users_id"
	}),
	businessTransactions_modifiedBy: many(businessTransactions, {
		relationName: "businessTransactions_modifiedBy_users_id"
	}),
	userSubsidiaryAccesses_grantedBy: many(userSubsidiaryAccess, {
		relationName: "userSubsidiaryAccess_grantedBy_users_id"
	}),
	userSubsidiaryAccesses_userId: many(userSubsidiaryAccess, {
		relationName: "userSubsidiaryAccess_userId_users_id"
	}),
	userRoles_grantedBy: many(userRoles, {
		relationName: "userRoles_grantedBy_users_id"
	}),
	userRoles_userId: many(userRoles, {
		relationName: "userRoles_userId_users_id"
	}),
}));

export const glPostingRulesRelations = relations(glPostingRules, ({one}) => ({
	user: one(users, {
		fields: [glPostingRules.createdBy],
		references: [users.id]
	}),
	transactionType: one(transactionTypes, {
		fields: [glPostingRules.transactionTypeId],
		references: [transactionTypes.id]
	}),
}));

export const transactionTypesRelations = relations(transactionTypes, ({many}) => ({
	glPostingRules: many(glPostingRules),
	businessTransactions: many(businessTransactions),
}));

export const glAccountBalancesRelations = relations(glAccountBalances, ({one}) => ({
	accountingPeriod: one(accountingPeriods, {
		fields: [glAccountBalances.periodId],
		references: [accountingPeriods.id]
	}),
}));

export const glAuditTrailRelations = relations(glAuditTrail, ({one}) => ({
	user: one(users, {
		fields: [glAuditTrail.userId],
		references: [users.id]
	}),
}));

export const glTransactionsRelations = relations(glTransactions, ({one, many}) => ({
	user_createdBy: one(users, {
		fields: [glTransactions.createdBy],
		references: [users.id],
		relationName: "glTransactions_createdBy_users_id"
	}),
	user_modifiedBy: one(users, {
		fields: [glTransactions.modifiedBy],
		references: [users.id],
		relationName: "glTransactions_modifiedBy_users_id"
	}),
	accountingPeriod: one(accountingPeriods, {
		fields: [glTransactions.periodId],
		references: [accountingPeriods.id]
	}),
	user_postedBy: one(users, {
		fields: [glTransactions.postedBy],
		references: [users.id],
		relationName: "glTransactions_postedBy_users_id"
	}),
	glTransaction: one(glTransactions, {
		fields: [glTransactions.reversedByTransactionId],
		references: [glTransactions.id],
		relationName: "glTransactions_reversedByTransactionId_glTransactions_id"
	}),
	glTransactions: many(glTransactions, {
		relationName: "glTransactions_reversedByTransactionId_glTransactions_id"
	}),
	businessTransaction: one(businessTransactions, {
		fields: [glTransactions.sourceTransactionId],
		references: [businessTransactions.id]
	}),
	glTransactionLines: many(glTransactionLines),
}));

export const businessTransactionsRelations = relations(businessTransactions, ({one, many}) => ({
	glTransactions: many(glTransactions),
	businessTransactionLines: many(businessTransactionLines),
	user_approvedBy: one(users, {
		fields: [businessTransactions.approvedBy],
		references: [users.id],
		relationName: "businessTransactions_approvedBy_users_id"
	}),
	user_createdBy: one(users, {
		fields: [businessTransactions.createdBy],
		references: [users.id],
		relationName: "businessTransactions_createdBy_users_id"
	}),
	user_modifiedBy: one(users, {
		fields: [businessTransactions.modifiedBy],
		references: [users.id],
		relationName: "businessTransactions_modifiedBy_users_id"
	}),
	businessTransaction_parentTransactionId: one(businessTransactions, {
		fields: [businessTransactions.parentTransactionId],
		references: [businessTransactions.id],
		relationName: "businessTransactions_parentTransactionId_businessTransactions_id"
	}),
	businessTransactions_parentTransactionId: many(businessTransactions, {
		relationName: "businessTransactions_parentTransactionId_businessTransactions_id"
	}),
	businessTransaction_rootTransactionId: one(businessTransactions, {
		fields: [businessTransactions.rootTransactionId],
		references: [businessTransactions.id],
		relationName: "businessTransactions_rootTransactionId_businessTransactions_id"
	}),
	businessTransactions_rootTransactionId: many(businessTransactions, {
		relationName: "businessTransactions_rootTransactionId_businessTransactions_id"
	}),
	paymentTerm: one(paymentTerms, {
		fields: [businessTransactions.termsId],
		references: [paymentTerms.id]
	}),
	transactionType: one(transactionTypes, {
		fields: [businessTransactions.transactionTypeId],
		references: [transactionTypes.id]
	}),
	transactionRelationships_childTransactionId: many(transactionRelationships, {
		relationName: "transactionRelationships_childTransactionId_businessTransactions_id"
	}),
	transactionRelationships_parentTransactionId: many(transactionRelationships, {
		relationName: "transactionRelationships_parentTransactionId_businessTransactions_id"
	}),
}));

export const organizationsRelations = relations(organizations, ({many}) => ({
	users: many(users),
	contracts: many(contracts),
}));

export const businessTransactionLinesRelations = relations(businessTransactionLines, ({one, many}) => ({
	account: one(accounts, {
		fields: [businessTransactionLines.accountId],
		references: [accounts.id]
	}),
	activityCode: one(activityCodes, {
		fields: [businessTransactionLines.activityCodeId],
		references: [activityCodes.id]
	}),
	businessTransaction: one(businessTransactions, {
		fields: [businessTransactionLines.businessTransactionId],
		references: [businessTransactions.id]
	}),
	class: one(classes, {
		fields: [businessTransactionLines.classId],
		references: [classes.id]
	}),
	department: one(departments, {
		fields: [businessTransactionLines.departmentId],
		references: [departments.id]
	}),
	entity: one(entities, {
		fields: [businessTransactionLines.employeeId],
		references: [entities.id]
	}),
	product: one(products, {
		fields: [businessTransactionLines.itemId],
		references: [products.id]
	}),
	location: one(locations, {
		fields: [businessTransactionLines.locationId],
		references: [locations.id]
	}),
	businessTransactionLine: one(businessTransactionLines, {
		fields: [businessTransactionLines.parentLineId],
		references: [businessTransactionLines.id],
		relationName: "businessTransactionLines_parentLineId_businessTransactionLines_id"
	}),
	businessTransactionLines: many(businessTransactionLines, {
		relationName: "businessTransactionLines_parentLineId_businessTransactionLines_id"
	}),
	taxCode: one(taxCodes, {
		fields: [businessTransactionLines.taxCodeId],
		references: [taxCodes.id]
	}),
	transactionRelationships_childLineId: many(transactionRelationships, {
		relationName: "transactionRelationships_childLineId_businessTransactionLines_id"
	}),
	transactionRelationships_parentLineId: many(transactionRelationships, {
		relationName: "transactionRelationships_parentLineId_businessTransactionLines_id"
	}),
}));

export const accountsRelations = relations(accounts, ({one, many}) => ({
	businessTransactionLines: many(businessTransactionLines),
	account: one(accounts, {
		fields: [accounts.rollupAccountId],
		references: [accounts.id],
		relationName: "accounts_rollupAccountId_accounts_id"
	}),
	accounts: many(accounts, {
		relationName: "accounts_rollupAccountId_accounts_id"
	}),
}));

export const activityCodesRelations = relations(activityCodes, ({many}) => ({
	businessTransactionLines: many(businessTransactionLines),
	transactionLines: many(transactionLines),
}));

export const classesRelations = relations(classes, ({many}) => ({
	businessTransactionLines: many(businessTransactionLines),
	transactionLines: many(transactionLines),
}));

export const departmentsRelations = relations(departments, ({many}) => ({
	businessTransactionLines: many(businessTransactionLines),
	transactionLines: many(transactionLines),
}));

export const entitiesRelations = relations(entities, ({one, many}) => ({
	businessTransactionLines: many(businessTransactionLines),
	address: one(addresses, {
		fields: [entities.addressId],
		references: [addresses.id]
	}),
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
	contracts: many(contracts),
}));

export const productsRelations = relations(products, ({one, many}) => ({
	businessTransactionLines: many(businessTransactionLines),
	revenueRecognitionPattern: one(revenueRecognitionPatterns, {
		fields: [products.defaultRecognitionPatternId],
		references: [revenueRecognitionPatterns.id]
	}),
	transactionLines: many(transactionLines),
	sspEvidences: many(sspEvidence),
	contractLineItems: many(contractLineItems),
}));

export const locationsRelations = relations(locations, ({many}) => ({
	businessTransactionLines: many(businessTransactionLines),
	transactionLines: many(transactionLines),
}));

export const taxCodesRelations = relations(taxCodes, ({many}) => ({
	businessTransactionLines: many(businessTransactionLines),
	transactionLines: many(transactionLines),
}));

export const paymentTermsRelations = relations(paymentTerms, ({many}) => ({
	businessTransactions: many(businessTransactions),
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
	userSubsidiaryAccesses: many(userSubsidiaryAccess),
}));

export const glTransactionLinesRelations = relations(glTransactionLines, ({one}) => ({
	glTransaction: one(glTransactions, {
		fields: [glTransactionLines.transactionId],
		references: [glTransactions.id]
	}),
}));

export const transactionRelationshipsRelations = relations(transactionRelationships, ({one}) => ({
	businessTransactionLine_childLineId: one(businessTransactionLines, {
		fields: [transactionRelationships.childLineId],
		references: [businessTransactionLines.id],
		relationName: "transactionRelationships_childLineId_businessTransactionLines_id"
	}),
	businessTransaction_childTransactionId: one(businessTransactions, {
		fields: [transactionRelationships.childTransactionId],
		references: [businessTransactions.id],
		relationName: "transactionRelationships_childTransactionId_businessTransactions_id"
	}),
	businessTransactionLine_parentLineId: one(businessTransactionLines, {
		fields: [transactionRelationships.parentLineId],
		references: [businessTransactionLines.id],
		relationName: "transactionRelationships_parentLineId_businessTransactionLines_id"
	}),
	businessTransaction_parentTransactionId: one(businessTransactions, {
		fields: [transactionRelationships.parentTransactionId],
		references: [businessTransactions.id],
		relationName: "transactionRelationships_parentTransactionId_businessTransactions_id"
	}),
}));

export const addressesRelations = relations(addresses, ({many}) => ({
	entities: many(entities),
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

export const unitsOfMeasureRelations = relations(unitsOfMeasure, ({many}) => ({
	transactionLines: many(transactionLines),
}));

export const sspEvidenceRelations = relations(sspEvidence, ({one}) => ({
	product: one(products, {
		fields: [sspEvidence.productId],
		references: [products.id]
	}),
}));

export const rolePermissionsRelations = relations(rolePermissions, ({one}) => ({
	permission: one(permissions, {
		fields: [rolePermissions.permissionId],
		references: [permissions.id]
	}),
	role: one(roles, {
		fields: [rolePermissions.roleId],
		references: [roles.id]
	}),
}));

export const permissionsRelations = relations(permissions, ({many}) => ({
	rolePermissions: many(rolePermissions),
}));

export const rolesRelations = relations(roles, ({many}) => ({
	rolePermissions: many(rolePermissions),
	userRoles: many(userRoles),
}));

export const userSubsidiaryAccessRelations = relations(userSubsidiaryAccess, ({one}) => ({
	user_grantedBy: one(users, {
		fields: [userSubsidiaryAccess.grantedBy],
		references: [users.id],
		relationName: "userSubsidiaryAccess_grantedBy_users_id"
	}),
	subsidiary: one(subsidiaries, {
		fields: [userSubsidiaryAccess.subsidiaryId],
		references: [subsidiaries.id]
	}),
	user_userId: one(users, {
		fields: [userSubsidiaryAccess.userId],
		references: [users.id],
		relationName: "userSubsidiaryAccess_userId_users_id"
	}),
}));

export const userRolesRelations = relations(userRoles, ({one}) => ({
	user_grantedBy: one(users, {
		fields: [userRoles.grantedBy],
		references: [users.id],
		relationName: "userRoles_grantedBy_users_id"
	}),
	role: one(roles, {
		fields: [userRoles.roleId],
		references: [roles.id]
	}),
	user_userId: one(users, {
		fields: [userRoles.userId],
		references: [users.id],
		relationName: "userRoles_userId_users_id"
	}),
}));