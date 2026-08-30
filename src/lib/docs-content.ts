// ============================================================
// SHEP.HERD — Docs content (single source of truth)
// Feature walkthroughs + per-role manuals, consumed by
// /docs, /docs/features/[slug], /docs/roles/[slug].
// ============================================================

export type StatTile = { label: string; value: string; sub?: string };
export type MockNav = string[];

export type FeatureDoc = {
  slug: string;
  title: string;
  tagline: string;
  accent: 'purple' | 'teal' | 'amber' | 'coral';
  description: string;
  bullets: string[];
  relatedRoles: string[];
  mock: {
    appName: string;
    nav: MockNav;
    activeIndex: number;
    heading: string;
    tiles: StatTile[];
    chartLabel: string;
    chartValues: number[];
  };
};

export type RoleSection = { heading: string; steps: string[] };
export type RoleDoc = {
  slug: string;
  title: string;
  portal: string;
  summary: string;
  sections: RoleSection[];
};

export const FEATURE_DOCS: FeatureDoc[] = [
  {
    slug: 'structure',
    title: 'Cell & Fellowship Structure',
    tagline: 'Your hierarchy, modeled exactly as it runs',
    accent: 'purple',
    description: 'SHEPHERD adapts to how your church is actually organised — cell church, zonal, multi-campus, department, or house network — rather than forcing every ministry into the same shape. Members roll up through cells, fellowships, and branches, with attendance, growth, and follow-up visible at every level.',
    bullets: [
      'Six structure presets to match cell church, zonal, campus, department, house-network, or single-congregation models',
      'Branch-scoped data — a branch pastor never sees another branch\'s members or finances',
      'Custom tier labels (Fellowship/Zone/Campus, Cell/District/Unit) so the app speaks your church\'s language',
      'Roll-up reporting: a fellowship head sees every cell beneath them in one view',
    ],
    relatedRoles: ['overseer', 'fellowship_head', 'cell_leader'],
    mock: {
      appName: 'app.shepherd.church',
      nav: ['Dashboard', 'Fellowships', 'Cells', 'Members', 'Reports'],
      activeIndex: 1,
      heading: 'Fellowships · Grace Chapel',
      tiles: [
        { label: 'Fellowships', value: '6', sub: 'active' },
        { label: 'Cells', value: '48', sub: 'across all fellowships' },
        { label: 'Members', value: '1,240', sub: 'registered' },
        { label: 'Avg. cell size', value: '26', sub: 'members' },
      ],
      chartLabel: 'Fellowship attendance rate',
      chartValues: [78, 82, 75, 88, 84, 91],
    },
  },
  {
    slug: 'attendance',
    title: 'Attendance & Absence Follow-Up',
    tagline: 'Every service, every cell, every absence — accounted for',
    accent: 'teal',
    description: 'Attendance is logged at every service and cell meeting, and absences trigger a real follow-up workflow instead of disappearing into a notebook — with categorised reasons like bereavement, family emergency, or informed in advance, so leaders know who actually needs a visit.',
    bullets: [
      'Service and cell-meeting attendance logged by leaders in seconds',
      'Automatic absence alerts the moment a member misses a single service',
      'Structured follow-up reasons, not just a yes/no checkbox',
      'Attendance-report accuracy review — fellowship heads can flag "marked absent but was present" style disputes',
    ],
    relatedRoles: ['cell_leader', 'fellowship_head', 'department_head'],
    mock: {
      appName: 'app.shepherd.church',
      nav: ['Dashboard', 'Members', 'Attendance', 'Meetings', 'History'],
      activeIndex: 2,
      heading: 'Attendance · Cell 12',
      tiles: [
        { label: 'This Sunday', value: '22 / 26', sub: '85% present' },
        { label: 'Follow-up queue', value: '3', sub: '1 urgent' },
        { label: 'Streak', value: '6 wks', sub: 'no missed reports' },
        { label: 'New this month', value: '2', sub: 'first-timers' },
      ],
      chartLabel: 'Attendance — last 6 weeks',
      chartValues: [70, 74, 68, 85, 80, 88],
    },
  },
  {
    slug: 'giving',
    title: 'Giving & Accounts',
    tagline: 'A ledger your board will actually trust',
    accent: 'amber',
    description: 'Income, expenses, and approval workflows live in one place, with financial periods and a live net balance. Requisitions move through a real approval chain instead of a verbal okay, and every entry is tied to who logged it and when.',
    bullets: [
      'Income and expense logging with configurable categories per church',
      'Expense requisition approval workflow with an audit trail',
      'Financial periods for clean month/quarter close-outs',
      'Live net balance and a built-in calculator widget for reconciliation',
    ],
    relatedRoles: ['accounts', 'overseer'],
    mock: {
      appName: 'app.shepherd.church',
      nav: ['Overview', 'Income', 'Expenses', 'Requisitions'],
      activeIndex: 0,
      heading: 'Accounts · Overview',
      tiles: [
        { label: 'Income (MTD)', value: '₦6.8M', sub: '+12% vs last mo.' },
        { label: 'Expenses (MTD)', value: '₦2.1M', sub: '3 pending approval' },
        { label: 'Net balance', value: '₦4.7M', sub: 'as of today' },
        { label: 'Requisitions', value: '5', sub: 'awaiting sign-off' },
      ],
      chartLabel: 'Income vs. expenses — 6 months',
      chartValues: [60, 68, 72, 65, 80, 88],
    },
  },
  {
    slug: 'partnership',
    title: 'Partnership Portal',
    tagline: 'Covenant giving, tracked like it matters',
    accent: 'coral',
    description: 'Partners are grouped into giving bands, with monthly targets and consistency tracked automatically. Collection-rate charts show exactly who\'s current and who\'s lapsed, so your partnership office spends its time on relationships, not spreadsheets.',
    bullets: [
      'Giving bands (Silver, Gold, Platinum, Diamond) with per-band monthly targets',
      'Automatic consistency and "months given" tracking per partner',
      'Collection-rate charts by month, built for a Growth+ plan',
      'A dedicated lapsed-partner view for re-engagement follow-up',
    ],
    relatedRoles: ['partnership', 'overseer'],
    mock: {
      appName: 'app.shepherd.church',
      nav: ['Overview', 'Partners', 'Log Giving', 'Lapsed'],
      activeIndex: 0,
      heading: 'Partnership · Overview',
      tiles: [
        { label: 'Active partners', value: '184', sub: 'across 4 bands' },
        { label: 'Collection rate', value: '91%', sub: 'this month' },
        { label: 'Lapsed', value: '9', sub: 'need re-engagement' },
        { label: 'Diamond band', value: '12', sub: 'partners' },
      ],
      chartLabel: 'Collection rate — 6 months',
      chartValues: [82, 85, 79, 90, 88, 91],
    },
  },
  {
    slug: 'care',
    title: 'Care & Follow-Up Pipeline',
    tagline: 'First-timers and altar calls, never lost in the shuffle',
    accent: 'purple',
    description: 'Two pipelines live in one portal: an absence-follow-up queue for members who\'ve stopped showing up, and a first-timer queue for anyone new — walk-in, altar call, crusade, or online. Each moves through its own real stages, with reasons tracked at every step so patterns are visible instead of lost.',
    bullets: [
      'First-timer pipeline: Contacted → Follow-up scheduled → Converted or Declined',
      'Absence pipeline: New → In progress → Reached/Visited → Restored, Unreachable, or Closed',
      'Altar call, crusade, walk-in, and online intake all land in the same first-timer queue, tagged by how they came',
      'Birthdays and upcoming events surfaced right in the care team\'s own portal',
    ],
    relatedRoles: ['care_team', 'overseer'],
    mock: {
      appName: 'app.shepherd.church',
      nav: ['Overview', 'Absence queue', 'First timers', 'History', 'Birthdays'],
      activeIndex: 1,
      heading: 'Care & Follow-Up · Absence queue',
      tiles: [
        { label: 'Active leads', value: '31', sub: '8 new this week' },
        { label: 'Contacted', value: '14', sub: 'in progress' },
        { label: 'Converted (MTD)', value: '9', sub: 'joined a cell' },
        { label: 'Response time', value: '1.2 days', sub: 'avg. first contact' },
      ],
      chartLabel: 'Leads converted — 6 weeks',
      chartValues: [4, 6, 5, 9, 7, 9],
    },
  },
  {
    slug: 'workforce',
    title: 'Workforce & Serving',
    tagline: 'Rosters and schedules, without the phone tree',
    accent: 'teal',
    description: 'Department rosters and serving schedules live in one calendar, and every volunteer confirms or declines their own assignment from a self-service portal — no more group-chat reminders or a coordinator chasing people down individually.',
    bullets: [
      'Department rosters with serving schedules built weeks in advance',
      'Self-service confirm/decline for every volunteer, in their own portal',
      'Department heads invite roster members directly onto the workforce portal',
      'Full visibility into who\'s serving, when, and whether they\'ve confirmed',
    ],
    relatedRoles: ['workforce', 'department_head'],
    mock: {
      appName: 'app.shepherd.church',
      nav: ['Upcoming', 'Past assignments'],
      activeIndex: 0,
      heading: 'Workforce · Upcoming',
      tiles: [
        { label: 'This Sunday', value: 'Ushering', sub: '8:00am service' },
        { label: 'Status', value: 'Awaiting you', sub: 'Confirm or decline' },
        { label: 'This month', value: '3', sub: 'assignments confirmed' },
        { label: 'Past assignments', value: '18', sub: 'on file' },
      ],
      chartLabel: 'Confirmed vs. declined — 6 weeks',
      chartValues: [85, 88, 80, 92, 89, 94],
    },
  },
  {
    slug: 'ai',
    title: 'Moshe, Your AI Agent',
    tagline: 'Ask your data a question, get a real answer',
    accent: 'amber',
    description: 'Moshe reads your church\'s own live data — never fabricated, never estimated — and answers plain-language questions about attendance trends, giving patterns, or who\'s drifting from cell life. Financial-data access is enforced by role in code, not just by prompt instructions.',
    bullets: [
      '"Which cells have dropped in attendance the last 3 weeks?" — answered from live data',
      'Financial-table access is hard-scoped to overseer-level roles only',
      'Full conversation memory within a session for natural follow-up questions',
      'A Growth+ plan feature — visible on trial and Starter, but locked until active',
    ],
    relatedRoles: ['overseer'],
    mock: {
      appName: 'app.shepherd.church',
      nav: ['Ask Moshe', 'History'],
      activeIndex: 0,
      heading: 'Moshe · Ask a question',
      tiles: [
        { label: 'Query', value: '"Cells losing attendance?"', sub: '' },
        { label: 'Cells flagged', value: '3', sub: 'down 15%+ in 3 wks' },
        { label: 'Top concern', value: 'Cell 12', sub: '-22% since wk 1' },
        { label: 'Response time', value: '2.1s', sub: '' },
      ],
      chartLabel: 'Flagged cells — attendance trend',
      chartValues: [90, 82, 74, 68, 65, 60],
    },
  },
  {
    slug: 'community',
    title: 'Chat, Feed & Events',
    tagline: 'The parts of church life that aren\'t attendance',
    accent: 'coral',
    description: 'Internal messaging between staff and leaders, a church-wide feed for announcements and testimonies, a shared calendar of programs, and public event registration pages that anyone can sign up for — no account required.',
    bullets: [
      'Direct and group chat between any two roles on a Growth or Enterprise plan; admin-level roles only on trial/Starter',
      'Church-wide feed with comments and acknowledgements',
      'Shared calendar visible to every role, not siloed by portal',
      'Public event pages with anonymous registration — the one page open to non-members',
    ],
    relatedRoles: ['overseer', 'fellowship_head', 'cell_leader'],
    mock: {
      appName: 'app.shepherd.church',
      nav: ['Feed', 'Chat', 'Calendar', 'Events'],
      activeIndex: 0,
      heading: 'Church Feed',
      tiles: [
        { label: 'New posts', value: '4', sub: 'today' },
        { label: 'Unread messages', value: '7', sub: 'across 3 chats' },
        { label: 'Upcoming events', value: '2', sub: 'this week' },
        { label: 'Registrations', value: '112', sub: 'Youth Conference' },
      ],
      chartLabel: 'Feed engagement — 6 weeks',
      chartValues: [55, 62, 58, 70, 66, 75],
    },
  },
];

