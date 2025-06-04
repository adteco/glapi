export declare const accounts: any;
export declare const accountsRelations: import("drizzle-orm").Relations<string, {
    organization: import("drizzle-orm").One<"organizations", false>;
    rollupAccount: import("drizzle-orm").One<any, false>;
    childAccounts: import("drizzle-orm").Many<any>;
}>;
//# sourceMappingURL=accounts.d.ts.map