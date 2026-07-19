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
    description: 'Zones → Districts → Cells. Classical Pentecostal hierarchy for large denominations.',
    icon: '🗺',
    usedBy: "Winners Chapel, CAC, Deeper Life",
    tier1_label: 'Zone',
    tier2_label: 'District',
    tier3_label: 'Cell',
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
