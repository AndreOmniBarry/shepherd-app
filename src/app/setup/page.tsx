'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { type StructureType } from '@/lib/church-config';

const C = {
  purple: '#534AB7', purpleDark: '#3C3489', purpleLight: '#7B74CC',
  purpleBg: '#EEEDFE', purpleFaint: '#F7F6FF',
  teal: '#1D9E75', tealBg: '#E1F5EE',
  coral: '#D85A30', coralBg: '#FAECE7',
  amber: '#BA7517', amberBg: '#FAEEDA',
  gold: '#F59E0B',
  text: '#0F0A2E', sub: '#4A4272', muted: '#9890C4',
  border: 'rgba(83,74,183,0.12)', borderStrong: 'rgba(83,74,183,0.25)',
  white: '#FFFFFF', bg: '#F4F3FB',
};

type Answer = string | string[] | number | null;
type QuestionType = 'single' | 'multi' | 'text' | 'number' | 'country';

interface Option { value: string; label: string; sub?: string; icon?: string }
interface Question {
  id: string; section: string; type: QuestionType;
  question: string; sub?: string; options?: Option[];
  placeholder?: string; min?: number; max?: number; required?: boolean;
}

const ALL_COUNTRIES = [
  { value: 'Nigeria', label: 'Nigeria', icon: '🇳🇬' },
  { value: 'Ghana', label: 'Ghana', icon: '🇬🇭' },
  { value: 'Kenya', label: 'Kenya', icon: '🇰🇪' },
  { value: 'South Africa', label: 'South Africa', icon: '🇿🇦' },
  { value: 'Uganda', label: 'Uganda', icon: '🇺🇬' },
  { value: 'Tanzania', label: 'Tanzania', icon: '🇹🇿' },
  { value: 'Rwanda', label: 'Rwanda', icon: '🇷🇼' },
  { value: 'Ethiopia', label: 'Ethiopia', icon: '🇪🇹' },
  { value: 'Cameroon', label: 'Cameroon', icon: '🇨🇲' },
  { value: 'Côte d\'Ivoire', label: 'Côte d\'Ivoire', icon: '🇨🇮' },
  { value: 'Senegal', label: 'Senegal', icon: '🇸🇳' },
  { value: 'Zimbabwe', label: 'Zimbabwe', icon: '🇿🇼' },
  { value: 'Zambia', label: 'Zambia', icon: '🇿🇲' },
  { value: 'Malawi', label: 'Malawi', icon: '🇲🇼' },
  { value: 'Mozambique', label: 'Mozambique', icon: '🇲🇿' },
  { value: 'Angola', label: 'Angola', icon: '🇦🇴' },
  { value: 'DR Congo', label: 'DR Congo', icon: '🇨🇩' },
  { value: 'Sierra Leone', label: 'Sierra Leone', icon: '🇸🇱' },
  { value: 'Liberia', label: 'Liberia', icon: '🇱🇷' },
  { value: 'Togo', label: 'Togo', icon: '🇹🇬' },
  { value: 'Benin', label: 'Benin', icon: '🇧🇯' },
  { value: 'Niger', label: 'Niger', icon: '🇳🇪' },
  { value: 'Burkina Faso', label: 'Burkina Faso', icon: '🇧🇫' },
  { value: 'Mali', label: 'Mali', icon: '🇲🇱' },
  { value: 'Botswana', label: 'Botswana', icon: '🇧🇼' },
  { value: 'Namibia', label: 'Namibia', icon: '🇳🇦' },
  { value: 'United Kingdom', label: 'United Kingdom', icon: '🇬🇧' },
  { value: 'United States', label: 'United States', icon: '🇺🇸' },
  { value: 'Canada', label: 'Canada', icon: '🇨🇦' },
  { value: 'Australia', label: 'Australia', icon: '🇦🇺' },
  { value: 'Germany', label: 'Germany', icon: '🇩🇪' },
  { value: 'Netherlands', label: 'Netherlands', icon: '🇳🇱' },
  { value: 'Italy', label: 'Italy', icon: '🇮🇹' },
  { value: 'France', label: 'France', icon: '🇫🇷' },
  { value: 'Ireland', label: 'Ireland', icon: '🇮🇪' },
  { value: 'Norway', label: 'Norway', icon: '🇳🇴' },
  { value: 'Sweden', label: 'Sweden', icon: '🇸🇪' },
  { value: 'Brazil', label: 'Brazil', icon: '🇧🇷' },
  { value: 'India', label: 'India', icon: '🇮🇳' },
  { value: 'China', label: 'China', icon: '🇨🇳' },
  { value: 'Other', label: 'Other country', icon: '🌍' },
];