export const ROLE_DOCS: RoleDoc[] = [
  {
    slug: 'overseer',
    title: 'Overseer / Pastor\'s Assistant / Lead Tech',
    portal: '/dashboard',
    summary: 'Full visibility across every portal — attendance, structure, giving, and team management — for troubleshooting and top-level oversight.',
    sections: [
      { heading: 'Getting oriented', steps: [
        'Log in and land on the Dashboard — church-wide attendance and structure at a glance.',
        'Use the sidebar to open any portal (Fellowship, Cell, Care, Workforce, Accounts) exactly as that role would see it.',
        'Plan tier and trial status aren\'t self-serve yet — email support@justshephrd.com if you need to check or change yours.',
      ]},
      { heading: 'Building your team', steps: [
        'Open Team Access from the Dashboard to invite new users into any role.',
        'Each invite generates a signup link — share it directly, since no email is sent automatically yet.',
        'Assign a fellowship, department, or cell to an invite when you know it in advance, or leave it for the person to be assigned later.',
      ]},
      { heading: 'Reviewing church health', steps: [
        'Use the attendance history panel to spot trends across fellowships.',
        'Open Moshe (if your plan includes it) to ask plain-language questions about the data.',
        'Check the alerts panel for trials nearing expiry or churches needing attention (multi-church admin only).',
      ]},
    ],
  },
  {
    slug: 'fellowship_head',
    title: 'Fellowship Head',
    portal: '/fellowship',
    summary: 'Oversees every cell within your fellowship — attendance rollup, giving, and an attendance-accuracy review tool.',
    sections: [
      { heading: 'Daily use', steps: [
        'Check the Members tab for anyone new or missing across your cells.',
        'Review the Attendance tab for your fellowship\'s overall rate and average attendance.',
        'Use the Giving tab to see collective offerings reported by your cells.',
      ]},
      { heading: 'Handling disputes', steps: [
        'Open the report-accuracy tab if a cell leader flags "marked absent but was present."',
        'Resolve the dispute directly — it updates the underlying attendance record.',
      ]},
    ],
  },
  {
    slug: 'cell_leader',
    title: 'Cell Leader',
    portal: '/cell',
    summary: 'Runs day-to-day cell life — members, attendance, meetings, and follow-up on anyone who misses.',
    sections: [
      { heading: 'Weekly rhythm', steps: [
        'Log this week\'s meeting attendance right after your cell meets.',
        'Check the Members tab for upcoming birthdays to acknowledge.',
        'Record prayer requests raised during the meeting.',
      ]},
      { heading: 'Following up on absences', steps: [
        'Open the Attendance tab to see who missed and for how long.',
        'Log a follow-up reason once you\'ve reached out — bereavement, family emergency, or informed in advance.',
        'Escalate to your fellowship head if someone has been unreachable for several weeks.',
      ]},
    ],
  },
  {
    slug: 'department_head',
    title: 'Department Head',
    portal: '/department',
    summary: 'Manages a ministry department — members, attendance, serving schedules, and inviting roster members onto Workforce.',
    sections: [
      { heading: 'Running your department', steps: [
        'Review Members for your full roster.',
        'Build the Serving Schedule for upcoming services or events.',
        'Check Attendance for department meetings, same absence-followup flow as cells.',
      ]},
      { heading: 'Onboarding your team to Workforce', steps: [
        'From your roster, invite a member directly onto the self-service Workforce portal.',
        'They\'ll confirm or decline their own assignments from then on — no more manual reminders.',
      ]},
    ],
  },
  {
    slug: 'workforce',
    title: 'Workforce (Serving Team Member)',
    portal: '/workforce',
    summary: 'A lightweight, self-service portal for confirming or declining your own serving assignments.',
    sections: [
      { heading: 'Each week', steps: [
        'Open My Schedule to see your next assignment.',
        'Tap Confirm if you\'re available, or Decline with a reason if not — your department head sees it immediately.',
      ]},
    ],
  },
  {
    slug: 'accounts',
    title: 'Accounts',
    portal: '/accounts',
    summary: 'Owns the church ledger — income, expenses, requisition approvals, and financial period close-outs.',
    sections: [
      { heading: 'Logging transactions', steps: [
        'Log income by category as it comes in — offerings, tithes, special giving.',
        'Log expenses and route larger ones through the requisition approval flow.',
        'Use the built-in calculator widget for quick reconciliation while you work.',
      ]},
      { heading: 'Closing a period', steps: [
        'Find the Financial Periods panel on your Overview tab once a month or quarter ends.',
        'Confirm the net balance matches your physical records before closing the period.',
      ]},
    ],
  },
  {
    slug: 'partnership',
    title: 'Partnership Admin',
    portal: '/partnership',
    summary: 'Manages covenant partners, giving bands, monthly targets, and re-engagement of lapsed partners.',
    sections: [
      { heading: 'Managing partners', steps: [
        'Add a new partner and assign them to a giving band (Silver, Gold, Platinum, Diamond).',
        'Log giving as it comes in from the Log Giving tab.',
        'Check the Overview tab\'s collection-rate chart each month.',
      ]},
      { heading: 'Re-engaging lapsed partners', steps: [
        'Open the Lapsed tab to see who has missed a payment cycle.',
        'Reach out directly, then log their next gift to move them back to active.',
      ]},
    ],
  },
  {
    slug: 'care_team',
    title: 'Follow-Up & Care Team',
    portal: '/care',
    summary: 'Runs the first-timer and altar-call follow-up pipeline from first contact to conversion.',
    sections: [
      { heading: 'Working the pipeline', steps: [
        'Check Active Leads for anyone not yet contacted.',
        'Move a lead to Contacted once you\'ve reached out, and log the outcome.',
        'Mark Converted once someone joins a cell, or Closed with a reason if they decline further contact.',
      ]},
      { heading: 'Outreach intake', steps: [
        'Use the crusade/outreach intake form to add altar-call responses directly into the same pipeline.',
      ]},
    ],
  },
];

export function featureBySlug(slug: string) { return FEATURE_DOCS.find(f => f.slug === slug); }
export function roleBySlug(slug: string) { return ROLE_DOCS.find(r => r.slug === slug); }
