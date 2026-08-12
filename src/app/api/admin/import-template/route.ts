export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';
import { getAuthUser } from '@/lib/auth';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const hdrs = () => ({ apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' });

// Restricted the same as the Data Cleanup panel — this hands out a
// liability-bearing artifact (the church is about to attest their data is
// accurate on the strength of it), so "super-admin only" is the right bar,
// not every admin role.
const TEMPLATE_ROLES = ['general_overseer', 'lead_tech'];

// The blank church-data-import workbook lives outside /public deliberately
// — a direct static URL would let anyone download it without ever passing
// through the consent step below. It's served only through this route.
const TEMPLATE_PATH = path.join(process.cwd(), 'scripts', 'templates', 'church_data_import_template.xlsx');

// Consent is the whole point of this route: the church rep is attesting
// they've reviewed the (empty, at this point) template and that whatever
// they eventually fill in and send back is their own responsibility, not
// SHEP.HERD's. No consent, no file — this is not optional metadata.
export async function POST(req: Request) {
  const user = await getAuthUser(req);
  if (!user || !TEMPLATE_ROLES.includes(user.role)) {
    return NextResponse.json({ data: null, error: { message: 'Only a general overseer or tech admin can download the import template' } }, { status: 403 });
  }
  if (!user.church_id) {
    return NextResponse.json({ data: null, error: { message: 'No church on this account' } }, { status: 400 });
  }

  const { consent } = await req.json().catch(() => ({ consent: false }));
  if (consent !== true) {
    return NextResponse.json({ data: null, error: { message: 'You must confirm you have reviewed the template before downloading it' } }, { status: 400 });
  }

  await fetch(`${SUPABASE_URL}/rest/v1/data_import_consents`, {
    method: 'POST', headers: { ...hdrs(), Prefer: 'return=minimal' },
    body: JSON.stringify({ church_id: user.church_id, user_id: user.id }),
  }).catch(() => {}); // log-and-continue — a logging hiccup shouldn't block the download itself

  try {
    const file = await readFile(TEMPLATE_PATH);
    return new NextResponse(new Uint8Array(file), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="shepherd-church-data-import-template.xlsx"',
      },
    });
  } catch (err) {
    console.error('[POST /api/admin/import-template]', err);
    return NextResponse.json({ data: null, error: { message: 'Template file not found on the server' } }, { status: 500 });
  }
}