const QUESTIONS: Question[] = [
  // IDENTITY
  { id: 'church_name', section: 'Identity', type: 'text', required: true, question: 'What is the full name of your church?', sub: 'This appears across all portals, reports, and communications.', placeholder: 'e.g. The Comforters House Global' },
  { id: 'country', section: 'Identity', type: 'country', required: true, question: 'Where is your church headquartered?', sub: 'Determines currency, date formatting, and SMS provider.' },
  { id: 'denomination', section: 'Identity', type: 'single', question: 'What is your church\'s denomination or movement?', options: [
    { value: 'pentecostal', label: 'Pentecostal / Charismatic', sub: 'RCCG, Winners, CAC, MFM, COZA, Deeper Life, Christ Embassy' },
    { value: 'evangelical', label: 'Evangelical / Baptist', sub: 'SBC, ECWA, Evangelical Church' },
    { value: 'methodist', label: 'Methodist / Anglican', sub: 'Methodist Church, Anglican Diocese' },
    { value: 'catholic', label: 'Catholic', sub: 'Roman Catholic, Orthodox' },
    { value: 'apostolic', label: 'Apostolic / Prophetic', sub: 'Apostolic Faith, New Apostolic, TREM' },
    { value: 'seventh_day', label: 'Seventh-day Adventist' },
    { value: 'interdenominational', label: 'Interdenominational / Non-denominational' },
    { value: 'other', label: 'Other' },
  ]},
  { id: 'founded_year', section: 'Identity', type: 'number', question: 'What year was your church founded?', sub: 'Used for anniversary tracking and milestone reports.', placeholder: 'e.g. 1998', min: 1800, max: 2026 },

  // SIZE
  { id: 'congregation_size', section: 'Size & Scale', type: 'single', required: true, question: 'How large is your active congregation?', sub: 'Count of regular adult attendees, not just registered members.', options: [
    { value: 'under_100', label: 'Under 100', sub: 'Plant or emerging church' },
    { value: '100_500', label: '100 – 500', sub: 'Growing church' },
    { value: '500_2000', label: '500 – 2,000', sub: 'Mid-size church' },
    { value: '2000_10000', label: '2,000 – 10,000', sub: 'Large church' },
    { value: 'above_10000', label: 'Above 10,000', sub: 'Megachurch' },
  ]},
  { id: 'location_count', section: 'Size & Scale', type: 'single', required: true, question: 'How many physical locations does your church operate?', sub: 'Branches, campuses, satellite churches, mission stations.', options: [
    { value: '1', label: '1 location' }, { value: '2_5', label: '2 – 5 locations' },
    { value: '6_20', label: '6 – 20 locations' }, { value: '21_100', label: '21 – 100 locations' },
    { value: 'above_100', label: 'Above 100 locations' },
  ]},
  { id: 'staff_count', section: 'Size & Scale', type: 'single', question: 'How many paid staff does your church employ?', options: [
    { value: 'none', label: 'No paid staff', sub: 'Fully volunteer-led' },
    { value: '1_5', label: '1 – 5 staff' }, { value: '6_20', label: '6 – 20 staff' },
    { value: '21_50', label: '21 – 50 staff' }, { value: 'above_50', label: 'Above 50 staff' },
  ]},

  // STRUCTURE
  { id: 'structure_type', section: 'Church Structure', type: 'single', required: true, question: 'How is your church organised internally?', sub: 'Determines which portals, roles, and hierarchy appear in SHEPHERD.', options: [
    { value: 'cell_church', label: 'Fellowship → Cell → Member', sub: 'RCCG, Comforters House, city churches' },
    { value: 'zonal', label: 'Zone → District → Cell → Member', sub: 'Winners Chapel, CAC, classical Pentecostal' },
    { value: 'campus', label: 'Campus → Fellowship → Cell → Member', sub: 'Multi-site churches' },
    { value: 'department', label: 'Department → Unit → Member', sub: 'Cathedral-style, liturgical' },
    { value: 'house_network', label: 'Network → Home Group → Member', sub: 'Organic, new-generation churches' },
    { value: 'single', label: 'Pastor → Member (no sub-structure)', sub: 'Small, plant, or rural church' },
  ]},
  { id: 'tier1_label', section: 'Church Structure', type: 'text', question: 'What do you call your first tier of organisation?', sub: 'Pre-filled from your structure. Rename it to match your church\'s language.', placeholder: 'e.g. Fellowship, Zone, Campus' },
  { id: 'tier2_label', section: 'Church Structure', type: 'text', question: 'What do you call your second tier?', sub: 'The groups within each first tier — where members typically belong.', placeholder: 'e.g. Cell, Home Group, Unit' },
  { id: 'tier1_head_label', section: 'Church Structure', type: 'text', question: 'What title does a first-tier leader carry?', placeholder: 'e.g. Fellowship Head, Zonal Pastor, Campus Director' },
  { id: 'tier2_head_label', section: 'Church Structure', type: 'text', question: 'What title does a second-tier leader carry?', placeholder: 'e.g. Cell Leader, Home Group Host, District Pastor' },

  // SERVICES
  { id: 'service_days', section: 'Services', type: 'multi', required: true, question: 'Which days does your church hold regular services?', sub: 'Determines attendance submission windows and absence alerts.', options: [
    { value: 'Sunday', label: 'Sunday', sub: 'Main service' }, { value: 'Wednesday', label: 'Wednesday', sub: 'Midweek service' },
    { value: 'Friday', label: 'Friday', sub: 'Friday service / vigil' }, { value: 'Saturday', label: 'Saturday' },
    { value: 'Monday', label: 'Monday' }, { value: 'Tuesday', label: 'Tuesday' }, { value: 'Thursday', label: 'Thursday' },
  ]},
  { id: 'services_per_main_day', section: 'Services', type: 'single', question: 'How many services on your main day?', options: [
    { value: '1', label: '1 service' }, { value: '2', label: '2 services' }, { value: '3', label: '3 services' }, { value: '4_plus', label: '4 or more' },
  ]},
  { id: 'cell_meeting_day', section: 'Services', type: 'single', question: 'Which day do your cells or groups typically meet?', sub: 'Sets cell submission reminders.', options: [
    { value: 'Monday', label: 'Monday' }, { value: 'Tuesday', label: 'Tuesday' }, { value: 'Wednesday', label: 'Wednesday' },
    { value: 'Thursday', label: 'Thursday' }, { value: 'Friday', label: 'Friday' }, { value: 'Saturday', label: 'Saturday' },
    { value: 'varies', label: 'Varies by cell' },
  ]},

  // MINISTRIES
  { id: 'has_children', section: 'Ministries', type: 'single', question: 'Does your church have a children\'s ministry?', sub: 'Enables CYDF headcount tracking and age-group intelligence.', options: [
    { value: 'yes_active', label: 'Yes — active and structured', sub: 'Dedicated children\'s church or Sunday school' },
    { value: 'yes_informal', label: 'Yes — informal', sub: 'Children attend but no formal programme' },
    { value: 'no', label: 'Not yet' },
  ]},
  { id: 'has_youth', section: 'Ministries', type: 'single', question: 'Does your church have a youth ministry?', options: [
    { value: 'yes_active', label: 'Yes — active and structured' }, { value: 'yes_informal', label: 'Yes — informal' }, { value: 'no', label: 'Not yet' },
  ]},
  { id: 'departments', section: 'Ministries', type: 'multi', question: 'Which departments or ministries are active?', sub: 'Select all that apply.', options: [
    { value: 'ushering', label: 'Ushering & Protocol' }, { value: 'worship', label: 'Worship & Music' },
    { value: 'media', label: 'Media & Technology' }, { value: 'prayer', label: 'Prayer & Intercession' },
    { value: 'evangelism', label: 'Evangelism & Outreach' }, { value: 'welfare', label: 'Welfare & Care' },
    { value: 'hospitality', label: 'Hospitality' }, { value: 'security', label: 'Security' },
    { value: 'sanitation', label: 'Sanitation & Environment' }, { value: 'men', label: 'Men\'s Fellowship' },
    { value: 'women', label: 'Women\'s Fellowship' }, { value: 'singles', label: 'Singles Ministry' },
    { value: 'marriage', label: 'Marriage & Family' }, { value: 'choir', label: 'Choir / Praise Team' },
    { value: 'drama', label: 'Drama & Dance' }, { value: 'missions', label: 'Missions & Church Planting' },
  ]},

  // GIVING
  { id: 'giving_types', section: 'Giving & Finance', type: 'multi', question: 'Which giving types does your church collect?', sub: 'These become your income categories in accounts.', options: [
    { value: 'tithe', label: 'Tithe' }, { value: 'offering', label: 'General Offering' },
    { value: 'special', label: 'Special Offering' }, { value: 'project', label: 'Project / Building Fund' },
    { value: 'first_fruit', label: 'First Fruit' }, { value: 'thanksgiving', label: 'Thanksgiving' },
    { value: 'welfare', label: 'Welfare / Benevolence' }, { value: 'missions', label: 'Missions Fund' },
    { value: 'partnership', label: 'Partnership / Covenant' }, { value: 'seed', label: 'Seed Faith' },
    { value: 'convention', label: 'Convention / Programme Levies' },
  ]},
  { id: 'has_partnership', section: 'Giving & Finance', type: 'single', question: 'Do you run a partnership or covenant giving programme?', options: [
    { value: 'yes', label: 'Yes — formal programme with tiers/bands' },
    { value: 'informal', label: 'We have regular givers but no formal structure' },
    { value: 'no', label: 'No partnership programme' },
  ]},
  { id: 'online_giving', section: 'Giving & Finance', type: 'single', question: 'How do members give financially?', options: [
    { value: 'paystack', label: 'Online via Paystack', sub: 'Nigerian bank transfers, cards, USSD, Verve' },
    { value: 'bank_transfer', label: 'Direct bank transfer', sub: 'Members transfer manually then report' },
    { value: 'cash_only', label: 'Physical cash only' },
    { value: 'mixed', label: 'Mix of cash and digital' },
    { value: 'planning', label: 'Planning to add online giving' },
  ]},

  // COMMS
  { id: 'primary_comms', section: 'Communications', type: 'multi', question: 'How does your church communicate with members?', options: [
    { value: 'whatsapp', label: 'WhatsApp', sub: 'Most common in Nigeria/Africa' }, { value: 'sms', label: 'SMS' },
    { value: 'email', label: 'Email' }, { value: 'phone_call', label: 'Phone call' },
    { value: 'broadcast', label: 'WhatsApp broadcast / group' }, { value: 'telegram', label: 'Telegram' },
    { value: 'church_app', label: 'Church app or website' }, { value: 'in_person', label: 'In-person announcement' },
  ]},
  { id: 'absence_followup', section: 'Communications', type: 'single', question: 'When a member misses a service, how quickly do you follow up?', sub: 'Sets the default absence alert threshold.', options: [
    { value: 'same_day', label: 'Same day or next day' }, { value: 'within_week', label: 'Within the week' },
    { value: 'after_2_misses', label: 'After 2 consecutive misses' }, { value: 'after_month', label: 'After a month' },
    { value: 'no_process', label: 'No formal follow-up process yet' },
  ]},

  // GOALS
  { id: 'primary_goals', section: 'Your Goals', type: 'multi', required: true, question: 'What are your top priorities for using SHEPHERD?', sub: 'Select all that apply.', options: [
    { value: 'attendance', label: 'Track and grow attendance' }, { value: 'member_care', label: 'Improve member care and follow-up' },
    { value: 'giving', label: 'Monitor and grow giving' }, { value: 'cell_growth', label: 'Grow and manage cell groups' },
    { value: 'first_timers', label: 'Convert first timers to members' }, { value: 'departments', label: 'Coordinate ministry departments' },
    { value: 'reporting', label: 'Generate reports for leadership' }, { value: 'partnership', label: 'Manage partnership programme' },
    { value: 'prayer', label: 'Track and respond to prayer requests' }, { value: 'data', label: 'Centralise scattered member data' },
    { value: 'accountability', label: 'Enforce cell leader accountability' }, { value: 'visibility', label: 'Give pastor real-time church visibility' },
  ]},
  { id: 'biggest_challenge', section: 'Your Goals', type: 'multi', required: true, question: 'What are your biggest operational challenges right now?', sub: 'Select all that apply. SHEPHERD will prioritise these in your dashboard.', options: [
    { value: 'data_scattered', label: 'Member data scattered across Excel, WhatsApp, paper' },
    { value: 'no_visibility', label: 'Pastor has no real-time view of the church' },
    { value: 'follow_up_gaps', label: 'Follow-up falls through the cracks' },
    { value: 'cell_no_submit', label: 'Cell leaders not submitting attendance regularly' },
    { value: 'absence_untracked', label: 'Absent members not being identified or reached' },
    { value: 'giving_no_insight', label: 'No visibility into giving trends or patterns' },
    { value: 'first_timer_dropoff', label: 'First timers not being converted to members' },
    { value: 'manual_reports', label: 'Reports are manual and time-consuming to prepare' },
    { value: 'dept_silos', label: 'Departments working in isolation, no coordination' },
    { value: 'partnership_manual', label: 'Partnership tracking done manually or not at all' },
    { value: 'finance_reconcile', label: 'Offering records not reconciled or auditable' },
    { value: 'communication_gaps', label: 'Information doesn\'t reach members consistently' },
    { value: 'no_succession', label: 'No visibility into member growth journey or spiritual progression' },
    { value: 'birthday_missed', label: 'Birthdays and anniversaries missed' },
    { value: 'prayer_untracked', label: 'Prayer requests not tracked or responded to' },
  ]},
  { id: 'timeline', section: 'Your Goals', type: 'single', question: 'How soon do you want SHEPHERD fully operational?', options: [
    { value: 'immediately', label: 'Immediately — ready to go live now' },
    { value: 'weeks_2', label: 'Within 2 weeks', sub: 'Need some data preparation' },
    { value: 'month_1', label: 'Within a month', sub: 'Staff training needed' },
    { value: 'quarter', label: 'This quarter', sub: 'Phased rollout planned' },
  ]},
];

