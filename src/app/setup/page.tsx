'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { type StructureType } from '@/lib/church-config';
import { currencySymbol } from '@/lib/currency';
import { PLANS as SHARED_PLANS } from '@/lib/plans';

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
type QuestionType = 'single' | 'multi' | 'text' | 'number' | 'country' | 'branch_list';

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
  { value: 'Algeria', label: 'Algeria', icon: '🇩🇿' },
  { value: 'Egypt', label: 'Egypt', icon: '🇪🇬' },
  { value: 'Morocco', label: 'Morocco', icon: '🇲🇦' },
  { value: 'Tunisia', label: 'Tunisia', icon: '🇹🇳' },
  { value: 'Libya', label: 'Libya', icon: '🇱🇾' },
  { value: 'Sudan', label: 'Sudan', icon: '🇸🇩' },
  { value: 'South Sudan', label: 'South Sudan', icon: '🇸🇸' },
  { value: 'Chad', label: 'Chad', icon: '🇹🇩' },
  { value: 'Central African Republic', label: 'Central African Republic', icon: '🇨🇫' },
  { value: 'Congo', label: 'Congo (Republic)', icon: '🇨🇬' },
  { value: 'Gabon', label: 'Gabon', icon: '🇬🇦' },
  { value: 'Equatorial Guinea', label: 'Equatorial Guinea', icon: '🇬🇶' },
  { value: 'São Tomé and Príncipe', label: 'São Tomé and Príncipe', icon: '🇸🇹' },
  { value: 'Guinea', label: 'Guinea', icon: '🇬🇳' },
  { value: 'Guinea-Bissau', label: 'Guinea-Bissau', icon: '🇬🇼' },
  { value: 'Gambia', label: 'Gambia', icon: '🇬🇲' },
  { value: 'Cape Verde', label: 'Cape Verde', icon: '🇨🇻' },
  { value: 'Mauritania', label: 'Mauritania', icon: '🇲🇷' },
  { value: 'Burundi', label: 'Burundi', icon: '🇧🇮' },
  { value: 'Comoros', label: 'Comoros', icon: '🇰🇲' },
  { value: 'Djibouti', label: 'Djibouti', icon: '🇩🇯' },
  { value: 'Eritrea', label: 'Eritrea', icon: '🇪🇷' },
  { value: 'Somalia', label: 'Somalia', icon: '🇸🇴' },
  { value: 'Eswatini', label: 'Eswatini', icon: '🇸🇿' },
  { value: 'Lesotho', label: 'Lesotho', icon: '🇱🇸' },
  { value: 'Madagascar', label: 'Madagascar', icon: '🇲🇬' },
  { value: 'Mauritius', label: 'Mauritius', icon: '🇲🇺' },
  { value: 'Seychelles', label: 'Seychelles', icon: '🇸🇨' },
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
  { id: 'branch_names', section: 'Size & Scale', type: 'branch_list', required: true, question: 'Name each of your branches', sub: 'The first one you add becomes your headquarters branch. SHEPHERD builds each of these as its own scoped branch — admins for one branch never see another\'s data.' },
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
  { id: 'cydf_combined', section: 'Church Structure', type: 'single', question: 'Are your Children\'s and Teenagers\' ministries combined into one group, or run separately?', sub: 'Some churches run them as one group with a simple headcount register (no individual cells); others keep them fully separate fellowships like any other. Either is fine — this just decides which one gets set up for you.', options: [
    { value: 'combined', label: 'Combined', sub: 'One group, aggregate headcount register, no separate cells' },
    { value: 'separate', label: 'Separate', sub: 'Two independent fellowships, each with their own structure' },
  ]},

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
  Cameroon: 'XAF', 'Côte d\'Ivoire': 'XOF', Senegal: 'XOF', Zimbabwe: 'ZWL',
  Zambia: 'ZMW', Malawi: 'MWK', Mozambique: 'MZN', Angola: 'AOA',
  'DR Congo': 'CDF', 'Sierra Leone': 'SLL', Liberia: 'LRD', Togo: 'XOF',
  Benin: 'XOF', Niger: 'XOF', 'Burkina Faso': 'XOF', Mali: 'XOF',
  Botswana: 'BWP', Namibia: 'NAD',
  Algeria: 'DZD', Egypt: 'EGP', Morocco: 'MAD', Tunisia: 'TND', Libya: 'LYD',
  Sudan: 'SDG', 'South Sudan': 'SSP', Chad: 'XAF', 'Central African Republic': 'XAF',
  Congo: 'XAF', Gabon: 'XAF', 'Equatorial Guinea': 'XAF',
  'São Tomé and Príncipe': 'STN', Guinea: 'GNF', 'Guinea-Bissau': 'XOF',
  Gambia: 'GMD', 'Cape Verde': 'CVE', Mauritania: 'MRU', Burundi: 'BIF',
  Comoros: 'KMF', Djibouti: 'DJF', Eritrea: 'ERN', Somalia: 'SOS',
  Eswatini: 'SZL', Lesotho: 'LSL', Madagascar: 'MGA', Mauritius: 'MUR',
  Seychelles: 'SCR',
  'United Kingdom': 'GBP', 'United States': 'USD', Canada: 'CAD', Australia: 'AUD',
  Germany: 'EUR', France: 'EUR', Netherlands: 'EUR', Italy: 'EUR', Ireland: 'EUR',
  Norway: 'NOK', Sweden: 'SEK', Brazil: 'BRL', India: 'INR', China: 'CNY',
};

