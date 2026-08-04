// ============================================================
// SHEP.HERD — Paystack integration
// No live keys configured yet — every function here fails soft (returns
// null/false) until PAYSTACK_SECRET_KEY is set, same pattern as
// src/lib/sms.ts: ships today, activates the moment real credentials
// are added, no code changes needed.
// ============================================================
import crypto from 'crypto';

function secretKey(): string | null {
  return process.env.PAYSTACK_SECRET_KEY || null;
}

export type PaystackVerifyResult = {
  ok: boolean;
  reason?: string;
  amount_ngn?: number; // converted from kobo
  currency?: string;
  status?: string;
};

// GET /transaction/verify/:reference — the one call that actually confirms
// money moved. Never trust a client-supplied reference without this: it's
// the difference between "upgraded because they paid" and "upgraded
// because they typed a plausible-looking string into a request body."
export async function verifyPaystackTransaction(reference: string): Promise<PaystackVerifyResult> {
  const key = secretKey();
  if (!key) return { ok: false, reason: 'Paystack is not configured yet' };
  if (!reference?.trim()) return { ok: false, reason: 'Missing reference' };

  try {
    const res = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
      headers: { Authorization: `Bearer ${key}` },
    });
    const json = await res.json();
    if (!res.ok || !json?.data) {
      return { ok: false, reason: json?.message || `Paystack returned ${res.status}` };
    }
    const { status, amount, currency } = json.data;
    if (status !== 'success') return { ok: false, reason: `Transaction status is "${status}", not success`, status };
    return { ok: true, amount_ngn: amount / 100, currency, status };
  } catch (err) {
    console.error('[verifyPaystackTransaction]', err);
    return { ok: false, reason: 'Network error reaching Paystack' };
  }
}

// Paystack signs every webhook body with HMAC-SHA512 of the raw request
// body, using the same secret key — this is the only thing standing
// between "a real Paystack event" and "anyone who finds the URL and POSTs
// a fake charge.success". rawBody MUST be the exact unparsed request text;
// re-serializing parsed JSON before hashing would silently break this on
// any whitespace/key-order difference.
export function verifyPaystackSignature(rawBody: string, signatureHeader: string | null): boolean {
  const key = secretKey();
  if (!key || !signatureHeader) return false;
  const hash = crypto.createHmac('sha512', key).update(rawBody).digest('hex');
  return hash === signatureHeader;
}

export function isPaystackConfigured(): boolean {
  return !!secretKey();
}
