-- Ensure realtime works for email_logs
alter table if exists public.email_logs replica identity full;
alter publication supabase_realtime add table if not exists public.email_logs;

