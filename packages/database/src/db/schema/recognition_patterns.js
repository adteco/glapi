"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.revenueRecognitionPatterns = exports.patternTypeEnum = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
exports.patternTypeEnum = (0, pg_core_1.pgEnum)("pattern_type", [
    "straight_line",
    "proportional",
    "milestone",
    "custom"
]);
exports.revenueRecognitionPatterns = (0, pg_core_1.pgTable)("revenue_recognition_patterns", {
    id: (0, pg_core_1.uuid)("id").defaultRandom().primaryKey(),
    patternName: (0, pg_core_1.varchar)("pattern_name", { length: 255 }).notNull(),
    patternType: (0, exports.patternTypeEnum)("pattern_type").notNull(),
    patternConfig: (0, pg_core_1.jsonb)("pattern_config"),
    isDefault: (0, pg_core_1.boolean)("is_default").default(false),
    createdAt: (0, pg_core_1.timestamp)("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at", { withTimezone: true }).defaultNow()
});
//# sourceMappingURL=recognition_patterns.js.map