const TZ_MAP: Record<string, string> = {
  Nigeria: 'Africa/Lagos', Ghana: 'Africa/Accra', Kenya: 'Africa/Nairobi',
  'South Africa': 'Africa/Johannesburg', Uganda: 'Africa/Kampala',
  Tanzania: 'Africa/Dar_es_Salaam', Rwanda: 'Africa/Kigali', Ethiopia: 'Africa/Addis_Ababa',
  Cameroon: 'Africa/Douala', 'Côte d\'Ivoire': 'Africa/Abidjan', Senegal: 'Africa/Dakar',
  Zimbabwe: 'Africa/Harare', Zambia: 'Africa/Lusaka', Malawi: 'Africa/Blantyre',
  Mozambique: 'Africa/Maputo', Angola: 'Africa/Luanda', 'DR Congo': 'Africa/Kinshasa',
  'Sierra Leone': 'Africa/Freetown', Liberia: 'Africa/Monrovia', Togo: 'Africa/Lome',
  Benin: 'Africa/Porto-Novo', Niger: 'Africa/Niamey', 'Burkina Faso': 'Africa/Ouagadougou',
  Mali: 'Africa/Bamako', Botswana: 'Africa/Gaborone', Namibia: 'Africa/Windhoek',
  Algeria: 'Africa/Algiers', Egypt: 'Africa/Cairo', Morocco: 'Africa/Casablanca',
  Tunisia: 'Africa/Tunis', Libya: 'Africa/Tripoli', Sudan: 'Africa/Khartoum',
  'South Sudan': 'Africa/Juba', Chad: 'Africa/Ndjamena', 'Central African Republic': 'Africa/Bangui',
  Congo: 'Africa/Brazzaville', Gabon: 'Africa/Libreville', 'Equatorial Guinea': 'Africa/Malabo',
  'São Tomé and Príncipe': 'Africa/Sao_Tome', Guinea: 'Africa/Conakry', 'Guinea-Bissau': 'Africa/Bissau',
  Gambia: 'Africa/Banjul', 'Cape Verde': 'Atlantic/Cape_Verde', Mauritania: 'Africa/Nouakchott',
  Burundi: 'Africa/Bujumbura', Comoros: 'Indian/Comoro', Djibouti: 'Africa/Djibouti',
  Eritrea: 'Africa/Asmara', Somalia: 'Africa/Mogadishu', Eswatini: 'Africa/Mbabane',
  Lesotho: 'Africa/Maseru', Madagascar: 'Indian/Antananarivo', Mauritius: 'Indian/Mauritius',
  Seychelles: 'Indian/Mahe',
  'United Kingdom': 'Europe/London', 'United States': 'America/New_York',
  Canada: 'America/Toronto', Australia: 'Australia/Sydney', Germany: 'Europe/Berlin',
  France: 'Europe/Paris', Netherlands: 'Europe/Amsterdam', Italy: 'Europe/Rome',
  Ireland: 'Europe/Dublin', Norway: 'Europe/Oslo', Sweden: 'Europe/Stockholm',
  Brazil: 'America/Sao_Paulo', India: 'Asia/Kolkata', China: 'Asia/Shanghai',
};

