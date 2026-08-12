// Single source of truth for the Terms of Use text and its version stamp.
// Bump TERMS_VERSION any time the wording materially changes — TermsGate
// compares it against each user's stored terms_version and re-prompts
// anyone still on an older version, the same way a password-policy change
// would force a re-acceptance.
//
// NOTE: this is a first-pass draft written to close the gap of there being
// no terms flow at all — it has not been reviewed by counsel. Replace this
// text with your actual reviewed terms before relying on it for anything.
export const TERMS_VERSION = '2026-08-12';

export const TERMS_SECTIONS: { heading: string; body: string }[] = [
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
  {
    heading: 'Changes',
    body: 'We may update these terms as the product evolves. Material changes require re-acceptance before continued use, the same way this version did.',
  },
];
