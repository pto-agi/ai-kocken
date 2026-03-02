-- ============================================
-- PTO App – Alla nya Supabase-tabeller
-- Kör detta i Supabase SQL Editor
-- ============================================

-- 1. NPS Responses
CREATE TABLE IF NOT EXISTS nps_responses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  score INTEGER NOT NULL CHECK (score >= 0 AND score <= 10),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX idx_nps_responses_user ON nps_responses(user_id);
CREATE INDEX idx_nps_responses_created ON nps_responses(created_at DESC);

ALTER TABLE nps_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own NPS" ON nps_responses
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can read own NPS" ON nps_responses
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Staff can read all NPS" ON nps_responses
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_staff = true)
  );


-- 2. Referral Code i profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE;

-- Generera kod för befintliga profiler som saknar
UPDATE profiles
SET referral_code = 'PTO-' || LEFT(REPLACE(id::text, '-', ''), 8) || '-' || UPPER(SUBSTR(MD5(id::text || now()::text), 1, 4))
WHERE referral_code IS NULL;


-- 3. Referrals-tabell
CREATE TABLE IF NOT EXISTS referrals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  referrer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referred_email TEXT NOT NULL,
  referred_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE (referrer_id, referred_user_id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'registered', 'converted', 'rewarded')),
  reward_type TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  converted_at TIMESTAMPTZ
);

CREATE INDEX idx_referrals_referrer ON referrals(referrer_id);
CREATE INDEX idx_referrals_email ON referrals(referred_email);
CREATE INDEX idx_referrals_status ON referrals(status);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'referrals_referrer_referred_user_unique'
  ) THEN
    ALTER TABLE referrals
      ADD CONSTRAINT referrals_referrer_referred_user_unique UNIQUE (referrer_id, referred_user_id);
  END IF;
END;
$$;

ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own referrals" ON referrals
  FOR SELECT USING (auth.uid() = referrer_id);

CREATE POLICY "Users can insert referrals" ON referrals
  FOR INSERT WITH CHECK (auth.uid() = referrer_id);

CREATE POLICY "Staff can read all referrals" ON referrals
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_staff = true)
  );

CREATE POLICY "Staff can update referrals" ON referrals
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_staff = true)
  );


-- 4. Staff Notes
CREATE TABLE IF NOT EXISTS staff_notes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX idx_staff_notes_client ON staff_notes(client_id);
CREATE INDEX idx_staff_notes_tags ON staff_notes USING GIN(tags);

ALTER TABLE staff_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can manage notes" ON staff_notes
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_staff = true)
  );


-- 5. Auto-generera referral_code vid ny profil (trigger)
CREATE OR REPLACE FUNCTION generate_referral_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.referral_code IS NULL THEN
    NEW.referral_code := 'PTO-' || LEFT(REPLACE(NEW.id::text, '-', ''), 8) || '-' || UPPER(SUBSTR(MD5(NEW.id::text || now()::text), 1, 4));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_generate_referral_code ON profiles;
CREATE TRIGGER trg_generate_referral_code
  BEFORE INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION generate_referral_code();


-- 6. Auto-matcha referral vid registrering (funktion att anropa)
CREATE OR REPLACE FUNCTION match_referral(p_ref_code TEXT, p_email TEXT, p_user_id UUID)
RETURNS void AS $$
DECLARE
  v_referrer_id UUID;
BEGIN
  -- Säkerställ att användare bara kan matcha sin egen registrering
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN RETURN; END IF;

  -- Hitta referrer
  SELECT id INTO v_referrer_id FROM profiles WHERE referral_code = p_ref_code;
  IF v_referrer_id IS NULL THEN RETURN; END IF;
  
  -- Förhindra självreferens
  IF v_referrer_id = p_user_id THEN RETURN; END IF;
  
  -- Skapa referral
  INSERT INTO referrals (referrer_id, referred_email, referred_user_id, status)
  VALUES (v_referrer_id, p_email, p_user_id, 'registered')
  ON CONFLICT DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
