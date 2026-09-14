-- Help Guides: role-based in-app documentation, one guide per role plus an
-- optional shared/all-roles section. Deliberately separate from the
-- Knowledge Base — KB is AV equipment documentation browsed by
-- manufacturer/model for engineers troubleshooting kit in the field; this
-- is "how to use this app itself", a different audience and purpose that
-- would confuse KB's category structure if folded in.
create table help_categories (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references help_categories(id) on delete cascade,
  name text not null,
  position integer not null default 0,
  -- null = visible to every signed-in role (e.g. a shared "Getting
  -- Started" section); otherwise restricted to that one role, plus
  -- superadmin, who sees every guide — superadmin is already a superset
  -- of every other role everywhere else in this app. A child category
  -- always carries the same role as its parent (enforced in the
  -- createHelpCategory action, not here) so the RLS policies below can
  -- check one row directly instead of walking the tree.
  role user_role,
  created_at timestamptz default now()
);
create index on help_categories (parent_id);

create table help_articles (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references help_categories(id) on delete cascade,
  title text not null,
  body text not null,
  video_path text,
  position integer not null default 0,
  created_by uuid references users(id),
  updated_by uuid references users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index on help_articles (category_id);

-- Reuses the generic set_updated_at() trigger function already defined
-- for jobs in 20260102000000_schema.sql.
create trigger help_articles_set_updated_at
  before update on help_articles
  for each row execute function set_updated_at();

-- Repeating structure (any number of ordered screenshots per article),
-- same reasoning as kb_article_attachments — an image has no meaning once
-- its article is gone.
create table help_article_images (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references help_articles(id) on delete cascade,
  storage_path text not null,
  caption text,
  position integer not null default 0,
  created_at timestamptz default now()
);
create index on help_article_images (article_id);

alter table help_categories enable row level security;
alter table help_articles enable row level security;
alter table help_article_images enable row level security;

-- Visible if shared (role is null), matches the viewer's own role, or the
-- viewer is superadmin/manager — both author every guide (see the write
-- policies below), so both need to see every guide, not just their own.
-- Written only by superadmin/manager — content authoring stays an office
-- task, same as every other reference-data table in this app (Asset
-- Categories, Stock Catalog, KB categories).
create policy help_categories_select on help_categories for select using (
  current_user_role() in ('superadmin', 'manager') or role is null or role = current_user_role()
);
create policy help_categories_insert on help_categories for insert with check (current_user_role() in ('superadmin', 'manager'));
create policy help_categories_update on help_categories for update
  using (current_user_role() in ('superadmin', 'manager'))
  with check (current_user_role() in ('superadmin', 'manager'));
create policy help_categories_delete on help_categories for delete using (current_user_role() in ('superadmin', 'manager'));

create policy help_articles_select on help_articles for select using (
  current_user_role() in ('superadmin', 'manager')
  or category_id in (select id from help_categories where role is null or role = current_user_role())
);
create policy help_articles_insert on help_articles for insert with check (current_user_role() in ('superadmin', 'manager'));
create policy help_articles_update on help_articles for update
  using (current_user_role() in ('superadmin', 'manager'))
  with check (current_user_role() in ('superadmin', 'manager'));
create policy help_articles_delete on help_articles for delete using (current_user_role() in ('superadmin', 'manager'));

create policy help_article_images_select on help_article_images for select using (
  current_user_role() in ('superadmin', 'manager')
  or article_id in (
    select id from help_articles where category_id in (
      select id from help_categories where role is null or role = current_user_role()
    )
  )
);
create policy help_article_images_insert on help_article_images for insert with check (current_user_role() in ('superadmin', 'manager'));
create policy help_article_images_delete on help_article_images for delete using (current_user_role() in ('superadmin', 'manager'));
