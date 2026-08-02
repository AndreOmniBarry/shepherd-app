// Shared currency list + formatting — every African nation's currency plus
// the major global currencies a diaspora branch might report in. A single
// source of truth so the settings dropdown, onboarding wizard, and every
// portal's money formatting stay in sync instead of each hardcoding ₦.

export type CurrencyDef = { code: string; symbol: string; label: string };

export const CURRENCIES: CurrencyDef[] = [
  // West Africa
  { code: 'NGN', symbol: '₦', label: '₦ Nigerian Naira' },
  { code: 'GHS', symbol: 'GH₵', label: 'GH₵ Ghanaian Cedi' },
  { code: 'XOF', symbol: 'CFA', label: 'CFA West African Franc (Senegal, Côte d\'Ivoire, etc.)' },
  { code: 'SLL', symbol: 'Le', label: 'Le Sierra Leonean Leone' },
  { code: 'LRD', symbol: 'L$', label: 'L$ Liberian Dollar' },
  { code: 'GMD', symbol: 'D', label: 'D Gambian Dalasi' },
  { code: 'GNF', symbol: 'FG', label: 'FG Guinean Franc' },
  { code: 'CVE', symbol: 'Esc', label: 'Esc Cape Verdean Escudo' },
  // East Africa
  { code: 'KES', symbol: 'KSh', label: 'KSh Kenyan Shilling' },
  { code: 'UGX', symbol: 'USh', label: 'USh Ugandan Shilling' },
  { code: 'TZS', symbol: 'TSh', label: 'TSh Tanzanian Shilling' },
  { code: 'RWF', symbol: 'RF', label: 'RF Rwandan Franc' },
  { code: 'BIF', symbol: 'FBu', label: 'FBu Burundian Franc' },
  { code: 'ETB', symbol: 'Br', label: 'Br Ethiopian Birr' },
  { code: 'SOS', symbol: 'Sh', label: 'Sh Somali Shilling' },
  { code: 'SSP', symbol: 'SSP', label: 'SSP South Sudanese Pound' },
  { code: 'DJF', symbol: 'Fdj', label: 'Fdj Djiboutian Franc' },
  { code: 'ERN', symbol: 'Nfk', label: 'Nfk Eritrean Nakfa' },
  { code: 'MGA', symbol: 'Ar', label: 'Ar Malagasy Ariary' },
  { code: 'MUR', symbol: 'Rs', label: 'Rs Mauritian Rupee' },
  { code: 'SCR', symbol: 'SR', label: 'SR Seychellois Rupee' },
  { code: 'KMF', symbol: 'CF', label: 'CF Comorian Franc' },
  // Southern Africa
  { code: 'ZAR', symbol: 'R', label: 'R South African Rand' },
  { code: 'ZMW', symbol: 'ZK', label: 'ZK Zambian Kwacha' },
  { code: 'MWK', symbol: 'MK', label: 'MK Malawian Kwacha' },
  { code: 'BWP', symbol: 'P', label: 'P Botswana Pula' },
  { code: 'MZN', symbol: 'MT', label: 'MT Mozambican Metical' },
  { code: 'NAD', symbol: 'N$', label: 'N$ Namibian Dollar' },
  { code: 'LSL', symbol: 'L', label: 'L Lesotho Loti' },
  { code: 'SZL', symbol: 'E', label: 'E Eswatini Lilangeni' },
  { code: 'ZWL', symbol: 'Z$', label: 'Z$ Zimbabwean Dollar' },
  // Central Africa
  { code: 'XAF', symbol: 'FCFA', label: 'FCFA Central African Franc (Cameroon, Gabon, etc.)' },
  { code: 'CDF', symbol: 'FC', label: 'FC Congolese Franc' },
  { code: 'AOA', symbol: 'Kz', label: 'Kz Angolan Kwanza' },
  { code: 'STN', symbol: 'Db', label: 'Db São Tomé & Príncipe Dobra' },
  // North Africa
  { code: 'EGP', symbol: 'E£', label: 'E£ Egyptian Pound' },
  { code: 'MAD', symbol: 'DH', label: 'DH Moroccan Dirham' },
  { code: 'DZD', symbol: 'DA', label: 'DA Algerian Dinar' },
  { code: 'TND', symbol: 'DT', label: 'DT Tunisian Dinar' },
  { code: 'LYD', symbol: 'LD', label: 'LD Libyan Dinar' },
  { code: 'SDG', symbol: 'SDG', label: 'SDG Sudanese Pound' },
  { code: 'MRU', symbol: 'UM', label: 'UM Mauritanian Ouguiya' },
  // Global
  { code: 'USD', symbol: '$', label: '$ US Dollar' },
  { code: 'GBP', symbol: '£', label: '£ British Pound' },
  { code: 'EUR', symbol: '€', label: '€ Euro' },
  { code: 'CAD', symbol: 'C$', label: 'C$ Canadian Dollar' },
  { code: 'AUD', symbol: 'A$', label: 'A$ Australian Dollar' },
  { code: 'INR', symbol: '₹', label: '₹ Indian Rupee' },
  { code: 'AED', symbol: 'AED', label: 'AED UAE Dirham' },
  { code: 'NOK', symbol: 'kr', label: 'kr Norwegian Krone' },
  { code: 'SEK', symbol: 'kr', label: 'kr Swedish Krona' },
  { code: 'BRL', symbol: 'R$', label: 'R$ Brazilian Real' },
  { code: 'CNY', symbol: '¥', label: '¥ Chinese Yuan' },
];

const SYMBOL_BY_CODE: Record<string, string> = Object.fromEntries(CURRENCIES.map(c => [c.code, c.symbol]));

export function currencySymbol(code?: string | null): string {
  return (code && SYMBOL_BY_CODE[code]) || '₦';
}

// Matches the abbreviation style already in use across the app
// (₦1.2M, ₦850k, etc.) — just parameterized by the church's own symbol.
export function formatMoney(n: number, code?: string | null): string {
  const sym = currencySymbol(code);
  const abs = Math.abs(n);
  if (abs >= 1e9) return `${sym}${(n / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sym}${(n / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${sym}${(n / 1e3).toFixed(0)}k`;
  return `${sym}${Math.round(n).toLocaleString()}`;
}
