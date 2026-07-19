'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { type StructureType } from '@/lib/church-config';

// ─── Brand tokens ────────────────────────────────────────────
const C = {
  purple: '#534AB7', purpleDark: '#3C3489', purpleLight: '#7B74CC',
  purpleBg: '#EEEDFE', purpleFaint: '#F7F6FF',
  teal: '#1D9E75', tealBg: '#E1F5EE',
  coral: '#D85A30', coralBg: '#FAECE7',
  amber: '#BA7517', amberBg: '#FAEEDA',
  text: '#0F0A2E', sub: '#4A4272', muted: '#9890C4',
  border: 'rgba(83,74,183,0.12)', borderStrong: 'rgba(83,74,183,0.25)',
  white: '#FFFFFF', bg: '#F4F3FB',
};

// ─── Question types ──────────────────────────────────────────
type Answer = string | string[] | number | null;
type QuestionType = 'single' | 'multi' | 'text' | 'number' | 'scale' | 'date' | 'grid';

interface Question {
  id: string;
  section: string;
  type: QuestionType;
  question: string;
  sub?: string;
  options?: { value: string; label: string; sub?: string; icon?: string }[];
  placeholder?: string;
  min?: number; max?: number;
  required?: boolean;
  gridCols?: string[];
  gridRows?: string[];
}

