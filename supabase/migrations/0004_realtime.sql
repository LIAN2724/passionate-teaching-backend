-- =====================================================================
-- Passionate Teaching · 0004 enable realtime on messages + lesson_progress
-- =====================================================================

alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.lesson_progress;
