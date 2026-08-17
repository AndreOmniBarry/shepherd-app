// ============================================================
// SHEP.HERD — Church Structure Configuration
// Reads from church_config table in Supabase
// Cached in module scope per request cycle
// ============================================================

export type StructureType =
  | 'cell_church'
  | 'zonal'
  | 'campus'
  | 'department'
  | 'house_network'
  | 'single';

export type ChurchConfig = {
  id: string;
  church_name: string;
  structure_type: StructureType;
  tier1_label: string | null;  // Fellowship / Zone / Campus / Department / Network / null
  tier2_label: string | null;  // Cell / District / Fellowship / Unit / Home Group / null
  tier3_label: string | null;  // null / Cell / Cell / null / null / null
  tier1_head_label: string;    // Fellowship Head / Zone Leader / Campus Pastor etc
  tier2_head_label: string;    // Cell Leader / District Pastor / Cell Leader etc
  currency: string;
  country: string;
  timezone: string;
  service_days: string[];
  logo_url: string | null;
  is_configured: boolean;
  plan_tier?: string;
  subscription_status?: string;
  subscription_started_at?: string | null;
  trial_started_at?: string | null;
  trial_ends_at?: string | null;
};

export const STRUCTURE_PRESETS: Record<StructureType, {
  label: string;
  description: string;
  icon: string;
  usedBy: string;
  tier1_label: string | null;
  tier2_label: string | null;
  tier3_label: string | null;
  tier1_head_label: string;
  tier2_head_label: string;
}> = {
  cell_church: {
    label: 'Cell Church',
    description: 'Fellowships divided into cells. Each fellowship head oversees multiple cell leaders.',
    icon: '⛪',
    usedBy: 'RCCG, Comforters House, City churches',
    tier1_label: 'Fellowship',
    tier2_label: 'Cell',
    tier3_label: null,
    tier1_head_label: 'Fellowship Head',
    tier2_head_label: 'Cell Leader',
  },
  zonal: {
    label: 'Zonal Church',
    // "Zones → Districts → Cells" is the real-world shape these
    // denominations describe themselves with, but only two levels are
    // actually wired up today (Zone/District, via the same generic
    // tier1/tier2 mechanism as cell_church) — see the Tier 3 field removal
    // in dashboard.tsx's ChurchSettingsPanel for why a third tier isn't
    // just a missing label here.
    description: 'Zones → Districts. Classical Pentecostal hierarchy for large denominations.',
    icon: '🗺',
    usedBy: "Winners Chapel, CAC, Deeper Life",
    tier1_label: 'Zone',
    tier2_label: 'District',
    tier3_label: null,
    tier1_head_label: 'Zonal Pastor',
    tier2_head_label: 'District Leader',
  },
  campus: {
    label: 'Multi-Campus',
    description: 'Multiple physical locations, each with its own campus pastor and structure.',
    icon: '🏙',
    usedBy: 'Elevation Church, Hillsong-style churches',
    tier1_label: 'Campus',
    tier2_label: 'Fellowship',
    tier3_label: 'Cell',
    tier1_head_label: 'Campus Pastor',
    tier2_head_label: 'Fellowship Head',
  },
  department: {
    label: 'Department Church',
    description: 'Ministry departments with units. No cell structure — organised by function.',
    icon: '🏛',
    usedBy: 'Cathedral-style, liturgical churches',
    tier1_label: 'Department',
    tier2_label: 'Unit',
    tier3_label: null,
    tier1_head_label: 'Department Head',
    tier2_head_label: 'Unit Leader',
  },
  house_network: {
    label: 'House Church Network',
    description: 'Home groups under a network coordinator. No central building.',
    icon: '🏠',
    usedBy: 'New-generation, organic church movements',
    tier1_label: 'Network',
    tier2_label: 'Home Group',
    tier3_label: null,
    tier1_head_label: 'Network Coordinator',
    tier2_head_label: 'Host Leader',
  },
  single: {
    label: 'Single Congregation',
    description: 'One congregation, one pastor. No sub-structure needed.',
    icon: '🤲',
    usedBy: 'Small, rural, and plant churches',
    tier1_label: null,
    tier2_label: null,
    tier3_label: null,
    tier1_head_label: 'Pastor',
    tier2_head_label: 'Pastor',
  },
};

export const DEFAULT_CONFIG: Omit<ChurchConfig, 'id'> = {
  church_name: 'My Church',
  structure_type: 'cell_church',
  tier1_label: 'Fellowship',
  tier2_label: 'Cell',
  tier3_label: null,
  tier1_head_label: 'Fellowship Head',
  tier2_head_label: 'Cell Leader',
  currency: 'NGN',
  country: 'Nigeria',
  timezone: 'Africa/Lagos',
  service_days: ['Sunday'],
  logo_url: null,
  is_configured: false,
};

// Helper: get display label for a tier
export function getTierLabel(config: ChurchConfig, tier: 1 | 2 | 3, plural = false): string {
  const label = tier === 1 ? config.tier1_label : tier === 2 ? config.tier2_label : config.tier3_label;
  if (!label) return '';
  return plural ? `${label}s` : label;
}

