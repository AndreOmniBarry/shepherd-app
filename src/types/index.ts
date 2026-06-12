// ============================================================
// SHEP.HERD — Application Types
// Single source of truth for all data shapes.
// ============================================================

// ── DATABASE ROW TYPES ──────────────────────────────────────

export type Role = 'cell_leader' | 'overseer';

export type Fellowship = {
  id:          string;
  name:        string;
  description: string | null;
  created_at:  string;
};

export type Cell = {
  id:            string;
  name:          string;
  fellowship_id: string;
  leader_id:     string | null;
  target_size:   number;
  is_active:     boolean;
  created_at:    string;
  // Joined
  fellowship?:   Fellowship;
};

export type SubGroup = 'children' | 'teenagers' | null;
export type MemberStatus = 'active' | 'inactive' | 'transferred' | 'deceased';
export type ConversionSource = 'cell outreach' | 'walk-in' | 'crusade' | 'referral' | 'online';

export type Member = {
  id:                string;
  full_name:         string;
  gender:            'male' | 'female' | 'other' | null;
  date_of_birth:     string | null;
  phone:             string | null;
  email:             string | null;
  cell_id:           string | null;
  fellowship_id:     string | null;
  sub_group:         SubGroup;
  join_date:         string;
  membership_status: MemberStatus;
  conversion_source: ConversionSource | null;
  is_new_convert:    boolean;
  created_at:        string;
  // Joined
  cell?:             Cell;
  fellowship?:       Fellowship;
};

export type Service = {
  id:             string;
  service_date:   string;
  service_type:   string;
  service_number: 1 | 2;
  notes:          string | null;
  created_at:     string;
};

export type AttendanceRecord = {
  id:            string;
  service_id:    string;
  cell_id:       string | null;
  submitted_by:  string;
  present_count: number;
  absent_count:  number;
  visitor_count: number;
  submitted_at:  string;
  is_locked:     boolean;
  // Joined
  service?:      Service;
  cell?:         Cell;
};

export type AttendanceStatus = 'present' | 'absent' | 'visitor';

export type AttendanceEntry = {
  id:             string;
  record_id:      string;
  member_id:      string | null;
  status:         AttendanceStatus;
  absence_reason: string | null;
  created_at:     string;
  // Joined
  member?:        Member;
};

export type GivingType = 'tithe' | 'offering' | 'special' | 'first_fruit' | 'project';

export type GivingRecord = {
  id:            string;
  service_id:    string | null;
  fellowship_id: string | null;
  giving_type:   GivingType;
  amount:        number;
  currency:      string;
  notes:         string | null;
  recorded_at:   string;
};

export type Department = {
  id:          string;
  name:        string;
  category:    string | null;
  description: string | null;
  created_at:  string;
};

export type User = {
  id:         string;
  email:      string;
  phone:      string | null;
  full_name:  string;
  role:       Role;
  cell_id:    string | null;
  is_active:  boolean;
  created_at: string;
};

export type AgentName = 'ktava' | 'arkwind' | 'moshe' | 'numbers';

export type AIQueryLog = {
  id:               string;
  user_id:          string | null;
  agent_name:       AgentName;
  query_text:       string;
  response_summary: string | null;
  queried_at:       string;
};

// ── AUTH ────────────────────────────────────────────────────

export type JWTPayload = {
  sub:     string;    // user id
  email:   string;
  role:    Role;
  cell_id: string | null;
  iat:     number;
  exp:     number;
};

export type AuthUser = {
  id:      string;
  email:   string;
  role:    Role;
  cell_id: string | null;
  name:    string;
};

export type LoginRequest = {
  email:    string;
  password: string;
};

export type RegisterRequest = {
  email:        string;
  password:     string;
  full_name:    string;
  phone?:       string;
  fellowship_id: string;
  cell_id:      string;
};

// ── API RESPONSES ────────────────────────────────────────────

export type APIResponse<T> = {
  data: T;
  error: null;
} | {
  data: null;
  error: { message: string; code: string };
};

export type LoginResponse = {
  token: string;
  user:  AuthUser;
};

// ── ATTENDANCE SUBMISSION ────────────────────────────────────

export type AttendanceEntryInput = {
  member_id:      string | null;
  status:         AttendanceStatus;
  absence_reason?: string;
};

export type AttendanceSubmitRequest = {
  service_id: string;
  cell_id:    string;
  entries:    AttendanceEntryInput[];
};

// ── ANALYTICS ────────────────────────────────────────────────

export type KPIDashboard = {
  total_members:      number;
  active_members:     number;
  today_present:      number;
  today_cells_reported: number;
  today_cells_total:  number;
  ytd_giving_ngn:     number;
  active_cells:       number;
  new_members_month:  number;
};

export type AttendanceDataPoint = {
  date:          string;
  service_1:     number;
  service_2:     number;
  total:         number;
  fellowship?:   string;
  cell_name?:    string;
};

export type WeeklyAttendanceSeries = {
  week:      string;    // ISO week string e.g. "2025-W01"
  date:      string;    // Sunday date
  present:   number;
  absent:    number;
  visitors:  number;
  rate:      number;    // present / (present + absent)
};

export type FellowshipBreakdown = {
  fellowship: string;
  count:      number;
  percentage: number;
};

export type DemographyData = {
  age_bands: {
    band:       string;    // "0-12", "13-17", "18-25", etc.
    count:      number;
    sub_group?: SubGroup;
  }[];
  gender: {
    male:   number;
    female: number;
    other:  number;
  };
  cydf: {
    children:   number;
    teenagers:  number;
    combined:   number;
  };
  fellowship_breakdown: FellowshipBreakdown[];
};

export type GivingDataPoint = {
  period:      string;   // "2025-01", "2025-Q1", "2025"
  tithe:       number;
  offering:    number;
  special:     number;
  first_fruit: number;
  project:     number;
  total:       number;
};

export type ConversionDataPoint = {
  month:            string;
  new_members:      number;
  conversions:      number;
  source_breakdown: Record<ConversionSource, number>;
};

// ── REPORTS ──────────────────────────────────────────────────

export type CellPerformance = {
  cell_id:            string;
  cell_name:          string;
  fellowship:         string;
  avg_attendance:     number;
  avg_rate:           number;       // % of target
  consistency_score:  number;       // 0-100
  trend:              'rising' | 'stable' | 'declining';
  weeks_analysed:     number;
  intervention_flag:  boolean;
  last_submitted:     string | null;
};

export type InterventionAlert = {
  cell_id:           string;
  cell_name:         string;
  fellowship:        string;
  consecutive_weeks_declining: number;
  current_avg:       number;
  baseline_avg:      number;
  drop_percentage:   number;
  severity:          'watch' | 'intervention_required';
};

// ── AI AGENTS ────────────────────────────────────────────────

export type AIQueryRequest = {
  query:   string;
  agent?:  AgentName;   // omit for auto-routing
};

export type AIQueryResponse = {
  agent:    AgentName;
  response: string;
  sources:  string[];   // tables queried
  latency:  number;     // ms
};

// ── LIVE FEED ────────────────────────────────────────────────

export type LiveFeedEvent = {
  type:           'attendance_submitted';
  record:         AttendanceRecord;
  cell_name:      string;
  fellowship:     string;
  submitted_at:   string;
};