const SECTIONS = ['Identity', 'Size & Scale', 'Church Structure', 'Services', 'Ministries', 'Giving & Finance', 'Communications', 'Your Goals'];

const TIER_DEFAULTS: Record<string, { t1: string; t2: string; t1h: string; t2h: string }> = {
  cell_church: { t1: 'Fellowship', t2: 'Cell', t1h: 'Fellowship Head', t2h: 'Cell Leader' },
  zonal: { t1: 'Zone', t2: 'District', t1h: 'Zonal Pastor', t2h: 'District Leader' },
  campus: { t1: 'Campus', t2: 'Fellowship', t1h: 'Campus Pastor', t2h: 'Fellowship Head' },
  department: { t1: 'Department', t2: 'Unit', t1h: 'Department Head', t2h: 'Unit Leader' },
  house_network: { t1: 'Network', t2: 'Home Group', t1h: 'Network Coordinator', t2h: 'Host Leader' },
  single: { t1: '', t2: '', t1h: 'Pastor', t2h: 'Pastor' },
};

const CURRENCY_MAP: Record<string, string> = {
  Nigeria: 'NGN', Ghana: 'GHS', Kenya: 'KES', 'South Africa': 'ZAR',
  Uganda: 'UGX', Tanzania: 'TZS', Rwanda: 'RWF', Ethiopia: 'ETB',
  'United Kingdom': 'GBP', 'United States': 'USD', Canada: 'CAD', Australia: 'AUD',
  Germany: 'EUR', France: 'EUR', Netherlands: 'EUR',
};

