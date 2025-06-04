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
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.db = void 0;
exports.getClient = getClient;
const node_postgres_1 = require("drizzle-orm/node-postgres");
const pg_1 = require("pg");
const dotenv = __importStar(require("dotenv"));
// Load environment variables
dotenv.config({ path: '../../.env' });
dotenv.config();
if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is not set. Please check your .env file.');
}
// Prepare connection string
// Use the DATABASE_URL directly for the Pool since it can handle special characters
const connectionString = process.env.DATABASE_URL;
// For drizzle-orm with node-postgres
const pool = new pg_1.Pool({ connectionString });
exports.db = (0, node_postgres_1.drizzle)(pool);
// For postgres client (used in test-connection)
function getClient() {
    try {
        // The postgres client has different parsing requirements
        // than node-postgres, so we use the Pool for testing as well
        return {
            async query(sql, params) {
                const result = await pool.query(sql, params);
                return result.rows;
            },
            async end() {
                await pool.end();
            }
        };
    }
    catch (error) {
        console.error('Error creating postgres client:', error);
        throw error;
    }
}
//# sourceMappingURL=db.js.map