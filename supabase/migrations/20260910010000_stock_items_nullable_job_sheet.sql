-- Shelf stock for the new Stock page (/office/stock): existing warehouse
-- stock, or anything added manually, that isn't earmarked for any Job
-- Sheet yet. Same stock_items row as goods-in stock — job_sheet_id was
-- NOT NULL because every prior use case (receiving against a Job Sheet)
-- always had one; "on the shelf" is just a stock_items row with no
-- job_sheet_id, allocated to one later by setting it (see allocateStock
-- in office/stock/actions.ts).
alter table stock_items alter column job_sheet_id drop not null;

-- stock_items_select/_update assumed job_sheet_id was always set —
-- `x in (select ...)` against a null job_sheet_id evaluates to null (not
-- true), so shelf stock would be invisible and unupdatable without this.
-- Same roles stock_items_insert/_delete already use, since there's no
-- parent Job Sheet to inherit visibility from for a shelf row.
drop policy stock_items_select on stock_items;
create policy stock_items_select on stock_items for select using (
  job_sheet_id in (select id from job_sheets)
  or (job_sheet_id is null and current_user_role() in ('superadmin', 'manager', 'warehouse'))
);

drop policy stock_items_update on stock_items;
create policy stock_items_update on stock_items for update
  using (
    job_sheet_id in (select id from job_sheets)
    or (job_sheet_id is null and current_user_role() in ('superadmin', 'manager', 'warehouse'))
  )
  with check (
    job_sheet_id in (select id from job_sheets)
    or (job_sheet_id is null and current_user_role() in ('superadmin', 'manager', 'warehouse'))
  );