const TZ_MAP: Record<string, string> = {
  Nigeria: 'Africa/Lagos', Ghana: 'Africa/Accra', Kenya: 'Africa/Nairobi',
  'South Africa': 'Africa/Johannesburg', Uganda: 'Africa/Kampala',
  Tanzania: 'Africa/Dar_es_Salaam', Rwanda: 'Africa/Kigali', Ethiopia: 'Africa/Addis_Ababa',
  'United Kingdom': 'Europe/London', 'United States': 'America/New_York',
};

// ── Plan definitions ─────────────────────────────────────────
const PLANS = [
  {
    id: 'starter',
    name: 'Starter',
    price: '₦15,000',
    period: '/month',
    badge: '',
    color: C.teal,
    colorBg: C.tealBg,
    description: 'For small churches getting organised',
    features: [
      'Up to 500 members',
      '1 location',
      'Up to 20 cells/groups',
      'Attendance tracking',
      'Member management',
      'Basic giving records',
      'Email support',
    ],
    limits: ['No AI (Moshe)', 'No partnership portal', 'No SMS alerts'],
  },
  {
    id: 'growth',
    name: 'Growth',
    price: '₦35,000',
    period: '/month',
    badge: 'Most popular',
    color: C.purple,
    colorBg: C.purpleBg,
    description: 'For growing churches that need full intelligence',
    features: [
      'Up to 5,000 members',
      'Up to 10 locations',
      'Unlimited cells/groups',
      'Moshe AI agent',
      'Partnership portal',
      'SMS & WhatsApp alerts',
      'Full analytics & reports',
      'Priority support',
    ],
    limits: [],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 'Custom',
    period: '',
    badge: '',
    color: C.amber,
    colorBg: C.amberBg,
    description: 'For denominations and large multi-site churches',
    features: [
      'Unlimited members & locations',
      'Multi-currency support',
      'White-label branding',
      'Custom integrations',
      'API access',
      'Dedicated account manager',
      'SLA guarantee',
    ],
    limits: [],
  },
];

