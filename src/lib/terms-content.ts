// Single source of truth for the Terms of Use text and its version stamp.
// Bump TERMS_VERSION any time the wording materially changes — TermsGate
// compares it against each user's stored terms_version and re-prompts
// anyone still on an older version, the same way a password-policy change
// would force a re-acceptance.
//
// Portal-dynamic: everyone gets the same CORE sections, plus whichever
// ROLE_SECTIONS entries apply to their role — a cell_leader never sees the
// finance clause a pa/accounts/overseer sees, a branch_pastor sees the
// branch-scope clause, etc. getTermsSections(role) is what TermsGate and
// the accept-terms route both call, so "what did this person actually
// agree to" always matches what was rendered to them.
//
// Written from experience with what a small SaaS actually needs covered —
// not a substitute for a lawyer if/when the stakes go up (e.g. handling
// real payment card data directly, expanding to a jurisdiction with its
// own church-data rules). Fine as the working version until then.
export const TERMS_VERSION = '2026-08-12';

type Section = { heading: string; body: string };

const CORE_SECTIONS: Section[] = [
  {
    heading: 'What SHEP.HERD is',
    body: 'SHEP.HERD is church management software provided on a subscription basis. Your church controls the member, attendance, financial, and communication data it enters into the platform.',
  },
  {
    heading: 'Your data',
    body: 'Your church owns the data it enters. We store it to provide the service and do not sell it. You are responsible for the accuracy of data your team enters or imports, including data provided via a bulk import template — SHEP.HERD is not liable for decisions made on the basis of inaccurate data your organization supplied.',
  },
  {
    heading: 'Acceptable use',
    body: 'Accounts are for your church’s own staff and leadership. Attempting to bypass subscription limits, share login credentials outside your organization, or use the platform to send unsolicited communication is a violation of these terms.',
  },
  {
    heading: 'Account suspension',
    body: 'We retain the right to suspend or permanently disable any account that violates these terms, attempts to bypass payment, or is used in a way that risks the security or data of other churches on the platform. Suspensions are logged and reversible by request unless tied to a security incident.',
  },
  {
    heading: 'Liability',
    body: 'The service is provided "as is." To the maximum extent permitted by law, SHEP.HERD is not liable for indirect, incidental, or consequential damages arising from use of the platform, including data entered, imported, or exported by your organization.',
  },
];

// Additive per-role clauses. Keyed by the exact Role values used across the
// app (see src/types) — add a new key here the day a new role touches data
// class this doesn't already cover.
const ROLE_SECTIONS: Record<string, Section[]> = {
  overseer: [{ heading: 'Church-wide administration', body: 'As an overseer, actions you take (adding/removing leaders, changing structure, exporting data) apply church-wide, not just to one branch or unit. You are responsible for who on your team gets admin-level access.' }],
  general_overseer: [{ heading: 'Church-wide administration', body: 'As general overseer, actions you take (adding/removing leaders, changing structure, exporting data, suspending accounts) apply church-wide. You are responsible for who on your team gets admin-level access, and for reviewing the Data Cleanup and import-template tools if you use them.' }],
  branch_pastor: [{ heading: 'Branch scope', body: 'Your account is scoped to your assigned branch. Actions you take affect that branch\'s records, not other branches in a multi-branch church.' }],
  pa: [{ heading: 'Financial data access', body: 'If your account has been granted finance access, you are handling your church\'s giving and financial records. Treat that access the same way you\'d treat access to a physical financial ledger — do not share your login, and report any suspected unauthorized access immediately.' }],
  accounts: [{ heading: 'Financial data access', body: 'Your role involves your church\'s giving and financial records. Treat that access the same way you\'d treat access to a physical financial ledger — do not share your login, and report any suspected unauthorized access immediately.' }],
  lead_tech: [{ heading: 'Platform administration', body: 'Your account has cross-church platform access for support purposes. This is a materially higher trust level than any church-side role — specific actions you take (removing a leader, merging cells, sending an invite) are recorded against your account, and this access is for legitimate support/maintenance only, never for viewing a church\'s data out of curiosity.' }],
  care_team: [{ heading: 'Sensitive pastoral information', body: 'Prayer requests and follow-up notes you handle are often sensitive and personal. Keep them confidential outside the care/follow-up context they were shared for.' }],
};

const CONTACT_SECTION: Section = {
  heading: 'Questions or concerns',
  body: 'For anything about these terms, your data, or your account — email support@justshephrd.com.',
};

export function getTermsSections(role?: string | null): Section[] {
  const roleExtra = role ? ROLE_SECTIONS[role] || [] : [];
  return [...CORE_SECTIONS, ...roleExtra, CONTACT_SECTION];
}

// Back-compat default export (no role context) — used only as a fallback;
// TermsGate always calls getTermsSections(role) once it knows who's asking.
export const TERMS_SECTIONS = getTermsSections();