// ── Plan definitions ─────────────────────────────────────────
// Sourced from src/lib/plans.ts (also consulted by the server-side
// plan-gate) — accent keys are mapped to this page's own color tokens here.
const ACCENT: Record<string, { color: string; colorBg: string }> = {
  teal: { color: C.teal, colorBg: C.tealBg },
  purple: { color: C.purple, colorBg: C.purpleBg },
  amber: { color: C.amber, colorBg: C.amberBg },
};
const PLANS = SHARED_PLANS.map(p => ({ ...p, ...ACCENT[p.accent] }));

// ── Live preview ─────────────────────────────────────────────
function PreviewPanel({ answers }: { answers: Record<string, Answer> }) {
  const name = (answers.church_name as string) || 'Your Church';
  const struct = (answers.structure_type as string) || 'cell_church';
  const td = TIER_DEFAULTS[struct] || TIER_DEFAULTS.cell_church;
  const tier1 = (answers.tier1_label as string) || td.t1;
  const tier2 = (answers.tier2_label as string) || td.t2;
  const country = (answers.country as string) || 'Nigeria';
  const currency = CURRENCY_MAP[country] || 'NGN';
  const currSym = currencySymbol(currency);
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
  const router = useRouter();
  const [selected, setSelected] = useState('growth');
  const churchName = (answers.church_name as string) || 'Your Church';

  return (
    <div className="shep-plan-shell" style={{ display: 'flex', minHeight: '100vh', fontFamily: 'var(--font-inter, -apple-system, Inter, sans-serif)', background: C.bg }}>
      <div className="shep-plan-main" style={{ flex: 1, padding: '48px', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
        <button onClick={() => router.push('/')} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 48, background: 'transparent', border: 'none', padding: 0, cursor: 'pointer' }}>
          <div style={{ width: 32, height: 32, background: C.purple, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', flexShrink: 0 }}>
            <div style={{ position: 'absolute', width: 4, height: 17, background: C.white, borderRadius: 2 }} />
            <div style={{ position: 'absolute', width: 17, height: 4, background: C.white, borderRadius: 2 }} />
          </div>
          <span style={{ fontSize: 16, fontWeight: 800, color: C.purpleDark }}>SHEP.HERD</span>
        </button>

        <div style={{ maxWidth: 560 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: C.purple, textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 8 }}>One last step</div>
          <div style={{ fontSize: 26, fontWeight: 700, color: C.text, letterSpacing: '-0.5px', marginBottom: 10 }}>Choose your plan</div>
          <div style={{ fontSize: 14, color: C.sub, marginBottom: 32, lineHeight: 1.6 }}>
            Your <strong>30-day trial</strong> gives full access to attendance, members, cells, and giving — no card needed. Moshe AI, the partnership portal, and SMS/WhatsApp alerts unlock the moment you go active on Growth or Enterprise.
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
            No credit card required. Cancel anytime. Core features free for 30 days.
          </div>
        </div>
      </div>

      <div className="shep-plan-sidebar" style={{ width: '380px', background: C.purpleDark, minHeight: '100vh', display: 'flex', flexDirection: 'column', padding: '48px 36px', boxSizing: 'border-box' }}>
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
        {selected !== 'starter' && (
          <div style={{ marginTop: 'auto', paddingTop: 16, fontSize: 11.5, color: 'rgba(255,255,255,0.4)', lineHeight: 1.5 }}>
            Moshe AI, the partnership portal, and SMS/WhatsApp alerts activate once you go active on this plan — your 30-day trial covers everything else above.
          </div>
        )}
      </div>
      <style>{`
        @media (max-width: 860px) {
          .shep-plan-shell { flex-direction: column !important; }
          .shep-plan-main { padding: 28px 20px !important; }
          .shep-plan-sidebar { width: 100% !important; min-height: auto !important; padding: 28px 20px 36px !important; }
        }
      `}</style>
    </div>
  );
}

// ── Team invite screen ────────────────────────────────────────
type TeamInvite = { email: string; full_name: string; role: string };

const TEAM_ROLE_OPTIONS: { value: string; label: string }[] = [
  { value: 'pa', label: 'Church Admin / PA' },
  { value: 'fellowship_head', label: 'Fellowship Head' },
  { value: 'department_head', label: 'Department Head' },
  { value: 'cell_leader', label: 'Cell Leader' },
  { value: 'accounts', label: 'Accounts' },
  { value: 'partnership', label: 'Partnership Admin' },
  { value: 'care_team', label: 'Follow-Up & Care Team' },
  { value: 'workforce', label: 'Workforce' },
];

function TeamScreen({ invites, onAdd, onRemove, onContinue, onSkip, busy, error }: {
  invites: TeamInvite[];
  onAdd: (invite: TeamInvite) => void;
  onRemove: (i: number) => void;
  onContinue: () => void;
  onSkip: () => void;
  busy: boolean;
  error?: string;
}) {
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState(TEAM_ROLE_OPTIONS[0].value);

  function add() {
    if (!email.trim() || !fullName.trim()) return;
    onAdd({ email: email.trim(), full_name: fullName.trim(), role });
    setEmail(''); setFullName('');
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: C.bg, fontFamily: 'var(--font-inter, -apple-system, Inter, sans-serif)', padding: 24 }}>
      <div className="shep-team-card" style={{ width: '100%', maxWidth: 620, background: C.white, borderRadius: 18, border: `0.5px solid ${C.border}`, padding: '40px 44px', boxShadow: '0 8px 32px rgba(83,74,183,0.1)' }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: C.purple, textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 8 }}>Almost there</div>
        <div style={{ fontSize: 24, fontWeight: 700, color: C.text, letterSpacing: '-0.4px', marginBottom: 10 }}>Build your team</div>
        <div style={{ fontSize: 13.5, color: C.sub, marginBottom: 28, lineHeight: 1.6 }}>
          Invite the people who'll run each portal. Each gets a signup link to set their own password — assign them to a specific cell, fellowship, or department any time from Settings once it's created. You can skip this and invite people later.
        </div>

        <div className="shep-team-row" style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          <input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Full name" style={{ flex: 1, padding: '10px 12px', borderRadius: 9, border: `1px solid ${C.border}`, fontSize: 13.5, outline: 'none', minWidth: 0, boxSizing: 'border-box' }} />
          <input value={email} onChange={e => setEmail(e.target.value)} placeholder="Email address" type="email" style={{ flex: 1, padding: '10px 12px', borderRadius: 9, border: `1px solid ${C.border}`, fontSize: 13.5, outline: 'none', minWidth: 0, boxSizing: 'border-box' }} />
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          <select value={role} onChange={e => setRole(e.target.value)} style={{ flex: 1, padding: '10px 12px', borderRadius: 9, border: `1px solid ${C.border}`, fontSize: 13.5, outline: 'none', background: C.white, color: C.text }}>
            {TEAM_ROLE_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
          <button onClick={add} style={{ background: C.purpleBg, color: C.purple, border: 'none', borderRadius: 9, padding: '10px 20px', fontSize: 13.5, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
            + Add
          </button>
        </div>

        {invites.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
            {invites.map((inv, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 9, background: C.purpleFaint }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{inv.full_name}</div>
                  <div style={{ fontSize: 11.5, color: C.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{inv.email}</div>
                </div>
                <span style={{ fontSize: 11, background: C.purpleBg, color: C.purple, borderRadius: 6, padding: '2px 8px', fontWeight: 600, flexShrink: 0 }}>
                  {TEAM_ROLE_OPTIONS.find(r => r.value === inv.role)?.label}
                </span>
                <button onClick={() => onRemove(i)} style={{ background: 'transparent', border: 'none', color: C.muted, cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: 4, flexShrink: 0 }}>×</button>
              </div>
            ))}
          </div>
        )}

        {error && <div style={{ background: C.coralBg, color: C.coral, borderRadius: 9, padding: '10px 14px', fontSize: 13, marginBottom: 14, fontWeight: 500 }}>{error}</div>}

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onSkip} disabled={busy} style={{ flex: 1, background: C.white, color: C.sub, border: `1px solid ${C.border}`, borderRadius: 11, padding: '13px', fontSize: 14, fontWeight: 600, cursor: busy ? 'default' : 'pointer' }}>
            Skip for now
          </button>
          <button onClick={onContinue} disabled={busy} style={{ flex: 2, background: C.purple, color: C.white, border: 'none', borderRadius: 11, padding: '13px', fontSize: 14, fontWeight: 700, cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.7 : 1 }}>
            {busy ? 'Setting up…' : invites.length > 0 ? `Send ${invites.length} invite${invites.length > 1 ? 's' : ''} & finish →` : 'Finish setup →'}
          </button>
        </div>
      </div>
      <style>{`
        @media (max-width: 640px) {
          .shep-team-card { padding: 28px 20px !important; }
          .shep-team-row { flex-direction: column !important; }
        }
      `}</style>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────
export default function SetupWizard() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [screen, setScreen] = useState<'questions' | 'plan' | 'team' | 'saving'>('questions');
  const [qIndex, setQIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [textVal, setTextVal] = useState('');
  const [numberVal, setNumberVal] = useState('');
  const [countrySearch, setCountrySearch] = useState('');
  const [branchNameInput, setBranchNameInput] = useState('');
  const [transitioning, setTransitioning] = useState(false);
  const [error, setError] = useState('');
  const [planTier, setPlanTier] = useState('');
  const [teamInvites, setTeamInvites] = useState<TeamInvite[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setMounted(true); }, []);

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
    if (question.type === 'branch_list') return Array.isArray(ans) && (ans as string[]).length >= 2;
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
        if (dir === 1 && answers.location_count === '1') {
          while (idx < QUESTIONS.length && QUESTIONS[idx]?.id === 'branch_names') idx++;
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

  function addBranchName() {
    const name = branchNameInput.trim();
    if (!name) return;
    const current = (answers.branch_names as string[]) || [];
    if (current.some(n => n.toLowerCase() === name.toLowerCase())) { setBranchNameInput(''); return; }
    setAnswers(prev => ({ ...prev, branch_names: [...current, name] }));
    setBranchNameInput('');
  }
  function removeBranchName(i: number) {
    const current = (answers.branch_names as string[]) || [];
    setAnswers(prev => ({ ...prev, branch_names: current.filter((_, idx) => idx !== i) }));
  }

  async function finish(invitesToSend: TeamInvite[]) {
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
      church_profile: {
        denomination: a.denomination,
        founded_year: a.founded_year,
        congregation_size: a.congregation_size,
        location_count: a.location_count,
        staff_count: a.staff_count,
        services_per_main_day: a.services_per_main_day,
        cell_meeting_day: a.cell_meeting_day,
        has_children: a.has_children,
        has_youth: a.has_youth,
        cydf_combined: a.cydf_combined,
        departments: a.departments,
        giving_types: a.giving_types,
        has_partnership: a.has_partnership,
        online_giving: a.online_giving,
        primary_comms: a.primary_comms,
        absence_followup: a.absence_followup,
        primary_goals: a.primary_goals,
        biggest_challenge: a.biggest_challenge,
        timeline: a.timeline,
      },
    };

    try {
      const res = await fetch('/api/settings/church-config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const branchNames = (a.branch_names as string[]) || [];
        if (branchNames.length > 0) {
          try {
            await fetch('/api/branches', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({ names: branchNames }),
            });
          } catch { /* non-fatal — branches can still be added later from admin settings */ }
        }
        for (const invite of invitesToSend) {
          try {
            await fetch('/api/invites', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify(invite),
            });
          } catch { /* non-fatal — invites can still be sent later from the dashboard */ }
        }
        // Force fresh config load on dashboard
        router.push('/dashboard?onboarded=1');
      } else {
        const d = await res.json();
        setError(d?.error?.message || 'Failed to save. Please try again.');
        setScreen('team');
      }
    } catch {
      setError('Network error. Please check your connection.');
      setScreen('team');
    }
  }

  if (!mounted) return null;
  if (screen === 'plan') return <PlanScreen answers={answers} onSelect={(plan) => { setPlanTier(plan); setError(''); setScreen('team'); }} />;
  if (screen === 'team') return (
    <TeamScreen
      invites={teamInvites}
      onAdd={(inv) => setTeamInvites(prev => [...prev, inv])}
      onRemove={(i) => setTeamInvites(prev => prev.filter((_, idx) => idx !== i))}
      onContinue={() => finish(teamInvites)}
      onSkip={() => finish([])}
      busy={false}
      error={error}
    />
  );
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
    <div className="shep-setup-shell" style={{ minHeight: '100vh', display: 'flex', fontFamily: 'var(--font-inter, -apple-system, Inter, sans-serif)', background: C.bg }}>

      {/* ── LEFT ── */}
      <div className="shep-setup-left" style={{ width: '55%', minHeight: '100vh', display: 'flex', flexDirection: 'column', padding: '40px 52px', boxSizing: 'border-box', overflowY: 'auto' }}>

        {/* Logo */}
        <button onClick={() => router.push('/')} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 44, background: 'transparent', border: 'none', padding: 0, cursor: 'pointer' }}>
          <div style={{ width: 30, height: 30, background: C.purple, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', flexShrink: 0 }}>
            <div style={{ position: 'absolute', width: 4, height: 16, background: C.white, borderRadius: 2 }} />
            <div style={{ position: 'absolute', width: 16, height: 4, background: C.white, borderRadius: 2 }} />
          </div>
          <span style={{ fontSize: 15, fontWeight: 800, color: C.purpleDark, letterSpacing: '-0.3px' }}>SHEP.HERD</span>
        </button>

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
                  onClick={() => { saveAnswer(opt.value); if (!question.required) return; setTimeout(() => go(1), 120); }}
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

          {/* BRANCH LIST */}
          {question?.type === 'branch_list' && (
            <div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                <input value={branchNameInput} onChange={e => setBranchNameInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addBranchName(); } }}
                  placeholder="e.g. Grace Dome, Victory Tabernacle"
                  style={{ flex: 1, border: `1px solid ${C.border}`, borderRadius: 10, padding: '12px 14px', fontSize: 14, background: C.white, color: C.text, outline: 'none' }} />
                <button onClick={addBranchName} disabled={!branchNameInput.trim()}
                  style={{ padding: '0 18px', borderRadius: 10, border: 'none', background: branchNameInput.trim() ? C.purple : C.border, color: C.white, fontSize: 13, fontWeight: 600, cursor: branchNameInput.trim() ? 'pointer' : 'default' }}>
                  + Add
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {((ans as string[]) || []).map((name, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderRadius: 10, border: `1px solid ${C.border}`, background: i === 0 ? C.purpleBg : C.white }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 13, fontWeight: 500, color: C.text }}>{name}</span>
                      {i === 0 && <span style={{ fontSize: 10, fontWeight: 700, color: C.purple, background: 'rgba(83,74,183,0.12)', borderRadius: 10, padding: '2px 8px' }}>HEADQUARTERS</span>}
                    </div>
                    <button onClick={() => removeBranchName(i)} style={{ background: 'transparent', border: 'none', color: C.muted, cursor: 'pointer', fontSize: 16, lineHeight: 1 }}>×</button>
                  </div>
                ))}
                {((ans as string[]) || []).length === 0 && (
                  <div style={{ fontSize: 12, color: C.muted, padding: '8px 2px' }}>No branches added yet — add at least 2 (your headquarters plus any others).</div>
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
            {(question?.type === 'multi' || question?.type === 'text' || question?.type === 'number' || question?.type === 'branch_list') && (
              <button onClick={() => go(1)} disabled={!canAdvance()}
                style={{ flex: 1, padding: '12px 22px', borderRadius: 9, border: 'none', background: canAdvance() ? C.purple : C.border, color: C.white, fontSize: 14, fontWeight: 600, cursor: canAdvance() ? 'pointer' : 'default', transition: 'background 0.2s' }}>
                {qIndex === QUESTIONS.length - 1 ? 'Choose your plan →' : 'Continue →'}
              </button>
            )}
            {question?.type === 'single' && (
              <button onClick={() => go(1)}
                style={ans
                  ? { flex: 1, padding: '12px 22px', borderRadius: 9, border: 'none', background: C.purple, color: C.white, fontSize: 14, fontWeight: 600, cursor: 'pointer' }
                  : { padding: '11px 18px', borderRadius: 9, border: `1px solid ${C.border}`, background: C.white, color: C.sub, fontSize: 13, cursor: 'pointer' }}>
                {ans ? (qIndex === QUESTIONS.length - 1 ? 'Choose your plan →' : 'Next →') : 'Skip'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── RIGHT ── */}
      <div className="shep-setup-right" style={{ width: '45%', background: C.purpleDark, minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 40px', boxSizing: 'border-box', position: 'sticky', top: 0, height: '100vh', overflowY: 'auto' }}>

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

        {/* Live preview — decorative mockup, dropped on narrow phones so the
            progress tracker (the part that actually matters on mobile)
            isn't fighting a second full-width block for space. */}
        <div className="shep-setup-preview" style={{ width: '100%', maxWidth: 340 }}>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 10 }}>Live preview</div>
          <PreviewPanel answers={answers} />
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', textAlign: 'center', marginTop: 8 }}>Updates as you answer</div>
        </div>
      </div>

      <style>{`
        @media (max-width: 860px) {
          .shep-setup-shell { flex-direction: column !important; }
          .shep-setup-left { width: 100% !important; min-height: auto !important; padding: 28px 20px !important; }
          .shep-setup-right { width: 100% !important; position: static !important; height: auto !important; min-height: auto !important; padding: 24px 20px 32px !important; }
        }
        @media (max-width: 640px) {
          .shep-setup-preview { display: none !important; }
        }
      `}</style>
    </div>
  );
}