// ── Live preview ─────────────────────────────────────────────
function PreviewPanel({ answers }: { answers: Record<string, Answer> }) {
  const name = (answers.church_name as string) || 'Your Church';
  const struct = (answers.structure_type as string) || 'cell_church';
  const td = TIER_DEFAULTS[struct] || TIER_DEFAULTS.cell_church;
  const tier1 = (answers.tier1_label as string) || td.t1;
  const tier2 = (answers.tier2_label as string) || td.t2;
  const country = (answers.country as string) || 'Nigeria';
  const currency = CURRENCY_MAP[country] || 'NGN';
  const currSym = currency === 'NGN' ? '₦' : currency === 'GHS' ? 'GH₵' : currency === 'KES' ? 'KSh' : currency === 'ZAR' ? 'R' : currency === 'GBP' ? '£' : currency === 'USD' ? '$' : currency;
  const size = (answers.congregation_size as string) || '';
  const sizeLabel = { under_100: '<100', '100_500': '100–500', '500_2000': '500–2k', '2000_10000': '2k–10k', above_10000: '10k+' }[size] || '—';
  const days = (answers.service_days as string[]) || [];

  const nav = ['Dashboard', 'Members', tier1 ? `${tier1}s` : 'Groups', tier2 ? `${tier2} Ministry` : 'Cells', 'Attendance', 'Giving', 'Reports', 'Settings'];

  return (
    <div style={{ background: C.white, borderRadius: 14, overflow: 'hidden', boxShadow: '0 8px 32px rgba(83,74,183,0.15)', border: `0.5px solid ${C.border}` }}>
      <div style={{ background: C.purpleDark, padding: '9px 12px', display: 'flex', alignItems: 'center', gap: 6 }}>
        {['#FF5F57','#FFBD2E','#28C840'].map(c => <div key={c} style={{ width: 7, height: 7, borderRadius: '50%', background: c }} />)}
        <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', marginLeft: 6, fontFamily: 'monospace' }}>shepherd-app / dashboard</div>
      </div>
      <div style={{ display: 'flex', height: 320 }}>
        <div style={{ width: 130, background: C.purpleDark, padding: '12px 0', display: 'flex', flexDirection: 'column', gap: 1, flexShrink: 0 }}>
          <div style={{ padding: '0 10px 10px', borderBottom: '0.5px solid rgba(255,255,255,0.07)', marginBottom: 4 }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: C.white, letterSpacing: '0.3px' }}>SHEP.HERD</div>
            <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.4)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</div>
          </div>
          {nav.map((item, i) => (
            <div key={i} style={{ padding: '6px 10px', margin: '0 5px', borderRadius: 5, background: i === 0 ? 'rgba(255,255,255,0.11)' : 'transparent', display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: i === 0 ? C.purpleLight : 'rgba(255,255,255,0.15)' }} />
              <div style={{ fontSize: 9, color: i === 0 ? C.white : 'rgba(255,255,255,0.45)', fontWeight: i === 0 ? 600 : 400, whiteSpace: 'nowrap' }}>{item}</div>
            </div>
          ))}
        </div>
        <div style={{ flex: 1, padding: '12px', background: C.bg, overflow: 'hidden' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: C.text, marginBottom: 8 }}>Dashboard · {name.slice(0,20)}{name.length > 20 ? '…' : ''}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5, marginBottom: 8 }}>
            {[{ l: 'Members', v: sizeLabel }, { l: 'Currency', v: `${currSym} ${currency}` }, { l: tier1 || 'Groups', v: '—' }, { l: 'Services', v: days.length ? days.map(d => d.slice(0,3)).join(' · ') : '—' }].map((k, i) => (
              <div key={i} style={{ background: C.white, borderRadius: 6, padding: '7px 9px', border: `0.5px solid ${C.border}` }}>
                <div style={{ fontSize: 7, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.3px', marginBottom: 2 }}>{k.l}</div>
                <div style={{ fontSize: 10, fontWeight: 700, color: C.text }}>{k.v}</div>
              </div>
            ))}
          </div>
          <div style={{ background: C.white, borderRadius: 7, padding: '9px', border: `0.5px solid ${C.border}` }}>
            <div style={{ fontSize: 7, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.3px', marginBottom: 7 }}>Church Structure</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
              {[name.split(' ')[0], tier1, tier2, 'Member'].filter(Boolean).map((t, i, arr) => (
                <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ fontSize: 8, background: i === 0 ? C.purpleDark : i === arr.length - 1 ? C.tealBg : C.purpleBg, color: i === 0 ? C.white : i === arr.length - 1 ? C.teal : C.purple, borderRadius: 4, padding: '2px 7px', fontWeight: 600 }}>{t}</span>
                  {i < arr.length - 1 && <span style={{ fontSize: 8, color: C.muted }}>›</span>}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Plan selection screen ────────────────────────────────────
function PlanScreen({ answers, onSelect }: { answers: Record<string, Answer>; onSelect: (plan: string) => void }) {
  const [selected, setSelected] = useState('growth');
  const churchName = (answers.church_name as string) || 'Your Church';

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: 'var(--font-inter, -apple-system, Inter, sans-serif)', background: C.bg }}>
      <div style={{ flex: 1, padding: '48px', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 48 }}>
          <div style={{ width: 32, height: 32, background: C.purple, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: 16, height: 16, background: C.white, borderRadius: 3 }} />
          </div>
          <span style={{ fontSize: 16, fontWeight: 800, color: C.purpleDark }}>SHEP.HERD</span>
        </div>

        <div style={{ maxWidth: 560 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: C.purple, textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 8 }}>One last step</div>
          <div style={{ fontSize: 26, fontWeight: 700, color: C.text, letterSpacing: '-0.5px', marginBottom: 10 }}>Choose your plan</div>
          <div style={{ fontSize: 14, color: C.sub, marginBottom: 32, lineHeight: 1.6 }}>
            You get <strong>30 days full access</strong> on the plan you choose — no card needed. After 30 days, stay on your plan or upgrade. You can change anytime.
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 28 }}>
            {PLANS.map(plan => (
              <button key={plan.id} onClick={() => setSelected(plan.id)}
                style={{ display: 'flex', alignItems: 'flex-start', gap: 16, padding: '18px 20px', borderRadius: 14, border: `${selected === plan.id ? '1.5px' : '0.5px'} solid ${selected === plan.id ? plan.color : C.border}`, background: selected === plan.id ? plan.colorBg : C.white, cursor: 'pointer', textAlign: 'left', width: '100%', transition: 'all 0.15s', position: 'relative' }}>
                {plan.badge && (
                  <div style={{ position: 'absolute', top: -10, left: 20, background: plan.color, color: C.white, fontSize: 10, fontWeight: 700, borderRadius: 20, padding: '2px 10px' }}>{plan.badge}</div>
                )}
                <div style={{ width: 20, height: 20, borderRadius: '50%', border: `2px solid ${selected === plan.id ? plan.color : C.border}`, background: selected === plan.id ? plan.color : 'transparent', flexShrink: 0, marginTop: 2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {selected === plan.id && <div style={{ width: 6, height: 6, borderRadius: '50%', background: C.white }} />}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{plan.name}</div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: 18, fontWeight: 800, color: plan.color }}>{plan.price}</span>
                      {plan.period && <span style={{ fontSize: 12, color: C.muted }}>{plan.period}</span>}
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: C.sub, marginBottom: 10 }}>{plan.description}</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {plan.features.slice(0, 4).map((f, i) => (
                      <span key={i} style={{ fontSize: 11, background: selected === plan.id ? 'rgba(255,255,255,0.7)' : C.purpleFaint, color: C.sub, borderRadius: 6, padding: '2px 8px' }}>✓ {f}</span>
                    ))}
                    {plan.features.length > 4 && <span style={{ fontSize: 11, color: C.muted }}>+{plan.features.length - 4} more</span>}
                  </div>
                </div>
              </button>
            ))}
          </div>

          <button onClick={() => onSelect(selected)}
            style={{ width: '100%', background: C.purple, color: C.white, border: 'none', borderRadius: 12, padding: '15px', fontSize: 15, fontWeight: 700, cursor: 'pointer', marginBottom: 12 }}>
            Start 30-day free trial on {PLANS.find(p => p.id === selected)?.name} →
          </button>
          <div style={{ fontSize: 12, color: C.muted, textAlign: 'center' }}>
            No credit card required. Cancel anytime. Full access for 30 days.
          </div>
        </div>
      </div>

      <div style={{ width: '380px', background: C.purpleDark, minHeight: '100vh', display: 'flex', flexDirection: 'column', padding: '48px 36px', boxSizing: 'border-box' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.white, marginBottom: 20 }}>What you get on {PLANS.find(p => p.id === selected)?.name}</div>
        {PLANS.find(p => p.id === selected)?.features.map((f, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <div style={{ width: 18, height: 18, borderRadius: '50%', background: C.teal, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <span style={{ fontSize: 10, color: C.white, fontWeight: 700 }}>✓</span>
            </div>
            <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.85)' }}>{f}</span>
          </div>
        ))}
        {(PLANS.find(p => p.id === selected)?.limits || []).length > 0 && (
          <>
            <div style={{ borderTop: '0.5px solid rgba(255,255,255,0.1)', margin: '16px 0', paddingTop: 16, fontSize: 11, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Not included</div>
            {PLANS.find(p => p.id === selected)?.limits?.map((l, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <div style={{ width: 18, height: 18, borderRadius: '50%', background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>—</span>
                </div>
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>{l}</span>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────
export default function SetupWizard() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [screen, setScreen] = useState<'questions' | 'plan' | 'saving'>('questions');
  const [qIndex, setQIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [textVal, setTextVal] = useState('');
  const [numberVal, setNumberVal] = useState('');
  const [countrySearch, setCountrySearch] = useState('');
  const [transitioning, setTransitioning] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMounted(true);
    // Check if user is logged in - setup requires auth
    fetch('/api/auth/me', { credentials: 'include' })
      .then(r => {
        if (!r.ok) {
          // Not logged in - redirect to login with next=/setup
          window.location.href = '/login?next=/setup';
        }
      })
      .catch(() => {});
  }, []);

  const question = QUESTIONS[qIndex];
  const totalQ = QUESTIONS.length;
  const currentSection = question?.section;
  const sectionIndex = SECTIONS.indexOf(currentSection);
  const progress = (qIndex / totalQ) * 100;

  // Auto-fill tier labels when structure is picked
  useEffect(() => {
    if (!question) return;
    if (question.type === 'text') {
      setTextVal((answers[question.id] as string) || '');
    }
    if (question.type === 'number') {
      setNumberVal(String(answers[question.id] || ''));
    }
    if (question.id === 'tier1_label' && !answers.tier1_label) {
      const td = TIER_DEFAULTS[answers.structure_type as string] || TIER_DEFAULTS.cell_church;
      setTextVal(td.t1);
    }
    if (question.id === 'tier2_label' && !answers.tier2_label) {
      const td = TIER_DEFAULTS[answers.structure_type as string] || TIER_DEFAULTS.cell_church;
      setTextVal(td.t2);
    }
    if (question.id === 'tier1_head_label' && !answers.tier1_head_label) {
      const td = TIER_DEFAULTS[answers.structure_type as string] || TIER_DEFAULTS.cell_church;
      setTextVal(td.t1h);
    }
    if (question.id === 'tier2_head_label' && !answers.tier2_head_label) {
      const td = TIER_DEFAULTS[answers.structure_type as string] || TIER_DEFAULTS.cell_church;
      setTextVal(td.t2h);
    }
    setTimeout(() => inputRef.current?.focus(), 100);
  }, [qIndex]);

  function saveAnswer(val: Answer) {
    setAnswers(prev => ({ ...prev, [question.id]: val }));
  }

  function currentAnswer(): Answer { return answers[question.id] ?? null; }

  function canAdvance(): boolean {
    if (!question.required) return true;
    const ans = currentAnswer();
    if (question.type === 'text') return textVal.trim().length > 0;
    if (question.type === 'number') return numberVal.trim().length > 0;
    if (question.type === 'country') return !!ans;
    if (question.type === 'multi') return Array.isArray(ans) && (ans as string[]).length > 0;
    return ans !== null;
  }

  function go(dir: 1 | -1) {
    if (question.type === 'text') setAnswers(p => ({ ...p, [question.id]: textVal.trim() }));
    if (question.type === 'number') setAnswers(p => ({ ...p, [question.id]: numberVal }));

    setTransitioning(true);
    setTimeout(() => {
      const next = qIndex + dir;
      if (dir === 1 && next >= QUESTIONS.length) {
        setScreen('plan');
      } else {
        // Skip tier labels for single congregation
        let idx = next;
        if (dir === 1 && answers.structure_type === 'single') {
          while (idx < QUESTIONS.length && ['tier1_label','tier2_label','tier1_head_label','tier2_head_label'].includes(QUESTIONS[idx]?.id)) idx++;
        }
        setQIndex(Math.max(0, Math.min(QUESTIONS.length - 1, idx)));
      }
      setTransitioning(false);
    }, 180);
  }

  function toggleMulti(val: string) {
    const current = (answers[question.id] as string[]) || [];
    saveAnswer(current.includes(val) ? current.filter(v => v !== val) : [...current, val]);
  }

  async function finish(planTier: string) {
    setScreen('saving');
    const a = { ...answers };

    const struct = (a.structure_type as StructureType) || 'cell_church';
    const td = TIER_DEFAULTS[struct] || TIER_DEFAULTS.cell_church;
    const country = (a.country as string) || 'Nigeria';

    const payload = {
      church_name: (a.church_name as string) || 'My Church',
      structure_type: struct,
      tier1_label: (a.tier1_label as string) || td.t1 || null,
      tier2_label: (a.tier2_label as string) || td.t2 || null,
      tier3_label: null,
      tier1_head_label: (a.tier1_head_label as string) || td.t1h,
      tier2_head_label: (a.tier2_head_label as string) || td.t2h,
      currency: CURRENCY_MAP[country] || 'NGN',
      country,
      timezone: TZ_MAP[country] || 'Africa/Lagos',
      service_days: (a.service_days as string[]) || ['Sunday'],
      is_configured: true,
      plan_tier: planTier,
      church_profile: JSON.stringify({
        denomination: a.denomination,
        founded_year: a.founded_year,
        congregation_size: a.congregation_size,
        location_count: a.location_count,
        staff_count: a.staff_count,
        services_per_main_day: a.services_per_main_day,
        cell_meeting_day: a.cell_meeting_day,
        has_children: a.has_children,
        has_youth: a.has_youth,
        departments: a.departments,
        giving_types: a.giving_types,
        has_partnership: a.has_partnership,
        online_giving: a.online_giving,
        primary_comms: a.primary_comms,
        absence_followup: a.absence_followup,
        primary_goals: a.primary_goals,
        biggest_challenge: a.biggest_challenge,
        timeline: a.timeline,
      }),
    };

    try {
      const res = await fetch('/api/settings/church-config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        // Force fresh config load on dashboard
        router.push('/dashboard?onboarded=1');
      } else {
        const d = await res.json();
        const msg = d?.error?.message || 'Failed to save.';
        if (res.status === 401) {
          setError('You need to be logged in to complete setup. Please sign in as an overseer or lead tech, then return to /setup.');
        } else {
          setError(msg + ' Make sure you are logged in as overseer or lead tech.');
        }
        setScreen('plan');
      }
    } catch {
      setError('Network error. Please check your connection.');
      setScreen('plan');
    }
  }

  if (!mounted) return null;
  if (screen === 'plan') return <PlanScreen answers={answers} onSelect={finish} />;
  if (screen === 'saving') return (
    <div style={{ minHeight: '100vh', background: C.purpleDark, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20 }}>
      <div style={{ width: 48, height: 48, border: `3px solid rgba(255,255,255,0.2)`, borderTopColor: C.white, borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
      <div style={{ fontSize: 16, color: C.white, fontWeight: 500 }}>Setting up your church…</div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  const ans = currentAnswer();
  const filteredCountries = countrySearch ? ALL_COUNTRIES.filter(c => c.label.toLowerCase().includes(countrySearch.toLowerCase())) : ALL_COUNTRIES;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', fontFamily: 'var(--font-inter, -apple-system, Inter, sans-serif)', background: C.bg }}>

      {/* ── LEFT ── */}
      <div style={{ width: '55%', minHeight: '100vh', display: 'flex', flexDirection: 'column', padding: '40px 52px', boxSizing: 'border-box', overflowY: 'auto' }}>

        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 44 }}>
          <div style={{ width: 30, height: 30, background: C.purple, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: 14, height: 14, background: C.white, borderRadius: 3 }} />
          </div>
          <span style={{ fontSize: 15, fontWeight: 800, color: C.purpleDark, letterSpacing: '-0.3px' }}>SHEP.HERD</span>
        </div>

        {/* Section + progress */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: C.purple, textTransform: 'uppercase', letterSpacing: '0.6px' }}>
              {sectionIndex + 1} / {SECTIONS.length} — {currentSection}
            </span>
            <span style={{ fontSize: 11, color: C.muted }}>{qIndex + 1} of {totalQ}</span>
          </div>
          <div style={{ height: 3, background: C.border, borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${progress}%`, background: `linear-gradient(90deg, ${C.purple}, ${C.purpleLight})`, borderRadius: 3, transition: 'width 0.4s ease' }} />
          </div>
        </div>

        {/* Question content */}
        <div style={{ flex: 1, opacity: transitioning ? 0 : 1, transition: 'opacity 0.18s ease', transform: transitioning ? 'translateY(6px)' : 'translateY(0)' }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: C.text, lineHeight: 1.35, marginBottom: 8, letterSpacing: '-0.3px' }}>
            {question?.question}
          </div>
          {question?.sub && (
            <div style={{ fontSize: 13, color: C.sub, lineHeight: 1.6, marginBottom: 24 }}>{question.sub}</div>
          )}

          {/* SINGLE */}
          {question?.type === 'single' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {question.options?.map(opt => (
                <button key={opt.value}
                  onClick={() => { saveAnswer(opt.value); setTimeout(() => go(1), 120); }}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '12px 16px', borderRadius: 11, border: `${ans === opt.value ? '1.5px' : '1px'} solid ${ans === opt.value ? C.purple : C.border}`, background: ans === opt.value ? C.purpleBg : C.white, cursor: 'pointer', textAlign: 'left', width: '100%', transition: 'all 0.12s' }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 500, color: C.text }}>{opt.label}</div>
                    {opt.sub && <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{opt.sub}</div>}
                  </div>
                  <div style={{ width: 16, height: 16, borderRadius: '50%', border: `2px solid ${ans === opt.value ? C.purple : C.border}`, background: ans === opt.value ? C.purple : 'transparent', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {ans === opt.value && <div style={{ width: 5, height: 5, borderRadius: '50%', background: C.white }} />}
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* MULTI */}
          {question?.type === 'multi' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {question.options?.map(opt => {
                const selected = ((ans as string[]) || []).includes(opt.value);
                return (
                  <button key={opt.value} onClick={() => toggleMulti(opt.value)}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '11px 15px', borderRadius: 10, border: `${selected ? '1.5px' : '1px'} solid ${selected ? C.purple : C.border}`, background: selected ? C.purpleBg : C.white, cursor: 'pointer', textAlign: 'left', width: '100%', transition: 'all 0.12s' }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: selected ? 500 : 400, color: C.text }}>{opt.label}</div>
                      {opt.sub && <div style={{ fontSize: 11, color: C.muted, marginTop: 1 }}>{opt.sub}</div>}
                    </div>
                    <div style={{ width: 16, height: 16, borderRadius: 4, border: `2px solid ${selected ? C.purple : C.border}`, background: selected ? C.purple : 'transparent', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {selected && <span style={{ color: C.white, fontSize: 10, fontWeight: 700 }}>✓</span>}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* TEXT */}
          {question?.type === 'text' && (
            <div>
              <input ref={inputRef} value={textVal} onChange={e => setTextVal(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && canAdvance()) go(1); }}
                placeholder={question.placeholder}
                style={{ width: '100%', border: `1px solid ${textVal ? C.purple : C.border}`, borderRadius: 10, padding: '13px 15px', fontSize: 15, background: C.white, color: C.text, outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.15s' }} />
              <div style={{ fontSize: 11, color: C.muted, marginTop: 8 }}>Press Enter to continue</div>
            </div>
          )}

          {/* NUMBER */}
          {question?.type === 'number' && (
            <div>
              <input ref={inputRef} type="number" value={numberVal} onChange={e => setNumberVal(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && canAdvance()) go(1); }}
                placeholder={question.placeholder} min={question.min} max={question.max}
                style={{ width: 200, border: `1px solid ${numberVal ? C.purple : C.border}`, borderRadius: 10, padding: '13px 15px', fontSize: 15, background: C.white, color: C.text, outline: 'none', transition: 'border-color 0.15s' }} />
              <div style={{ fontSize: 11, color: C.muted, marginTop: 8 }}>Press Enter to continue</div>
            </div>
          )}

          {/* COUNTRY */}
          {question?.type === 'country' && (
            <div>
              <input ref={inputRef} value={countrySearch} onChange={e => setCountrySearch(e.target.value)}
                placeholder="Search or type your country…"
                style={{ width: '100%', border: `1px solid ${C.border}`, borderRadius: 10, padding: '11px 15px', fontSize: 14, background: C.white, color: C.text, outline: 'none', boxSizing: 'border-box', marginBottom: 10 }} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 320, overflowY: 'auto' }}>
                {filteredCountries.map(c => (
                  <button key={c.value} onClick={() => { saveAnswer(c.value); setCountrySearch(''); setTimeout(() => go(1), 120); }}
                    style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 9, border: `${ans === c.value ? '1.5px' : '1px'} solid ${ans === c.value ? C.purple : C.border}`, background: ans === c.value ? C.purpleBg : C.white, cursor: 'pointer', textAlign: 'left', transition: 'all 0.12s' }}>
                    <span style={{ fontSize: 18 }}>{c.icon}</span>
                    <span style={{ fontSize: 13, fontWeight: ans === c.value ? 600 : 400, color: C.text }}>{c.label}</span>
                    {ans === c.value && <span style={{ marginLeft: 'auto', fontSize: 11, color: C.purple, fontWeight: 600 }}>✓</span>}
                  </button>
                ))}
                {filteredCountries.length === 0 && (
                  <button onClick={() => { saveAnswer(countrySearch); setTimeout(() => go(1), 120); }}
                    style={{ padding: '11px 14px', borderRadius: 9, border: `1px solid ${C.border}`, background: C.white, cursor: 'pointer', textAlign: 'left', fontSize: 13, color: C.text }}>
                    Use "{countrySearch}" as my country
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Nav buttons */}
        <div style={{ paddingTop: 28 }}>
          {error && <div style={{ background: C.coralBg, color: C.coral, borderRadius: 9, padding: '10px 14px', fontSize: 13, marginBottom: 14, fontWeight: 500 }}>{error}</div>}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {qIndex > 0 && (
              <button onClick={() => go(-1)}
                style={{ padding: '11px 18px', borderRadius: 9, border: `1px solid ${C.border}`, background: C.white, color: C.sub, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
                ← Back
              </button>
            )}
            {/* Continue button for multi, text, number */}
            {(question?.type === 'multi' || question?.type === 'text' || question?.type === 'number') && (
              <button onClick={() => go(1)} disabled={!canAdvance()}
                style={{ flex: 1, padding: '12px 22px', borderRadius: 9, border: 'none', background: canAdvance() ? C.purple : C.border, color: C.white, fontSize: 14, fontWeight: 600, cursor: canAdvance() ? 'pointer' : 'default', transition: 'background 0.2s' }}>
                {qIndex === QUESTIONS.length - 1 ? 'Choose your plan →' : 'Continue →'}
              </button>
            )}
            {/* Single select: always show Continue, dimmed until selection made */}
            {question?.type === 'single' && (
              <button onClick={() => go(1)} disabled={question.required && !currentAnswer()}
                style={{ flex: 1, padding: '12px 22px', borderRadius: 9, border: 'none', background: (question.required && !currentAnswer()) ? C.border : C.purple, color: C.white, fontSize: 14, fontWeight: 600, cursor: (question.required && !currentAnswer()) ? 'default' : 'pointer', transition: 'background 0.2s' }}>
                {qIndex === QUESTIONS.length - 1 ? 'Choose your plan →' : 'Continue →'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── RIGHT ── */}
      <div style={{ width: '45%', background: C.purpleDark, minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 40px', boxSizing: 'border-box', position: 'sticky', top: 0, height: '100vh', overflowY: 'auto' }}>

        {/* Section tracker */}
        <div style={{ width: '100%', maxWidth: 340, marginBottom: 28 }}>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 12 }}>Setup progress</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {SECTIONS.map((sec, i) => {
              const secQs = QUESTIONS.filter(q => q.section === sec);
              const answered = secQs.filter(q => answers[q.id] !== undefined && answers[q.id] !== null).length;
              const isActive = sec === currentSection;
              const isDone = i < sectionIndex;
              return (
                <div key={sec} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 18, height: 18, borderRadius: '50%', flexShrink: 0, background: isDone ? C.teal : isActive ? C.white : 'rgba(255,255,255,0.08)', border: `1.5px solid ${isDone ? C.teal : isActive ? C.white : 'rgba(255,255,255,0.12)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {isDone ? <span style={{ fontSize: 9, color: C.white, fontWeight: 700 }}>✓</span> : isActive ? <div style={{ width: 5, height: 5, borderRadius: '50%', background: C.purple }} /> : null}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 11, fontWeight: isActive ? 600 : 400, color: isActive ? C.white : isDone ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.25)' }}>{sec}</div>
                    {isActive && <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginTop: 1 }}>{answered} of {secQs.length} answered</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Live preview */}
        <div style={{ width: '100%', maxWidth: 340 }}>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 10 }}>Live preview</div>
          <PreviewPanel answers={answers} />
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', textAlign: 'center', marginTop: 8 }}>Updates as you answer</div>
        </div>
      </div>
    </div>
  );
}
