"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.products = exports.recognitionTypeEnum = exports.sspSourceEnum = exports.productTypeEnum = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
const recognition_patterns_1 = require("./recognition_patterns");
exports.productTypeEnum = (0, pg_core_1.pgEnum)("product_type", [
    "software_license",
    "saas_subscription",
    "professional_services",
    "support"
]);
exports.sspSourceEnum = (0, pg_core_1.pgEnum)("ssp_source", [
    "internal_analysis",
    "third_party_pricing",
    "observable_evidence"
]);
exports.recognitionTypeEnum = (0, pg_core_1.pgEnum)("recognition_type", [
    "point_in_time",
    "over_time",
    "hybrid"
]);
exports.products = (0, pg_core_1.pgTable)("products", {
    id: (0, pg_core_1.uuid)("id").defaultRandom().primaryKey(),
    productCode: (0, pg_core_1.varchar)("product_code", { length: 100 }).unique().notNull(),
    productName: (0, pg_core_1.varchar)("product_name", { length: 255 }).notNull(),
    productType: (0, exports.productTypeEnum)("product_type").notNull(),
    defaultSsp: (0, pg_core_1.decimal)("default_ssp", { precision: 12, scale: 2 }),
    sspSource: (0, exports.sspSourceEnum)("ssp_source").default("internal_analysis"),
    recognitionType: (0, exports.recognitionTypeEnum)("recognition_type").notNull(),
    defaultRecognitionPatternId: (0, pg_core_1.uuid)("default_recognition_pattern_id").references(() => recognition_patterns_1.revenueRecognitionPatterns.id),
    isActive: (0, pg_core_1.boolean)("is_active").default(true),
    createdAt: (0, pg_core_1.timestamp)("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at", { withTimezone: true }).defaultNow()
});
//# sourceMappingURL=products.js.map