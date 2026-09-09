-- Split into its own migration/transaction from
-- 20260909010000_goods_in_job_sheets.sql — Postgres won't let a freshly
-- added enum value be referenced by a policy in the same transaction it
-- was added in ("unsafe use of new value of enum type").
--
-- Warehouse and Configurator are one combined role, not two, matching the
-- existing one-role-per-user model and the expectation that the same
-- person/device often does both jobs back-to-back on the Goods-In & Job
-- Sheets flow.
alter type user_role add value 'warehouse';
