// Single source of truth for "which countries can a church pick" — the
// onboarding wizard (setup/page.tsx) needs flag icons for its own custom
// picker UI, so it keeps its own richer array, but every OTHER country
// dropdown in the app (e.g. the post-onboarding Settings panel) should
// draw from this list so a country added in one place doesn't silently
// stay missing everywhere else.
export const COUNTRY_NAMES = [
  'Nigeria', 'Ghana', 'Kenya', 'South Africa', 'Uganda', 'Tanzania', 'Rwanda', 'Ethiopia',
  'Cameroon', "Côte d'Ivoire", 'Senegal', 'Zimbabwe', 'Zambia', 'Malawi', 'Mozambique', 'Angola',
  'DR Congo', 'Sierra Leone', 'Liberia', 'Togo', 'Benin', 'Niger', 'Burkina Faso', 'Mali',
  'Botswana', 'Namibia', 'Algeria', 'Egypt', 'Morocco', 'Tunisia', 'Libya', 'Sudan',
  'South Sudan', 'Chad', 'Central African Republic', 'Congo', 'Gabon', 'Equatorial Guinea',
  'São Tomé and Príncipe', 'Guinea', 'Guinea-Bissau', 'Gambia', 'Cape Verde', 'Mauritania',
  'Burundi', 'Comoros', 'Djibouti', 'Eritrea', 'Somalia', 'Eswatini', 'Lesotho', 'Madagascar',
  'Mauritius', 'Seychelles',
  'United Kingdom', 'United States', 'Canada', 'Australia', 'Germany', 'Netherlands', 'Italy',
  'France', 'Ireland', 'Norway', 'Sweden', 'Brazil', 'India', 'China', 'Other',
];
