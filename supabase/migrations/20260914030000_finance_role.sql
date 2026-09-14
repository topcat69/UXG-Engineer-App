-- New "finance" role — own migration/transaction, same reason as
-- 20260909000000_user_role_warehouse.sql: Postgres won't let a freshly
-- added enum value be referenced by a policy in the same transaction it
-- was added in ("unsafe use of new value of enum type"). The RLS grants
-- that actually use this value are in the next migration.
alter type user_role add value 'finance';
