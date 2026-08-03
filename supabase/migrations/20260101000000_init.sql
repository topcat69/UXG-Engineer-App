-- Phase 0: foundation only. Enables the extension the full schema (Phase 1)
-- depends on for gen_random_uuid(), and proves the migration -> type
-- generation pipeline works end to end before real tables land.
create extension if not exists pgcrypto;
