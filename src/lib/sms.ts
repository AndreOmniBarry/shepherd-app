// Pluggable SMS sender. No provider is configured yet — until SMS_API_URL and
// SMS_API_KEY are set, this logs the message and returns { sent: false }
// instead of throwing, so every call site can ship today and start actually
// sending the moment real credentials are added — no code changes needed.
//
// Body shape below matches Termii's generic send endpoint (a common choice
// for Nigerian SMS delivery). If a different provider is used instead, this
// is the one place to adjust the request shape.
export async function sendSMS(to: string, message: string): Promise<{ sent: boolean; reason?: string }> {
  if (!to?.trim()) return { sent: false, reason: 'No phone number on file' };

  const apiUrl = process.env.SMS_API_URL;
  const apiKey = process.env.SMS_API_KEY;
  const senderId = process.env.SMS_SENDER_ID || 'SHEPHERD';

  if (!apiUrl || !apiKey) {
    console.log(`[SMS not sent — no provider configured yet] to=${to}: ${message}`);
    return { sent: false, reason: 'No SMS provider configured yet' };
  }

  try {
    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({ to, from: senderId, sms: message, channel: 'generic', type: 'plain' }),
    });
    if (!res.ok) {
      console.error('[SMS send failed]', res.status, await res.text().catch(() => ''));
      return { sent: false, reason: `Provider returned ${res.status}` };
    }
    return { sent: true };
  } catch (err) {
    console.error('[SMS send error]', err);
    return { sent: false, reason: 'Network error reaching SMS provider' };
  }
}

export function welcomeMessage(fullName: string): string {
  const firstName = fullName.trim().split(/\s+/)[0];
  return `Hi ${firstName}, welcome to the family! We're glad you're with us. God bless you. — SHEP.HERD`;
}
