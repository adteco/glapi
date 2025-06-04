import { Pool } from "pg";
export declare const db: import("drizzle-orm/node-postgres").NodePgDatabase<Record<string, never>> & {
    $client: Pool;
};
export declare function getClient(): {
    query(sql: any, params: any): Promise<any[][]>;
    end(): Promise<void>;
};
//# sourceMappingURL=db.d.ts.map