// ─── Full question bank ──────────────────────────────────────
const QUESTIONS: Question[] = [
  // SECTION 1 — Identity
  {
    id: 'church_name', section: 'Identity', type: 'text', required: true,
    question: 'What is the full name of your church?',
    sub: 'This appears across all portals, reports, and communications.',
    placeholder: 'e.g. The Comforters House Global',
  },
  {
    id: 'country', section: 'Identity', type: 'single', required: true,
    question: 'Where is your church headquartered?',
    sub: 'This determines currency, date formatting, and SMS provider routing.',
    options: [
      { value: 'Nigeria', label: 'Nigeria', icon: '🇳🇬' },
      { value: 'Ghana', label: 'Ghana', icon: '🇬🇭' },
      { value: 'Kenya', label: 'Kenya', icon: '🇰🇪' },
      { value: 'South Africa', label: 'South Africa', icon: '🇿🇦' },
      { value: 'Uganda', label: 'Uganda', icon: '🇺🇬' },
      { value: 'United Kingdom', label: 'United Kingdom', icon: '🇬🇧' },
      { value: 'United States', label: 'United States', icon: '🇺🇸' },
      { value: 'Other', label: 'Other country', icon: '🌍' },
    ],
  },
  {
    id: 'denomination', section: 'Identity', type: 'single',
    question: 'What is your church\'s denomination or movement?',
    sub: 'Helps SHEPHERD configure default workflows and terminology.',
    options: [
      { value: 'pentecostal', label: 'Pentecostal / Charismatic', sub: 'RCCG, Winners, CAC, MFM, COZA, Deeper Life' },
      { value: 'evangelical', label: 'Evangelical / Baptist', sub: 'SBC, Evangelical Church, ECWA' },
      { value: 'methodist', label: 'Methodist / Anglican', sub: 'Methodist Church, Anglican Diocese' },
      { value: 'catholic', label: 'Catholic', sub: 'Roman Catholic, Orthodox' },
      { value: 'apostolic', label: 'Apostolic / Prophetic', sub: 'Apostolic Faith, New Apostolic' },
      { value: 'interdenominational', label: 'Interdenominational', sub: 'Non-denominational, independent' },
      { value: 'other', label: 'Other', sub: 'Not listed above' },
    ],
  },
  {
    id: 'founded_year', section: 'Identity', type: 'number',
    question: 'What year was your church founded?',
    sub: 'Used for anniversary tracking and milestone reports.',
    placeholder: 'e.g. 1998',
    min: 1800, max: 2026,
  },

  // SECTION 2 — Size & Scale
  {
    id: 'congregation_size', section: 'Size & Scale', type: 'single', required: true,
    question: 'How large is your congregation?',
    sub: 'An approximate count of active adult members.',
    options: [
      { value: 'under_100', label: 'Under 100 members', sub: 'Plant, emerging church' },
      { value: '100_500', label: '100 – 500 members', sub: 'Growing church' },
      { value: '500_2000', label: '500 – 2,000 members', sub: 'Mid-size church' },
      { value: '2000_10000', label: '2,000 – 10,000 members', sub: 'Large church' },
      { value: 'above_10000', label: 'Above 10,000 members', sub: 'Megachurch' },
    ],
  },
  {
    id: 'location_count', section: 'Size & Scale', type: 'single', required: true,
    question: 'How many physical locations does your church operate?',
    sub: 'Includes branches, campuses, satellite churches, and mission stations.',
    options: [
      { value: '1', label: 'One location', sub: 'Single congregation' },
      { value: '2_5', label: '2 – 5 locations', sub: 'Small multi-site' },
      { value: '6_20', label: '6 – 20 locations', sub: 'Growing multi-site' },
      { value: '21_100', label: '21 – 100 locations', sub: 'Denomination or network' },
      { value: 'above_100', label: 'Above 100 locations', sub: 'Large denomination' },
    ],
  },
  {
    id: 'staff_count', section: 'Size & Scale', type: 'single',
    question: 'How many paid staff does your church employ?',
    sub: 'Includes full-time and part-time administrative and pastoral staff.',
    options: [
      { value: 'none', label: 'No paid staff', sub: 'Fully volunteer-led' },
      { value: '1_5', label: '1 – 5 staff', sub: 'Small team' },
      { value: '6_20', label: '6 – 20 staff', sub: 'Medium team' },
      { value: '21_50', label: '21 – 50 staff', sub: 'Large team' },
      { value: 'above_50', label: 'Above 50 staff', sub: 'Institutional' },
    ],
  },

  // SECTION 3 — Structure
  {
    id: 'structure_type', section: 'Church Structure', type: 'single', required: true,
    question: 'How is your church organised internally?',
    sub: 'This determines which portals, roles, and hierarchy appear in SHEPHERD.',
    options: [
      { value: 'cell_church', label: 'Fellowship → Cell → Member', sub: 'RCCG, Comforters House, City churches' },
      { value: 'zonal', label: 'Zone → District → Cell → Member', sub: 'Winners Chapel, CAC, classical Pentecostal' },
      { value: 'campus', label: 'Campus → Fellowship → Cell → Member', sub: 'Multi-site, Hillsong-style' },
      { value: 'department', label: 'Department → Unit → Member', sub: 'Cathedral, liturgical churches' },
      { value: 'house_network', label: 'Network → Home Group → Member', sub: 'Organic, new-generation churches' },
      { value: 'single', label: 'Pastor → Member (no sub-structure)', sub: 'Small, plant, or rural church' },
    ],
  },
  {
    id: 'tier1_label', section: 'Church Structure', type: 'text',
    question: 'What do you call your first tier of organisation?',
    sub: 'The top-level grouping under the main church. Pre-filled from your structure — change it to match your church\'s language.',
    placeholder: 'e.g. Fellowship, Zone, Campus, District',
  },
  {
    id: 'tier2_label', section: 'Church Structure', type: 'text',
    question: 'What do you call your second tier?',
    sub: 'The groups within each first tier. This is typically where members belong.',
    placeholder: 'e.g. Cell, Home Group, Unit, Bible Study',
  },
  {
    id: 'tier1_head_label', section: 'Church Structure', type: 'text',
    question: 'What title does a first-tier leader carry?',
    placeholder: 'e.g. Fellowship Head, Zonal Pastor, Campus Director',
  },
  {
    id: 'tier2_head_label', section: 'Church Structure', type: 'text',
    question: 'What title does a second-tier leader carry?',
    placeholder: 'e.g. Cell Leader, Home Group Host, District Pastor',
  },

  // SECTION 4 — Services
  {
    id: 'service_days', section: 'Services & Gatherings', type: 'multi', required: true,
    question: 'Which days does your church hold regular services?',
    sub: 'These determine attendance submission windows and absence alerts.',
    options: [
      { value: 'Sunday', label: 'Sunday', sub: 'Main service' },
      { value: 'Wednesday', label: 'Wednesday', sub: 'Midweek service' },
      { value: 'Friday', label: 'Friday', sub: 'Friday service / vigil' },
      { value: 'Saturday', label: 'Saturday', sub: 'Saturday service' },
      { value: 'Monday', label: 'Monday', sub: 'Monday service' },
      { value: 'Tuesday', label: 'Tuesday', sub: '' },
      { value: 'Thursday', label: 'Thursday', sub: '' },
    ],
  },
  {
    id: 'services_per_sunday', section: 'Services & Gatherings', type: 'single',
    question: 'How many services do you hold on your main service day?',
    sub: 'Used for attendance tracking per service.',
    options: [
      { value: '1', label: '1 service' },
      { value: '2', label: '2 services' },
      { value: '3', label: '3 services' },
      { value: '4_plus', label: '4 or more services' },
    ],
  },
  {
    id: 'cell_meeting_day', section: 'Services & Gatherings', type: 'single',
    question: 'Which day do your cells or small groups typically meet?',
    sub: 'Helps SHEPHERD send cell submission reminders on the right day.',
    options: [
      { value: 'Monday', label: 'Monday' },
      { value: 'Tuesday', label: 'Tuesday' },
      { value: 'Wednesday', label: 'Wednesday' },
      { value: 'Thursday', label: 'Thursday' },
      { value: 'Friday', label: 'Friday' },
      { value: 'Saturday', label: 'Saturday' },
      { value: 'varies', label: 'Varies by cell' },
    ],
  },

  // SECTION 5 — Ministries
  {
    id: 'has_children', section: 'Ministries', type: 'single',
    question: 'Does your church have a children\'s ministry?',
    sub: 'Enables CYDF headcount tracking and age-group intelligence.',
    options: [
      { value: 'yes_active', label: 'Yes — active and structured', sub: 'Dedicated children\'s church or Sunday school' },
      { value: 'yes_informal', label: 'Yes — informal', sub: 'Children attend but no formal programme' },
      { value: 'no', label: 'Not yet', sub: 'No children\'s ministry currently' },
    ],
  },
  {
    id: 'has_youth', section: 'Ministries', type: 'single',
    question: 'Does your church have a youth ministry?',
    options: [
      { value: 'yes_active', label: 'Yes — active and structured' },
      { value: 'yes_informal', label: 'Yes — informal' },
      { value: 'no', label: 'Not yet' },
    ],
  },
  {
    id: 'departments', section: 'Ministries', type: 'multi',
    question: 'Which departments or ministries are active in your church?',
    sub: 'Select all that apply. Enables department-specific portals and tracking.',
    options: [
      { value: 'ushering', label: 'Ushering & Protocol' },
      { value: 'worship', label: 'Worship & Music' },
      { value: 'media', label: 'Media & Technology' },
      { value: 'prayer', label: 'Prayer & Intercession' },
      { value: 'evangelism', label: 'Evangelism & Outreach' },
      { value: 'welfare', label: 'Welfare & Care' },
      { value: 'hospitality', label: 'Hospitality' },
      { value: 'security', label: 'Security' },
      { value: 'sanitation', label: 'Sanitation & Environment' },
      { value: 'men', label: 'Men\'s Fellowship' },
      { value: 'women', label: 'Women\'s Fellowship' },
      { value: 'singles', label: 'Singles Ministry' },
      { value: 'marriage', label: 'Marriage & Family' },
    ],
  },

  // SECTION 6 — Giving & Finance
  {
    id: 'giving_types', section: 'Giving & Finance', type: 'multi',
    question: 'Which giving types does your church collect?',
    sub: 'These become your income categories in accounts.',
    options: [
      { value: 'tithe', label: 'Tithe' },
      { value: 'offering', label: 'General Offering' },
      { value: 'special', label: 'Special Offering' },
      { value: 'project', label: 'Project / Building Fund' },
      { value: 'first_fruit', label: 'First Fruit' },
      { value: 'thanksgiving', label: 'Thanksgiving' },
      { value: 'welfare', label: 'Welfare / Benevolence' },
      { value: 'missions', label: 'Missions Fund' },
      { value: 'partnership', label: 'Partnership / Covenant' },
    ],
  },
  {
    id: 'has_partnership', section: 'Giving & Finance', type: 'single',
    question: 'Does your church run a partnership or covenant giving programme?',
    sub: 'Enables the partnership portal with partner tracking, bands, and monthly intelligence.',
    options: [
      { value: 'yes', label: 'Yes — we have a formal partnership programme' },
      { value: 'informal', label: 'We have regular givers but no formal programme' },
      { value: 'no', label: 'No partnership programme' },
    ],
  },
  {
    id: 'online_giving', section: 'Giving & Finance', type: 'single',
    question: 'Does your church accept online or digital giving?',
    options: [
      { value: 'paystack', label: 'Yes — via Paystack', sub: 'Nigerian bank transfers, cards, USSD' },
      { value: 'bank_transfer', label: 'Yes — direct bank transfer', sub: 'Members transfer manually' },
      { value: 'cash_only', label: 'Cash only for now' },
      { value: 'planning', label: 'Planning to add online giving' },
    ],
  },

  // SECTION 7 — Communications
  {
    id: 'primary_comms', section: 'Communications', type: 'multi',
    question: 'How does your church communicate with members?',
    sub: 'Shapes how SHEPHERD routes notifications and follow-ups.',
    options: [
      { value: 'whatsapp', label: 'WhatsApp', sub: 'Most common in Nigeria/Africa' },
      { value: 'sms', label: 'SMS', sub: 'Text message' },
      { value: 'email', label: 'Email' },
      { value: 'phone_call', label: 'Phone call' },
      { value: 'church_app', label: 'Church app or website' },
      { value: 'in_person', label: 'In-person announcement' },
    ],
  },
  {
    id: 'absence_followup', section: 'Communications', type: 'single',
    question: 'When a member misses a service, how quickly do you follow up?',
    sub: 'Sets the default absence alert threshold in SHEPHERD.',
    options: [
      { value: 'same_day', label: 'Same day or next day' },
      { value: 'within_week', label: 'Within the week', sub: '3 – 7 days' },
      { value: 'after_2_misses', label: 'After 2 consecutive misses' },
      { value: 'after_month', label: 'After a month of absence' },
      { value: 'no_process', label: 'No formal follow-up process yet' },
    ],
  },

  // SECTION 8 — Goals
  {
    id: 'primary_goals', section: 'Your Goals', type: 'multi',
    question: 'What are your top priorities for using SHEPHERD?',
    sub: 'Select up to 4. This shapes your dashboard focus and default reports.',
    options: [
      { value: 'attendance', label: 'Track and grow attendance' },
      { value: 'member_care', label: 'Improve member care and follow-up' },
      { value: 'giving', label: 'Monitor and grow giving' },
      { value: 'cell_growth', label: 'Grow and manage cell groups' },
      { value: 'first_timers', label: 'Convert first timers to members' },
      { value: 'departments', label: 'Coordinate ministry departments' },
      { value: 'reporting', label: 'Generate reports for leadership' },
      { value: 'partnership', label: 'Manage partnership programme' },
      { value: 'prayer', label: 'Track and respond to prayer requests' },
      { value: 'data', label: 'Clean and centralise member data' },
    ],
  },
  {
    id: 'biggest_challenge', section: 'Your Goals', type: 'single',
    question: 'What is your biggest operational challenge right now?',
    sub: 'SHEPHERD will surface this as a focus area in your first-week dashboard.',
    options: [
      { value: 'data_scattered', label: 'Member data is scattered or incomplete' },
      { value: 'follow_up', label: 'Follow-up falls through the cracks' },
      { value: 'reporting', label: 'Reports are manual and time-consuming' },
      { value: 'giving_visibility', label: 'Lack of visibility into giving trends' },
      { value: 'cell_accountability', label: 'Cell leaders not submitting regularly' },
      { value: 'communication', label: 'Communication gaps between departments' },
      { value: 'growth_tracking', label: 'Can\'t measure growth accurately' },
    ],
  },
  {
    id: 'timeline', section: 'Your Goals', type: 'single',
    question: 'How soon do you want SHEPHERD fully operational?',
    options: [
      { value: 'immediately', label: 'Immediately — we are ready to go live' },
      { value: 'weeks_2', label: 'Within 2 weeks', sub: 'Need some data preparation first' },
      { value: 'month_1', label: 'Within a month', sub: 'Staff training needed' },
      { value: 'quarter', label: 'This quarter', sub: 'Phased rollout planned' },
    ],
  },
];

