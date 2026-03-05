-- Chat-tabeller för persistent konversationshistorik
-- Körs i Supabase SQL Editor

-- 1. Konversationer
CREATE TABLE IF NOT EXISTS public.chat_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Ny chatt',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chat_conversations_user ON chat_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_conversations_updated ON chat_conversations(updated_at DESC);

ALTER TABLE chat_conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "chat_conversations_insert_own" ON chat_conversations;
CREATE POLICY "chat_conversations_insert_own" ON chat_conversations
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "chat_conversations_select_own" ON chat_conversations;
CREATE POLICY "chat_conversations_select_own" ON chat_conversations
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "chat_conversations_update_own" ON chat_conversations;
CREATE POLICY "chat_conversations_update_own" ON chat_conversations
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "chat_conversations_select_staff" ON chat_conversations;
CREATE POLICY "chat_conversations_select_staff" ON chat_conversations
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_staff = true)
  );

-- 2. Meddelanden
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation ON chat_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created ON chat_messages(created_at);

ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "chat_messages_insert_own" ON chat_messages;
CREATE POLICY "chat_messages_insert_own" ON chat_messages
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM chat_conversations WHERE id = conversation_id AND user_id = auth.uid())
  );

DROP POLICY IF EXISTS "chat_messages_select_own" ON chat_messages;
CREATE POLICY "chat_messages_select_own" ON chat_messages
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM chat_conversations WHERE id = conversation_id AND user_id = auth.uid())
  );

DROP POLICY IF EXISTS "chat_messages_select_staff" ON chat_messages;
CREATE POLICY "chat_messages_select_staff" ON chat_messages
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_staff = true)
  );

-- 3. Feature-flag för gradvis utrullning av chatten
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS chat_enabled BOOLEAN NOT NULL DEFAULT false;

-- Aktivera chatten för befintlig personal
UPDATE profiles SET chat_enabled = true WHERE is_staff = true OR is_manager = true;
