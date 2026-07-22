// Fixed placeholder ids used by the "preview a portal" (impersonation) feature —
// never tied to a real leader. Shared between the impersonate route (which
// creates/uses them) and middleware (which blocks them from writing anything).
export const DEMO_ID: Record<string, string> = {
  cell_leader:      '00000000-0000-0000-0000-0000000000d1',
  fellowship_head:  '00000000-0000-0000-0000-0000000000d2',
  department_head:  '00000000-0000-0000-0000-0000000000d3',
  care_team:        '00000000-0000-0000-0000-0000000000d4',
  accounts:         '00000000-0000-0000-0000-0000000000d5',
  partnership:      '00000000-0000-0000-0000-0000000000d6',
};

export const DEMO_USER_IDS = new Set(Object.values(DEMO_ID));