export function getHeadLabel(config: ChurchConfig, tier: 1 | 2): string {
  return tier === 1 ? config.tier1_head_label : config.tier2_head_label;
}

// ── Leaf-unit label (Cell Ministry tab) ──────────────────────────
// For every preset except campus, the attendance-tracking leaf unit is
// tier2 (Cell / District / Unit / Home Group). Campus is the one preset
// with a real third tier — Campus/Branch (tier1) → Fellowship (tier2) →
// Cell (tier3) — so its leaf unit is tier3, not tier2. Centralised here
// so every place that renders the Cell Ministry tab's unit name reads
// through one function instead of repeating a structure_type ternary.
export type LeafUnitLabelConfig = {
  structure_type?: string | null;
  tier2_label?: string | null;
  tier3_label?: string | null;
};

export function getLeafUnitLabel(config?: LeafUnitLabelConfig | null): string {
  const label = config?.structure_type === 'campus' ? config?.tier3_label : config?.tier2_label;
  return label || 'Cell';
}

// ── Branch label ──────────────────────────────────────────────────
// The `branches` table backs the Campus/Branch concept for every preset,
// but the plain word "Branch" is only actually renamed for campus (whose
// tier1_label is the Campus/Branch-equivalent, e.g. "Campus"). For every
// other preset tier1_label means something else entirely (the
// Fellowship-equivalent), so it must never be used to relabel branch UI —
// those presets keep showing the literal word "Branch".
export type BranchLabelConfig = {
  structure_type?: string | null;
  tier1_label?: string | null;
};

export function getBranchLabel(config?: BranchLabelConfig | null): string {
  return config?.structure_type === 'campus' ? (config?.tier1_label || 'Branch') : 'Branch';
}

// Minimal English pluraliser for tier-label words used in UI copy (e.g.
// "Branch" -> "Branches", "Campus" -> "Campuses"). Only needs to cover the
// small set of words that actually appear as tier labels.
export function pluralizeLabel(label: string): string {
  return /[sxz]$|[cs]h$/i.test(label) ? `${label}es` : `${label}s`;
}

// ── Role display labels ──────────────────────────────────────────
// Single source of truth for "role value → display label" — this mapping
// was previously copy-pasted independently into dashboard/page.tsx
// (CREATABLE_ROLES), MyAccountButton.tsx (PREVIEW_ROLES), register/page.tsx
// (ROLE_LABELS), and PortalOverview.tsx (inline ternary), and each copy had
// already drifted to slightly different wording for the same role (see
// src/lib/role-portal.ts for the earlier, identical incident with portal
// routing). One function, imported everywhere, so a label only ever needs
// to change in one place.
//
// `config` only needs to carry structure_type + the two head-label fields,
// so any object with that shape works here — not just a full ChurchConfig.
export type RoleLabelConfig = {
  structure_type?: string;
  tier1_head_label?: string | null;
  tier2_head_label?: string | null;
};

const STATIC_ROLE_LABELS: Record<string, string> = {
  care_team: 'Follow-Up & Care Team',
  workforce: 'Workforce',
  accounts: 'Accounts',
  partnership: 'Partnership',
  pa: 'PA / Church Admin',
  overseer: 'Overseer',
  general_overseer: 'General Overseer',
  branch_pastor: 'Branch Pastor',
  lead_tech: 'Lead Tech',
};

export function getRoleLabel(role: string, config?: RoleLabelConfig): string {
  switch (role) {
    case 'cell_leader':
      return config?.tier2_head_label || 'Cell Leader';
    case 'fellowship_head':
      return config?.tier1_head_label || 'Fellowship Head';
    case 'department_head':
      // Departments exist as a secondary structure under every preset, so
      // only pull the customised tier1 head label when the church's actual
      // structure model is "department" — otherwise tier1_head_label means
      // something else entirely (e.g. Fellowship Head in cell_church).
      return config?.structure_type === 'department'
        ? (config?.tier1_head_label || 'Department Head')
        : 'Department Head';
    default:
      return STATIC_ROLE_LABELS[role] || role.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }
}

export const SUPPORTED_CURRENCIES = [
  { code: 'NGN', symbol: '₦', name: 'Nigerian Naira' },
  { code: 'GHS', symbol: 'GH₵', name: 'Ghanaian Cedi' },
  { code: 'KES', symbol: 'KSh', name: 'Kenyan Shilling' },
  { code: 'ZAR', symbol: 'R', name: 'South African Rand' },
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
];

export const AFRICAN_COUNTRIES = [
  'Nigeria', 'Ghana', 'Kenya', 'South Africa', 'Uganda', 'Tanzania',
  'Rwanda', 'Ethiopia', 'Cameroon', 'Côte d\'Ivoire', 'Senegal',
  'Zimbabwe', 'Zambia', 'Malawi', 'Sierra Leone', 'Liberia',
];

export const ALL_COUNTRIES = [
  ...AFRICAN_COUNTRIES,
  'United Kingdom', 'United States', 'Canada', 'Australia',
  'Germany', 'France', 'Netherlands', 'Other',
];
