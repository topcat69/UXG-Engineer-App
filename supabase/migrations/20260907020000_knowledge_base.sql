-- Field Knowledge Base (UXG-KB-01): a reference library both office and
-- engineers write to and read from, inside this app rather than a
-- separate one -- see the confirmed proposal for the full flow. Office
-- writes publish directly; an engineer's submission goes to review first
-- (pending_review), and is either published or declined (with a reason,
-- visible to the author, who can revise and resubmit).

create type kb_article_status as enum ('draft', 'pending_review', 'published', 'declined');

-- Office-managed reference data, same shape as client_sla_fixture_types --
-- seeded below from the existing job types per the confirmed proposal,
-- but editable (add/edit/delete) from the KB admin screen at any time,
-- not a fixed enum.
create table kb_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz default now()
);

create table kb_articles (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  category_id uuid not null references kb_categories(id),
  tags text[] not null default '{}',
  author_id uuid not null references users(id),
  status kb_article_status not null default 'draft',
  reviewed_by uuid references users(id),
  reviewed_at timestamptz,
  decline_reason text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index on kb_articles (status);
create index on kb_articles (category_id);
create index on kb_articles (author_id);

-- Reuses the generic set_updated_at() trigger function already defined
-- for jobs in 20260102000000_schema.sql.
create trigger kb_articles_set_updated_at
  before update on kb_articles
  for each row execute function set_updated_at();

-- Repeating structure (any number of PDFs/videos per article), same
-- reasoning as job_equipment having its own table rather than fixed
-- columns. Cascades with the article -- an attachment has no meaning
-- once its article is gone (unlike job_details' FKs into reference data,
-- which deliberately don't cascade).
create table kb_article_attachments (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references kb_articles(id) on delete cascade,
  storage_path text not null,
  filename text not null,
  created_at timestamptz default now()
);
create index on kb_article_attachments (article_id);

alter table kb_categories enable row level security;
alter table kb_articles enable row level security;
alter table kb_article_attachments enable row level security;

-- kb_categories: same "shared reference data" shape as
-- client_sla_fixture_types (20260907000000_client_sla_lists.sql).
create policy kb_categories_select on kb_categories for select using (true);
create policy kb_categories_write on kb_categories for insert with check (current_user_role() in ('superadmin', 'manager'));
create policy kb_categories_update on kb_categories for update
  using (current_user_role() in ('superadmin', 'manager'))
  with check (current_user_role() in ('superadmin', 'manager'));
create policy kb_categories_delete on kb_categories for delete using (current_user_role() in ('superadmin', 'manager'));

-- kb_articles: mirrors job_details' "office always; author only while not
-- yet submitted" shape (20260117000000_job_details.sql) almost exactly.
-- Published articles are visible to everyone signed in; draft/
-- pending_review/declined are visible only to their author and office.
-- The author can create and edit their own article while it's still
-- draft or declined (write, then revise-and-resubmit after a decline) --
-- once it's pending_review or published, only office can touch it
-- (approve/decline/publish/edit/delete), same as an engineer losing
-- job_details write access once their job is submitted.
create policy kb_articles_select on kb_articles for select using (
  status = 'published'
  or author_id = auth.uid()
  or current_user_role() in ('superadmin', 'manager')
);
create policy kb_articles_insert on kb_articles for insert with check (
  author_id = auth.uid()
);
-- USING gates which existing rows can be touched at all; WITH CHECK gates
-- what the resulting row is allowed to look like. These must be given
-- separately here -- left to default to USING (Postgres's behaviour when
-- WITH CHECK is omitted), the author's own branch would evaluate against
-- the *new* row too, and a resubmit (draft/declined -> pending_review)
-- would then fail its own check the moment it changes the very status
-- USING requires, since the row it produces is no longer draft/declined.
-- WITH CHECK instead pins the author's branch to the one transition
-- they're actually allowed to make (-> pending_review) rather than
-- re-asserting USING's before-state condition against the after-state row.
create policy kb_articles_update on kb_articles for update
  using (
    current_user_role() in ('superadmin', 'manager')
    or (author_id = auth.uid() and status in ('draft', 'declined'))
  )
  with check (
    current_user_role() in ('superadmin', 'manager')
    or (author_id = auth.uid() and status = 'pending_review')
  );
create policy kb_articles_delete on kb_articles for delete using (
  current_user_role() in ('superadmin', 'manager')
);

-- kb_article_attachments: visibility/write follows the parent article's.
create policy kb_article_attachments_select on kb_article_attachments for select using (
  exists (
    select 1 from kb_articles
    where kb_articles.id = kb_article_attachments.article_id
    and (
      kb_articles.status = 'published'
      or kb_articles.author_id = auth.uid()
      or current_user_role() in ('superadmin', 'manager')
    )
  )
);
create policy kb_article_attachments_insert on kb_article_attachments for insert with check (
  exists (
    select 1 from kb_articles
    where kb_articles.id = kb_article_attachments.article_id
    and (
      current_user_role() in ('superadmin', 'manager')
      or (kb_articles.author_id = auth.uid() and kb_articles.status in ('draft', 'declined'))
    )
  )
);
create policy kb_article_attachments_delete on kb_article_attachments for delete using (
  exists (
    select 1 from kb_articles
    where kb_articles.id = kb_article_attachments.article_id
    and (
      current_user_role() in ('superadmin', 'manager')
      or (kb_articles.author_id = auth.uid() and kb_articles.status in ('draft', 'declined'))
    )
  )
);

-- Seed categories from the existing job types, per the confirmed proposal.
insert into kb_categories (name) values
  ('Install'), ('SLA'), ('Maintenance'), ('Delivery'), ('Survey');
