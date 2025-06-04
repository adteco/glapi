"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.glReportingRepository = exports.glTransactionRepository = exports.entityRepository = exports.accountRepository = exports.classRepository = exports.locationRepository = exports.departmentRepository = void 0;
// Export base repository
__exportStar(require("./base-repository"), exports);
// Export entity repositories
__exportStar(require("./customer-repository"), exports);
__exportStar(require("./organization-repository"), exports);
__exportStar(require("./subsidiary-repository"), exports);
__exportStar(require("./department-repository"), exports);
__exportStar(require("./location-repository"), exports);
__exportStar(require("./class-repository"), exports);
__exportStar(require("./account-repository"), exports);
__exportStar(require("./entity-repository"), exports);
// Export GL repositories
__exportStar(require("./gl-transaction-repository"), exports);
__exportStar(require("./gl-reporting-repository"), exports);
// Export repository instances for dependency injection
const department_repository_1 = require("./department-repository");
const location_repository_1 = require("./location-repository");
const class_repository_1 = require("./class-repository");
const account_repository_1 = require("./account-repository");
const entity_repository_1 = require("./entity-repository");
const gl_transaction_repository_1 = require("./gl-transaction-repository");
const gl_reporting_repository_1 = require("./gl-reporting-repository");
exports.departmentRepository = new department_repository_1.DepartmentRepository();
exports.locationRepository = new location_repository_1.LocationRepository();
exports.classRepository = new class_repository_1.ClassRepository();
exports.accountRepository = new account_repository_1.AccountRepository();
exports.entityRepository = new entity_repository_1.EntityRepository();
exports.glTransactionRepository = new gl_transaction_repository_1.GlTransactionRepository();
exports.glReportingRepository = new gl_reporting_repository_1.GlReportingRepository();
//# sourceMappingURL=index.js.map