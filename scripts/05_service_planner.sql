-- ============================================================
-- SHEP.HERD — Service Planner, Events, Workforce Schema
-- Run in Supabase SQL editor
-- ============================================================

-- SERVICE PLANS (Order of Service)
CREATE TABLE IF NOT EXISTS service_plans (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  service_date DATE NOT NULL,
  service_type TEXT NOT NULL DEFAULT 'sunday' CHECK (service_type IN ('sunday','wednesday','friday','special')),
  title TEXT NOT NULL DEFAULT 'Sunday Service',
  theme TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','live','completed')),
  created_by UUID REFERENCES users(id),
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- SERVICE PLAN ITEMS (Order of service items)
CREATE TABLE IF NOT EXISTS service_plan_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  plan_id UUID REFERENCES service_plans(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0,
  item_type TEXT NOT NULL DEFAULT 'item' CHECK (item_type IN ('item','song','prayer','sermon','announcement','offering','benediction','break')),
  title TEXT NOT NULL,
  description TEXT,
  duration_minutes INTEGER DEFAULT 5,
  assigned_to UUID REFERENCES users(id),
  assigned_to_name TEXT,
  color TEXT DEFAULT '#534AB7',
  is_completed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- EVENTS (Programme Registration)
CREATE TABLE IF NOT EXISTS church_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  event_type TEXT DEFAULT 'programme' CHECK (event_type IN ('programme','conference','vigil','concert','outreach','training','thanksgiving','dedication','other')),
  event_date DATE NOT NULL,
  start_time TEXT,
  end_time TEXT,
  location TEXT,
  is_free BOOLEAN DEFAULT true,
  price NUMERIC(12,2) DEFAULT 0,
  capacity INTEGER,
  banner_url TEXT,
  public_slug TEXT UNIQUE,
  registration_open BOOLEAN DEFAULT true,
  whatsapp_confirmation BOOLEAN DEFAULT true,
  sms_confirmation BOOLEAN DEFAULT true,
  status TEXT DEFAULT 'upcoming' CHECK (status IN ('upcoming','ongoing','completed','cancelled')),
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- EVENT REGISTRATIONS
CREATE TABLE IF NOT EXISTS event_registrations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID REFERENCES church_events(id) ON DELETE CASCADE,
  member_id UUID REFERENCES members(id),
  full_name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  whatsapp TEXT,
  preferred_comms TEXT DEFAULT 'whatsapp' CHECK (preferred_comms IN ('whatsapp','sms','both','none')),
  is_member BOOLEAN DEFAULT false,
  payment_status TEXT DEFAULT 'free' CHECK (payment_status IN ('free','pending','paid')),
  paystack_reference TEXT,
  attended BOOLEAN DEFAULT false,
  registered_at TIMESTAMPTZ DEFAULT NOW(),
  confirmed_at TIMESTAMPTZ
);

-- WORKFORCE ROSTERS (Department scheduling)
CREATE TABLE IF NOT EXISTS workforce_rosters (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  department_id UUID REFERENCES departments(id),
  service_date DATE NOT NULL,
  service_type TEXT DEFAULT 'sunday',
  created_by UUID REFERENCES users(id),
  published BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(department_id, service_date)
);

-- WORKFORCE ROSTER ENTRIES (Who serves what role)
CREATE TABLE IF NOT EXISTS workforce_roster_entries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  roster_id UUID REFERENCES workforce_rosters(id) ON DELETE CASCADE,
  member_id UUID REFERENCES members(id),
  member_name TEXT NOT NULL,
  role_title TEXT NOT NULL,
  position TEXT,
  confirmed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- WORKFORCE PROFILES (Extended member serving profile)
CREATE TABLE IF NOT EXISTS workforce_profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id UUID REFERENCES members(id) UNIQUE,
  primary_department_id UUID REFERENCES departments(id),
  secondary_departments UUID[],
  skills TEXT[],
  availability TEXT[] DEFAULT ARRAY['Sunday'],
  reliability_score NUMERIC(3,1) DEFAULT 5.0,
  total_services_assigned INTEGER DEFAULT 0,
  total_services_attended INTEGER DEFAULT 0,
  last_served DATE,
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE service_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_plan_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE church_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE workforce_rosters ENABLE ROW LEVEL SECURITY;
ALTER TABLE workforce_roster_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE workforce_profiles ENABLE ROW LEVEL SECURITY;

-- Public read policies
CREATE POLICY "service_plans_read" ON service_plans FOR SELECT USING (true);
CREATE POLICY "service_plan_items_read" ON service_plan_items FOR SELECT USING (true);
CREATE POLICY "church_events_read" ON church_events FOR SELECT USING (true);
CREATE POLICY "event_registrations_read" ON event_registrations FOR SELECT USING (true);
CREATE POLICY "workforce_read" ON workforce_rosters FOR SELECT USING (true);
CREATE POLICY "workforce_entries_read" ON workforce_roster_entries FOR SELECT USING (true);
CREATE POLICY "workforce_profiles_read" ON workforce_profiles FOR SELECT USING (true);
CREATE POLICY "service_plans_write" ON service_plans FOR ALL USING (true);
CREATE POLICY "service_plan_items_write" ON service_plan_items FOR ALL USING (true);
CREATE POLICY "church_events_write" ON church_events FOR ALL USING (true);
CREATE POLICY "event_registrations_write" ON event_registrations FOR ALL USING (true);
CREATE POLICY "workforce_write" ON workforce_rosters FOR ALL USING (true);
CREATE POLICY "workforce_entries_write" ON workforce_roster_entries FOR ALL USING (true);
CREATE POLICY "workforce_profiles_write" ON workforce_profiles FOR ALL USING (true);

-- Public event slug index
CREATE INDEX IF NOT EXISTS idx_events_slug ON church_events(public_slug);
CREATE INDEX IF NOT EXISTS idx_events_date ON church_events(event_date);
CREATE INDEX IF NOT EXISTS idx_roster_dept_date ON workforce_rosters(department_id, service_date);
CREATE INDEX IF NOT EXISTS idx_workforce_member ON workforce_profiles(member_id);
