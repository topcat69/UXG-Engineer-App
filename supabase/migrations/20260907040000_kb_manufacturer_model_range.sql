-- KB category hierarchy: fixed 3 levels -- Category -> Manufacturer ->
-- Model range (e.g. "Screens" -> "Philips" -> "55in range") -- per the
-- confirmed follow-up to UXG-KB-01. Each level is its own table with a
-- distinct meaning, not a generic self-referencing tree: a manufacturer
-- only ever belongs to one category, a model range only ever belongs to
-- one manufacturer, and "Philips under Screens" is a different row from
-- "Philips under some other category" if that's ever needed -- same
-- scoped-not-shared reasoning as client_sla_fixture_types being per
-- customer rather than a single global list.

create table kb_manufacturers (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references kb_categories(id),
  name text not null,
  created_at timestamptz default now()
);
create index on kb_manufacturers (category_id);

create table kb_model_ranges (
  id uuid primary key default gen_random_uuid(),
  manufacturer_id uuid not null references kb_manufacturers(id),
  name text not null,
  created_at timestamptz default now()
);
create index on kb_model_ranges (manufacturer_id);

-- An article can be filed at whichever level is actually specific enough
-- (category alone for something general, or all the way down to a model
-- range) -- category_id (already on kb_articles) stays required, these
-- two are nullable on top of it. No cascade on delete anywhere in this
-- hierarchy, same as everywhere else in this schema -- a category/
-- manufacturer/model range still in use can't be silently deleted out
-- from under an article or a level beneath it; the delete just fails
-- until whatever's under it is moved or removed first.
alter table kb_articles add column manufacturer_id uuid references kb_manufacturers(id);
alter table kb_articles add column model_range_id uuid references kb_model_ranges(id);
create index on kb_articles (manufacturer_id);
create index on kb_articles (model_range_id);

alter table kb_manufacturers enable row level security;
alter table kb_model_ranges enable row level security;

-- Same "shared reference data" shape as kb_categories itself.
create policy kb_manufacturers_select on kb_manufacturers for select using (true);
create policy kb_manufacturers_write on kb_manufacturers for insert with check (current_user_role() in ('superadmin', 'manager'));
create policy kb_manufacturers_update on kb_manufacturers for update
  using (current_user_role() in ('superadmin', 'manager'))
  with check (current_user_role() in ('superadmin', 'manager'));
create policy kb_manufacturers_delete on kb_manufacturers for delete using (current_user_role() in ('superadmin', 'manager'));

create policy kb_model_ranges_select on kb_model_ranges for select using (true);
create policy kb_model_ranges_write on kb_model_ranges for insert with check (current_user_role() in ('superadmin', 'manager'));
create policy kb_model_ranges_update on kb_model_ranges for update
  using (current_user_role() in ('superadmin', 'manager'))
  with check (current_user_role() in ('superadmin', 'manager'));
create policy kb_model_ranges_delete on kb_model_ranges for delete using (current_user_role() in ('superadmin', 'manager'));
