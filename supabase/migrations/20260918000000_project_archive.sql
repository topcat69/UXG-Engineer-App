-- Superadmin-only project archiving — end-of-project/end-of-year
-- housekeeping. Nothing is deleted: an archived project's jobs, sites,
-- and Drive files stay exactly where they are (Drive doesn't know or
-- care about this flag) — archiving just drops the project out of the
-- "active" pickers used when creating new work, while it stays fully
-- visible on its own row here and in Reports.
alter table projects add column archived_at timestamptz;
alter table projects add column archived_by uuid references users(id);

-- projects_update (20260103000000_rls.sql) already lets manager or
-- superadmin update any column on projects, including these two — RLS
-- can't scope an UPDATE to specific columns, so a plain policy can't
-- make *just archiving* superadmin-only without also taking ordinary
-- editing away from managers. Same shape as set_own_theme
-- (20260123000000_user_theme.sql): a SECURITY DEFINER function that
-- runs one hard-coded UPDATE and checks the role itself, so archiving
-- can be stricter than the table's general write policy.
create function archive_project(project_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if current_user_role() != 'superadmin' then
    raise exception 'Only a superadmin can archive a project.';
  end if;
  update projects set archived_at = now(), archived_by = auth.uid() where id = project_id;
end;
$$;
grant execute on function archive_project(uuid) to authenticated;

create function unarchive_project(project_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if current_user_role() != 'superadmin' then
    raise exception 'Only a superadmin can unarchive a project.';
  end if;
  update projects set archived_at = null, archived_by = null where id = project_id;
end;
$$;
grant execute on function unarchive_project(uuid) to authenticated;
