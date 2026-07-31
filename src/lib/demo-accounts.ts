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
  overseer:         '00000000-0000-0000-0000-0000000000d7',
  general_overseer: '00000000-0000-0000-0000-0000000000d8',
  branch_pastor:    '00000000-0000-0000-0000-0000000000d9',
  pa:               '00000000-0000-0000-0000-0000000000da',
  workforce:        '00000000-0000-0000-0000-0000000000db',
};

export const DEMO_USER_IDS = new Set(Object.values(DEMO_ID));

// PostgREST filter fragment to exclude every fixed demo/preview id from a
// query — use on any users lookup whose result is shown as a real leader
// name (leaderboards, cell/department listings, staff directories). Without
// this, previewing a role for a real cell/department upserts a "DEMO — X"
// row pointed at that real cell_id/department_id, which then silently
// overwrites the real leader's name wherever that id is joined for display.
export const EXCLUDE_DEMO_IDS = `&id=not.in.(${Object.values(DEMO_ID).join(',')})`;