// ─── Sections ─────────────────────────────────────────────────
const SECTIONS = ['Identity', 'Size & Scale', 'Church Structure', 'Services & Gatherings', 'Ministries', 'Giving & Finance', 'Communications', 'Your Goals'];

// ─── Utility ──────────────────────────────────────────────────
function inp(extra?: React.CSSProperties): React.CSSProperties {
  return {
    width: '100%', border: `1px solid ${C.border}`, borderRadius: 10,
    padding: '11px 14px', fontSize: 14, background: C.white, color: C.text,
    outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', ...extra,
  };
}

// ─── Live Preview Panel ───────────────────────────────────────
function PreviewPanel({ answers }: { answers: Record<string, Answer> }) {
  const name = (answers.church_name as string) || 'Your Church';
  const structure = (answers.structure_type as string) || 'cell_church';
  const tier1 = (answers.tier1_label as string) || (structure === 'zonal' ? 'Zone' : structure === 'campus' ? 'Campus' : structure === 'department' ? 'Department' : 'Fellowship');
  const tier2 = (answers.tier2_label as string) || (structure === 'zonal' ? 'District' : structure === 'campus' ? 'Fellowship' : structure === 'department' ? 'Unit' : 'Cell');
  const country = (answers.country as string) || 'Nigeria';
  const currency = country === 'Ghana' ? 'GH₵' : country === 'Kenya' ? 'KSh' : country === 'South Africa' ? 'R' : country === 'United Kingdom' ? '£' : country === 'United States' ? '$' : '₦';
  const size = (answers.congregation_size as string) || '';
  const sizeLabel = size === 'under_100' ? '<100' : size === '100_500' ? '100–500' : size === '500_2000' ? '500–2k' : size === '2000_10000' ? '2k–10k' : size === 'above_10000' ? '10k+' : '—';
  const days = (answers.service_days as string[]) || [];

  const navItems = [
    { icon: '⬛', label: 'Dashboard' },
    { icon: '⬛', label: 'Members' },
    { icon: '⬛', label: `${tier1}s` },
    { icon: '⬛', label: `${tier2} Ministry` },
    { icon: '⬛', label: 'Attendance' },
    { icon: '⬛', label: 'Giving' },
    { icon: '⬛', label: 'Reports' },
    { icon: '⬛', label: 'Settings' },
  ];

  return (
    <div style={{ background: C.white, borderRadius: 16, overflow: 'hidden', boxShadow: '0 8px 40px rgba(83,74,183,0.12)', border: `0.5px solid ${C.border}` }}>
      {/* Mock top bar */}
      <div style={{ background: C.purpleDark, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#FF5F57' }} />
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#FFBD2E' }} />
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#28C840' }} />
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', marginLeft: 8, fontFamily: 'monospace' }}>shepherd-app.vercel.app/dashboard</div>
      </div>

      <div style={{ display: 'flex', height: 340 }}>
        {/* Sidebar */}
        <div style={{ width: 140, background: C.purpleDark, padding: '14px 0', display: 'flex', flexDirection: 'column', gap: 2, flexShrink: 0 }}>
          <div style={{ padding: '0 12px 12px', borderBottom: '0.5px solid rgba(255,255,255,0.08)', marginBottom: 6 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: C.white, letterSpacing: '0.5px' }}>SHEP.HERD</div>
            <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.45)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</div>
          </div>
          {navItems.map((item, i) => (
            <div key={i} style={{ padding: '7px 12px', display: 'flex', alignItems: 'center', gap: 7, borderRadius: 6, margin: '0 6px', background: i === 0 ? 'rgba(255,255,255,0.12)' : 'transparent', cursor: 'default' }}>
              <div style={{ width: 12, height: 12, borderRadius: 3, background: i === 0 ? C.purpleLight : 'rgba(255,255,255,0.2)' }} />
              <div style={{ fontSize: 10, color: i === 0 ? C.white : 'rgba(255,255,255,0.5)', fontWeight: i === 0 ? 600 : 400, whiteSpace: 'nowrap' }}>{item.label}</div>
            </div>
          ))}
        </div>

        {/* Main content */}
        <div style={{ flex: 1, padding: '14px', background: C.bg, overflow: 'hidden' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.text, marginBottom: 10 }}>Dashboard</div>

          {/* KPI row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 10 }}>
            {[
              { label: 'Members', value: sizeLabel || '—' },
              { label: 'Currency', value: currency },
              { label: `${tier1}s`, value: '—' },
              { label: 'Services', value: days.length > 0 ? days.map(d => d.slice(0,3)).join(' · ') : '—' },
            ].map((kpi, i) => (
              <div key={i} style={{ background: C.white, borderRadius: 8, padding: '8px 10px', border: `0.5px solid ${C.border}` }}>
                <div style={{ fontSize: 8, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 3 }}>{kpi.label}</div>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.text }}>{kpi.value}</div>
              </div>
            ))}
          </div>

          {/* Structure hierarchy */}
          <div style={{ background: C.white, borderRadius: 8, padding: '10px', border: `0.5px solid ${C.border}` }}>
            <div style={{ fontSize: 8, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 8 }}>Church Structure</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              {[name, tier1, tier2, 'Member'].map((tier, i, arr) => (
                <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 9, background: i === 0 ? C.purpleDark : i === arr.length - 1 ? C.tealBg : C.purpleBg, color: i === 0 ? C.white : i === arr.length - 1 ? C.teal : C.purple, borderRadius: 5, padding: '3px 8px', fontWeight: 600 }}>{tier}</span>
                  {i < arr.length - 1 && <span style={{ fontSize: 9, color: C.muted }}>›</span>}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────
export default function SetupWizard() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [qIndex, setQIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [textVal, setTextVal] = useState('');
  const [numberVal, setNumberVal] = useState('');
  const [transitioning, setTransitioning] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const question = QUESTIONS[qIndex];
  const totalQ = QUESTIONS.length;
  const progress = ((qIndex) / totalQ) * 100;
  const currentSection = question?.section;
  const sectionIndex = SECTIONS.indexOf(currentSection);

  // Pre-fill text/number fields from saved answers
  useEffect(() => {
    if (!question) return;
    if (question.type === 'text') setTextVal((answers[question.id] as string) || '');
    if (question.type === 'number') setNumberVal((answers[question.id] as string) || '');
    // Auto-fill tier labels from structure choice
    if (question.id === 'tier1_label' && !answers.tier1_label) {
      const struct = answers.structure_type as string;
      const defaults: Record<string, string> = { cell_church: 'Fellowship', zonal: 'Zone', campus: 'Campus', department: 'Department', house_network: 'Network', single: '' };
      setTextVal(defaults[struct] || '');
    }
    if (question.id === 'tier2_label' && !answers.tier2_label) {
      const struct = answers.structure_type as string;
      const defaults: Record<string, string> = { cell_church: 'Cell', zonal: 'District', campus: 'Fellowship', department: 'Unit', house_network: 'Home Group', single: '' };
      setTextVal(defaults[struct] || '');
    }
    if (question.id === 'tier1_head_label' && !answers.tier1_head_label) {
      const struct = answers.structure_type as string;
      const defaults: Record<string, string> = { cell_church: 'Fellowship Head', zonal: 'Zonal Pastor', campus: 'Campus Pastor', department: 'Department Head', house_network: 'Network Coordinator', single: 'Pastor' };
      setTextVal(defaults[struct] || '');
    }
    if (question.id === 'tier2_head_label' && !answers.tier2_head_label) {
      const struct = answers.structure_type as string;
      const defaults: Record<string, string> = { cell_church: 'Cell Leader', zonal: 'District Leader', campus: 'Fellowship Head', department: 'Unit Leader', house_network: 'Host Leader', single: 'Pastor' };
      setTextVal(defaults[struct] || '');
    }
  }, [qIndex]);

  function saveAnswer(val: Answer) {
    setAnswers(prev => ({ ...prev, [question.id]: val }));
  }

  function currentAnswer(): Answer {
    return answers[question.id] ?? null;
  }

  function canAdvance(): boolean {
    if (!question.required) return true;
    const ans = currentAnswer();
    if (question.type === 'text') return textVal.trim().length > 0;
    if (question.type === 'number') return numberVal.trim().length > 0;
    if (question.type === 'multi') return Array.isArray(ans) && (ans as string[]).length > 0;
    return ans !== null;
  }

  function advance() {
    // Save text/number answers
    if (question.type === 'text') saveAnswer(textVal.trim());
    if (question.type === 'number') saveAnswer(numberVal);

    setTransitioning(true);
    setTimeout(() => {
      if (qIndex < QUESTIONS.length - 1) {
        // Skip tier labels if single congregation
        let next = qIndex + 1;
        if (answers.structure_type === 'single' && ['tier1_label','tier2_label','tier1_head_label','tier2_head_label'].includes(QUESTIONS[next]?.id)) {
          while (next < QUESTIONS.length - 1 && ['tier1_label','tier2_label','tier1_head_label','tier2_head_label'].includes(QUESTIONS[next]?.id)) next++;
        }
        setQIndex(next);
      } else {
        finish();
      }
      setTransitioning(false);
    }, 200);
  }

  function back() {
    if (qIndex === 0) return;
    setTransitioning(true);
    setTimeout(() => {
      setQIndex(i => i - 1);
      setTransitioning(false);
    }, 150);
  }

  function toggleMulti(val: string) {
    const current = (answers[question.id] as string[]) || [];
    const updated = current.includes(val) ? current.filter(v => v !== val) : [...current, val];
    saveAnswer(updated);
  }

  async function finish() {
    setSaving(true);
    const a = { ...answers };
    if (question.type === 'text') a[question.id] = textVal.trim();
    if (question.type === 'number') a[question.id] = numberVal;

    const struct = (a.structure_type as StructureType) || 'cell_church';
    const structDefaults: Record<string, { t1: string; t2: string; t1h: string; t2h: string }> = {
      cell_church: { t1: 'Fellowship', t2: 'Cell', t1h: 'Fellowship Head', t2h: 'Cell Leader' },
      zonal: { t1: 'Zone', t2: 'District', t1h: 'Zonal Pastor', t2h: 'District Leader' },
      campus: { t1: 'Campus', t2: 'Fellowship', t1h: 'Campus Pastor', t2h: 'Fellowship Head' },
      department: { t1: 'Department', t2: 'Unit', t1h: 'Department Head', t2h: 'Unit Leader' },
      house_network: { t1: 'Network', t2: 'Home Group', t1h: 'Network Coordinator', t2h: 'Host Leader' },
      single: { t1: '', t2: '', t1h: 'Pastor', t2h: 'Pastor' },
    };
    const sd = structDefaults[struct];

    const country = (a.country as string) || 'Nigeria';
    const currencyMap: Record<string, string> = { Ghana: 'GHS', Kenya: 'KES', 'South Africa': 'ZAR', 'United Kingdom': 'GBP', 'United States': 'USD', Canada: 'USD' };
    const currency = currencyMap[country] || 'NGN';

    const payload = {
      church_name: (a.church_name as string) || 'My Church',
      structure_type: struct,
      tier1_label: (a.tier1_label as string) || sd.t1 || null,
      tier2_label: (a.tier2_label as string) || sd.t2 || null,
      tier3_label: null,
      tier1_head_label: (a.tier1_head_label as string) || sd.t1h,
      tier2_head_label: (a.tier2_head_label as string) || sd.t2h,
      currency,
      country,
      timezone: country === 'Nigeria' ? 'Africa/Lagos' : country === 'Kenya' ? 'Africa/Nairobi' : country === 'Ghana' ? 'Africa/Accra' : country === 'South Africa' ? 'Africa/Johannesburg' : 'Africa/Lagos',
      service_days: (a.service_days as string[]) || ['Sunday'],
      is_configured: true,
      // Extended profile stored as JSON in a metadata field
      church_profile: JSON.stringify({
        denomination: a.denomination,
        founded_year: a.founded_year,
        congregation_size: a.congregation_size,
        location_count: a.location_count,
        staff_count: a.staff_count,
        services_per_sunday: a.services_per_sunday,
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
        router.push('/dashboard');
      } else {
        const d = await res.json();
        setError(d?.error?.message || 'Failed to save. Please try again.');
        setSaving(false);
      }
    } catch {
      setError('Network error. Please check your connection.');
      setSaving(false);
    }
  }

  if (!mounted) return null;

  const isLast = qIndex === QUESTIONS.length - 1;
  const ans = currentAnswer();

  return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', fontFamily: 'var(--font-inter, -apple-system, Inter, sans-serif)' }}>

      {/* ── LEFT PANEL ── */}
      <div style={{ width: '50%', minHeight: '100vh', display: 'flex', flexDirection: 'column', padding: '40px 48px', boxSizing: 'border-box', position: 'relative' }}>

        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 48 }}>
          <div style={{ width: 32, height: 32, background: C.purple, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: 16, height: 16, background: C.white, borderRadius: 3, opacity: 0.9 }} />
          </div>
          <span style={{ fontSize: 16, fontWeight: 800, color: C.purpleDark, letterSpacing: '-0.3px' }}>SHEP.HERD</span>
        </div>

        {/* Section breadcrumb */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: C.purple, textTransform: 'uppercase', letterSpacing: '0.6px' }}>
            {sectionIndex + 1} of {SECTIONS.length} — {currentSection}
          </span>
        </div>

        {/* Progress bar */}
        <div style={{ height: 2, background: C.border, borderRadius: 2, marginBottom: 32, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${progress}%`, background: C.purple, borderRadius: 2, transition: 'width 0.4s ease' }} />
        </div>

        {/* Question */}
        <div style={{ flex: 1, opacity: transitioning ? 0 : 1, transition: 'opacity 0.2s ease', transform: transitioning ? 'translateY(8px)' : 'translateY(0)', }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: C.text, lineHeight: 1.3, marginBottom: 10, letterSpacing: '-0.3px' }}>
            {question?.question}
          </div>
          {question?.sub && (
            <div style={{ fontSize: 14, color: C.sub, lineHeight: 1.6, marginBottom: 28 }}>{question.sub}</div>
          )}

          {/* ── SINGLE SELECT ── */}
          {question?.type === 'single' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {question.options?.map(opt => (
                <button key={opt.value} onClick={() => { saveAnswer(opt.value); setTimeout(advance, 120); }}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '13px 16px', borderRadius: 12, border: `1px solid ${ans === opt.value ? C.purple : C.border}`, background: ans === opt.value ? C.purpleBg : C.white, cursor: 'pointer', textAlign: 'left', width: '100%', transition: 'all 0.15s' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
                    {opt.icon && <span style={{ fontSize: 18, flexShrink: 0 }}>{opt.icon}</span>}
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 500, color: C.text }}>{opt.label}</div>
                      {opt.sub && <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{opt.sub}</div>}
                    </div>
                  </div>
                  <div style={{ width: 18, height: 18, borderRadius: '50%', border: `2px solid ${ans === opt.value ? C.purple : C.border}`, background: ans === opt.value ? C.purple : 'transparent', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {ans === opt.value && <div style={{ width: 6, height: 6, borderRadius: '50%', background: C.white }} />}
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* ── MULTI SELECT ── */}
          {question?.type === 'multi' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {question.options?.map(opt => {
                const selected = ((ans as string[]) || []).includes(opt.value);
                return (
                  <button key={opt.value} onClick={() => toggleMulti(opt.value)}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '12px 16px', borderRadius: 12, border: `1px solid ${selected ? C.purple : C.border}`, background: selected ? C.purpleBg : C.white, cursor: 'pointer', textAlign: 'left', width: '100%', transition: 'all 0.15s' }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 500, color: C.text }}>{opt.label}</div>
                      {opt.sub && <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{opt.sub}</div>}
                    </div>
                    <div style={{ width: 18, height: 18, borderRadius: 4, border: `2px solid ${selected ? C.purple : C.border}`, background: selected ? C.purple : 'transparent', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {selected && <div style={{ color: C.white, fontSize: 11, fontWeight: 700 }}>✓</div>}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* ── TEXT ── */}
          {question?.type === 'text' && (
            <div>
              <input value={textVal} onChange={e => setTextVal(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && canAdvance()) advance(); }}
                placeholder={question.placeholder}
                autoFocus
                style={{ ...inp(), fontSize: 15, padding: '14px 16px', borderColor: textVal ? C.purple : C.border }} />
              <div style={{ fontSize: 12, color: C.muted, marginTop: 8 }}>Press Enter to continue</div>
            </div>
          )}

          {/* ── NUMBER ── */}
          {question?.type === 'number' && (
            <div>
              <input type="number" value={numberVal} onChange={e => setNumberVal(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && canAdvance()) advance(); }}
                placeholder={question.placeholder}
                min={question.min} max={question.max}
                autoFocus
                style={{ ...inp(), fontSize: 15, padding: '14px 16px', borderColor: numberVal ? C.purple : C.border, width: 180 }} />
              <div style={{ fontSize: 12, color: C.muted, marginTop: 8 }}>Press Enter to continue</div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div style={{ paddingTop: 32 }}>
          {error && <div style={{ background: C.coralBg, color: C.coral, borderRadius: 10, padding: '11px 14px', fontSize: 13, marginBottom: 16, fontWeight: 500 }}>{error}</div>}

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {qIndex > 0 && (
              <button onClick={back}
                style={{ padding: '12px 20px', borderRadius: 10, border: `1px solid ${C.border}`, background: C.white, color: C.sub, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
                ← Back
              </button>
            )}

            {(question?.type === 'multi' || question?.type === 'text' || question?.type === 'number') && (
              <button onClick={isLast ? finish : advance}
                disabled={!canAdvance() || saving}
                style={{ flex: 1, padding: '13px 24px', borderRadius: 10, border: 'none', background: canAdvance() && !saving ? C.purple : C.border, color: C.white, fontSize: 14, fontWeight: 600, cursor: canAdvance() && !saving ? 'pointer' : 'default', transition: 'background 0.2s' }}>
                {saving ? 'Setting up your church…' : isLast ? 'Complete Setup →' : 'Continue →'}
              </button>
            )}

            {question?.type === 'single' && !question.required && (
              <button onClick={advance}
                style={{ padding: '12px 20px', borderRadius: 10, border: `1px solid ${C.border}`, background: C.white, color: C.sub, fontSize: 13, cursor: 'pointer' }}>
                Skip
              </button>
            )}
          </div>

          <div style={{ marginTop: 16, fontSize: 12, color: C.muted }}>
            Question {qIndex + 1} of {totalQ} · {SECTIONS.length - sectionIndex - 1} section{SECTIONS.length - sectionIndex - 1 !== 1 ? 's' : ''} remaining
          </div>
        </div>
      </div>

      {/* ── RIGHT PANEL ── */}
      <div style={{ width: '50%', background: C.purpleDark, minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 48px', boxSizing: 'border-box', position: 'sticky', top: 0, height: '100vh' }}>

        {/* Section map */}
        <div style={{ width: '100%', maxWidth: 380, marginBottom: 32 }}>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 14 }}>Setup progress</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {SECTIONS.map((section, i) => {
              const sectionQs = QUESTIONS.filter(q => q.section === section);
              const answered = sectionQs.filter(q => answers[q.id] !== undefined && answers[q.id] !== null).length;
              const isActive = section === currentSection;
              const isDone = i < sectionIndex;
              return (
                <div key={section} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 20, height: 20, borderRadius: '50%', flexShrink: 0, background: isDone ? C.teal : isActive ? C.white : 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1.5px solid ${isDone ? C.teal : isActive ? C.white : 'rgba(255,255,255,0.15)'}` }}>
                    {isDone ? <span style={{ fontSize: 10, color: C.white, fontWeight: 700 }}>✓</span> : isActive ? <div style={{ width: 6, height: 6, borderRadius: '50%', background: C.purple }} /> : null}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: isActive ? 600 : 400, color: isActive ? C.white : isDone ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.3)' }}>{section}</div>
                    {isActive && (
                      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>{answered} of {sectionQs.length} answered</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Live preview */}
        <div style={{ width: '100%', maxWidth: 380 }}>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 12 }}>Live preview</div>
          <PreviewPanel answers={answers} />
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', textAlign: 'center', marginTop: 10 }}>
            Your dashboard updates as you answer
          </div>
        </div>
      </div>
    </div>
  );
}
