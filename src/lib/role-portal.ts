// Single source of truth for "which portal does this role land on" — this
// exact mapping was previously copy-pasted independently into middleware.ts,
// login/page.tsx, calendar/page.tsx, and the login-as/impersonate API routes.
// Every copy drifted out of sync as new roles were added (general_overseer,
// branch_pastor, workforce), each one silently falling through to a default
// case instead of erroring — which is exactly how a general_overseer's own
// login ended up landing on the cell portal. One function, imported
// everywhere, so a new role only ever needs to be added once.
export function rolePortal(role: string): string {
  switch (role) {
    case 'overseer':
    case 'general_overseer':
    case 'branch_pastor':
    case 'pa':
    case 'lead_tech':
      return '/dashboard';
    case 'fellowship_head':
      return '/fellowship';
    case 'department_head':
      return '/department';
    case 'cell_leader':
      return '/cell';
    case 'accounts':
      return '/accounts';
    case 'partnership':
      return '/partnership';
    case 'care_team':
      return '/care';
    case 'workforce':
      return '/workforce';
    default:
      return '/cell';
  }
}
