import { pgTable, uuid, text, boolean, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { accountCategoryEnum } from './enums'; // Import the enum
// import { organizations } from './organizations'; // Assuming you might want a relation later

export const accounts = pgTable('accounts', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: text('organization_id').notNull(), // We'll handle relations/foreign keys if needed separately or assume it's just a text field for now for simplicity in matching Supabase RLS
  accountNumber: text('account_number').notNull(),
  accountName: text('account_name').notNull(),
  accountCategory: accountCategoryEnum('account_category').notNull(),
  description: text('description'),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(), // Drizzle doesn't have an equivalent of ON UPDATE CURRENT_TIMESTAMP out of the box for all DBs, typically handled by DB triggers or application logic. We set defaultNow() here.
}, (table) => {
  return {
    orgAccountNumIdx: uniqueIndex('accounts_organization_id_account_number_idx').on(table.organizationId, table.accountNumber),
  };
});

// Optional: Define relations if you have an organizations table and want a direct link
// export const accountsRelations = relations(accounts, ({ one }) => ({
//   organization: one(organizations, {
//     fields: [accounts.organizationId],
//     references: [organizations.id], // Assuming your organizations table has an 'id' field
//   }),
// }));

// Note on updated_at: 
// The Supabase SQL migration used a trigger: CREATE TRIGGER handle_updated_at BEFORE UPDATE ON accounts FOR EACH ROW EXECUTE FUNCTION moddatetime('updated_at');
// For Drizzle, if you want automatic updated_at, you'd typically rely on this database-level trigger.
// If you're using Drizzle migrations, ensure this trigger is part of your migration SQL or manage updates at the application level when performing updates. 