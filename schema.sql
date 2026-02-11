-- ============================================
-- ARTIZ PLATFORM — SUPABASE DATABASE SCHEMA
-- Run this in: Supabase Dashboard → SQL Editor
-- ============================================

-- 1. PROFILES TABLE (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    phone_number TEXT,
    email TEXT,
    user_type TEXT NOT NULL CHECK (user_type IN ('customer', 'artisan', 'admin')),
    location TEXT,
    trade TEXT,
    experience TEXT,
    bio TEXT,
    avatar_url TEXT,
    rating NUMERIC(3,2) DEFAULT 0,
    total_reviews INTEGER DEFAULT 0,
    verification_level TEXT DEFAULT 'basic' CHECK (verification_level IN ('basic', 'verified', 'trusted', 'top-rated')),
    is_available BOOLEAN DEFAULT true,
    completion_rate NUMERIC(5,2) DEFAULT 0,
    response_rate NUMERIC(5,2) DEFAULT 0,
    jobs_completed INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. SERVICES TABLE
CREATE TABLE IF NOT EXISTS services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    artisan_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    price_min NUMERIC(12,2),
    price_max NUMERIC(12,2),
    category TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. BOOKINGS TABLE
CREATE TABLE IF NOT EXISTS bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    artisan_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    service_name TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'declined')),
    scheduled_date TIMESTAMPTZ,
    price_estimate NUMERIC(12,2),
    location TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add missing columns to bookings if table already existed
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS service_name TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS location TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS price_estimate NUMERIC(12,2);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS scheduled_date TIMESTAMPTZ;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- 4. REVIEWS TABLE
CREATE TABLE IF NOT EXISTS reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
    reviewer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    reviewed_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. CONTACT MESSAGES TABLE
CREATE TABLE IF NOT EXISTS contact_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_messages ENABLE ROW LEVEL SECURITY;

-- PROFILES: anyone can read, users can update their own
CREATE POLICY "Profiles are viewable by everyone" ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- SERVICES: anyone can read, artisans manage their own
CREATE POLICY "Services are viewable by everyone" ON services FOR SELECT USING (true);
CREATE POLICY "Artisans can insert own services" ON services FOR INSERT WITH CHECK (auth.uid() = artisan_id);
CREATE POLICY "Artisans can update own services" ON services FOR UPDATE USING (auth.uid() = artisan_id);
CREATE POLICY "Artisans can delete own services" ON services FOR DELETE USING (auth.uid() = artisan_id);

-- BOOKINGS: involved parties can view, customers can create
CREATE POLICY "Users can view own bookings" ON bookings FOR SELECT USING (auth.uid() = customer_id OR auth.uid() = artisan_id);
CREATE POLICY "Customers can create bookings" ON bookings FOR INSERT WITH CHECK (auth.uid() = customer_id);
CREATE POLICY "Involved parties can update bookings" ON bookings FOR UPDATE USING (auth.uid() = customer_id OR auth.uid() = artisan_id);

-- REVIEWS: anyone can read, authenticated users can create
CREATE POLICY "Reviews are viewable by everyone" ON reviews FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create reviews" ON reviews FOR INSERT WITH CHECK (auth.uid() = reviewer_id);

-- CONTACT MESSAGES: anyone can insert (even anonymous)
CREATE POLICY "Anyone can send contact messages" ON contact_messages FOR INSERT WITH CHECK (true);
CREATE POLICY "Only admins can read contact messages" ON contact_messages FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'admin')
);

-- ============================================
-- HELPER: auto-update updated_at timestamp
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER bookings_updated_at BEFORE UPDATE ON bookings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
