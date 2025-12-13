/**
 * Tax Rate Intelligence Service
 *
 * Automatic tax rate detection and validation based on:
 * - Country/region
 * - Tax type (VAT, sales tax, GST, etc.)
 * - Business category
 * - Date (handles rate changes over time)
 */

// ==============================================
// TAX RATE DATABASE
// ==============================================

export type TaxType =
  | "vat"
  | "sales_tax"
  | "gst"
  | "hst"
  | "pst"
  | "pdv"
  | "iva"
  | "tva"
  | "mwst"
  | "other";

export interface TaxRateInfo {
  country: string;
  countryCode: string;
  taxType: TaxType;
  standardRate: number;
  reducedRates: number[];
  superReducedRate?: number;
  zeroRated: boolean;
  taxName: string;
  currency: string;
  validFrom?: string;
  validTo?: string;
  notes?: string;
}

export interface TaxDetectionResult {
  detected: boolean;
  country?: string;
  countryCode?: string;
  taxType?: TaxType;
  suggestedRate?: number;
  allRates?: number[];
  confidence: number;
  taxName?: string;
  currency?: string;
}

// Comprehensive tax rate database
const TAX_RATES: Record<string, TaxRateInfo> = {
  // European Union
  AT: {
    country: "Austria",
    countryCode: "AT",
    taxType: "vat",
    standardRate: 20,
    reducedRates: [10, 13],
    zeroRated: true,
    taxName: "USt (Umsatzsteuer)",
    currency: "EUR",
  },
  BE: {
    country: "Belgium",
    countryCode: "BE",
    taxType: "vat",
    standardRate: 21,
    reducedRates: [6, 12],
    zeroRated: true,
    taxName: "BTW/TVA",
    currency: "EUR",
  },
  BG: {
    country: "Bulgaria",
    countryCode: "BG",
    taxType: "vat",
    standardRate: 20,
    reducedRates: [9],
    zeroRated: true,
    taxName: "DDS",
    currency: "BGN",
  },
  HR: {
    country: "Croatia",
    countryCode: "HR",
    taxType: "vat",
    standardRate: 25,
    reducedRates: [5, 13],
    zeroRated: true,
    taxName: "PDV",
    currency: "EUR",
  },
  CY: {
    country: "Cyprus",
    countryCode: "CY",
    taxType: "vat",
    standardRate: 19,
    reducedRates: [5, 9],
    zeroRated: true,
    taxName: "FPA",
    currency: "EUR",
  },
  CZ: {
    country: "Czech Republic",
    countryCode: "CZ",
    taxType: "vat",
    standardRate: 21,
    reducedRates: [12, 15],
    zeroRated: true,
    taxName: "DPH",
    currency: "CZK",
  },
  DK: {
    country: "Denmark",
    countryCode: "DK",
    taxType: "vat",
    standardRate: 25,
    reducedRates: [],
    zeroRated: true,
    taxName: "Moms",
    currency: "DKK",
  },
  EE: {
    country: "Estonia",
    countryCode: "EE",
    taxType: "vat",
    standardRate: 22,
    reducedRates: [9],
    zeroRated: true,
    taxName: "Käibemaks",
    currency: "EUR",
  },
  FI: {
    country: "Finland",
    countryCode: "FI",
    taxType: "vat",
    standardRate: 24,
    reducedRates: [10, 14],
    zeroRated: true,
    taxName: "ALV",
    currency: "EUR",
  },
  FR: {
    country: "France",
    countryCode: "FR",
    taxType: "vat",
    standardRate: 20,
    reducedRates: [5.5, 10],
    superReducedRate: 2.1,
    zeroRated: true,
    taxName: "TVA",
    currency: "EUR",
  },
  DE: {
    country: "Germany",
    countryCode: "DE",
    taxType: "vat",
    standardRate: 19,
    reducedRates: [7],
    zeroRated: true,
    taxName: "MwSt (Mehrwertsteuer)",
    currency: "EUR",
  },
  GR: {
    country: "Greece",
    countryCode: "GR",
    taxType: "vat",
    standardRate: 24,
    reducedRates: [6, 13],
    zeroRated: true,
    taxName: "FPA",
    currency: "EUR",
  },
  HU: {
    country: "Hungary",
    countryCode: "HU",
    taxType: "vat",
    standardRate: 27,
    reducedRates: [5, 18],
    zeroRated: true,
    taxName: "ÁFA",
    currency: "HUF",
  },
  IE: {
    country: "Ireland",
    countryCode: "IE",
    taxType: "vat",
    standardRate: 23,
    reducedRates: [9, 13.5],
    superReducedRate: 4.8,
    zeroRated: true,
    taxName: "VAT",
    currency: "EUR",
  },
  IT: {
    country: "Italy",
    countryCode: "IT",
    taxType: "vat",
    standardRate: 22,
    reducedRates: [5, 10],
    superReducedRate: 4,
    zeroRated: true,
    taxName: "IVA",
    currency: "EUR",
  },
  LV: {
    country: "Latvia",
    countryCode: "LV",
    taxType: "vat",
    standardRate: 21,
    reducedRates: [5, 12],
    zeroRated: true,
    taxName: "PVN",
    currency: "EUR",
  },
  LT: {
    country: "Lithuania",
    countryCode: "LT",
    taxType: "vat",
    standardRate: 21,
    reducedRates: [5, 9],
    zeroRated: true,
    taxName: "PVM",
    currency: "EUR",
  },
  LU: {
    country: "Luxembourg",
    countryCode: "LU",
    taxType: "vat",
    standardRate: 17,
    reducedRates: [8, 14],
    superReducedRate: 3,
    zeroRated: true,
    taxName: "TVA",
    currency: "EUR",
  },
  MT: {
    country: "Malta",
    countryCode: "MT",
    taxType: "vat",
    standardRate: 18,
    reducedRates: [5, 7],
    zeroRated: true,
    taxName: "VAT",
    currency: "EUR",
  },
  NL: {
    country: "Netherlands",
    countryCode: "NL",
    taxType: "vat",
    standardRate: 21,
    reducedRates: [9],
    zeroRated: true,
    taxName: "BTW",
    currency: "EUR",
  },
  PL: {
    country: "Poland",
    countryCode: "PL",
    taxType: "vat",
    standardRate: 23,
    reducedRates: [5, 8],
    zeroRated: true,
    taxName: "VAT",
    currency: "PLN",
  },
  PT: {
    country: "Portugal",
    countryCode: "PT",
    taxType: "vat",
    standardRate: 23,
    reducedRates: [6, 13],
    zeroRated: true,
    taxName: "IVA",
    currency: "EUR",
  },
  RO: {
    country: "Romania",
    countryCode: "RO",
    taxType: "vat",
    standardRate: 19,
    reducedRates: [5, 9],
    zeroRated: true,
    taxName: "TVA",
    currency: "RON",
  },
  SK: {
    country: "Slovakia",
    countryCode: "SK",
    taxType: "vat",
    standardRate: 20,
    reducedRates: [10],
    zeroRated: true,
    taxName: "DPH",
    currency: "EUR",
  },
  SI: {
    country: "Slovenia",
    countryCode: "SI",
    taxType: "vat",
    standardRate: 22,
    reducedRates: [5, 9.5],
    zeroRated: true,
    taxName: "DDV",
    currency: "EUR",
  },
  ES: {
    country: "Spain",
    countryCode: "ES",
    taxType: "vat",
    standardRate: 21,
    reducedRates: [10],
    superReducedRate: 4,
    zeroRated: true,
    taxName: "IVA",
    currency: "EUR",
  },
  SE: {
    country: "Sweden",
    countryCode: "SE",
    taxType: "vat",
    standardRate: 25,
    reducedRates: [6, 12],
    zeroRated: true,
    taxName: "Moms",
    currency: "SEK",
  },

  // Non-EU Europe
  GB: {
    country: "United Kingdom",
    countryCode: "GB",
    taxType: "vat",
    standardRate: 20,
    reducedRates: [5],
    zeroRated: true,
    taxName: "VAT",
    currency: "GBP",
  },
  CH: {
    country: "Switzerland",
    countryCode: "CH",
    taxType: "vat",
    standardRate: 8.1,
    reducedRates: [2.6, 3.8],
    zeroRated: true,
    taxName: "MwSt/TVA/IVA",
    currency: "CHF",
  },
  NO: {
    country: "Norway",
    countryCode: "NO",
    taxType: "vat",
    standardRate: 25,
    reducedRates: [12, 15],
    zeroRated: true,
    taxName: "MVA",
    currency: "NOK",
  },

  // Balkans
  RS: {
    country: "Serbia",
    countryCode: "RS",
    taxType: "pdv",
    standardRate: 20,
    reducedRates: [10],
    zeroRated: true,
    taxName: "PDV (Porez na dodatu vrednost)",
    currency: "RSD",
  },
  BA: {
    country: "Bosnia and Herzegovina",
    countryCode: "BA",
    taxType: "pdv",
    standardRate: 17,
    reducedRates: [],
    zeroRated: false,
    taxName: "PDV",
    currency: "BAM",
  },
  ME: {
    country: "Montenegro",
    countryCode: "ME",
    taxType: "pdv",
    standardRate: 21,
    reducedRates: [7],
    zeroRated: true,
    taxName: "PDV",
    currency: "EUR",
  },
  MK: {
    country: "North Macedonia",
    countryCode: "MK",
    taxType: "vat",
    standardRate: 18,
    reducedRates: [5],
    zeroRated: true,
    taxName: "DDV",
    currency: "MKD",
  },
  AL: {
    country: "Albania",
    countryCode: "AL",
    taxType: "vat",
    standardRate: 20,
    reducedRates: [6],
    zeroRated: true,
    taxName: "TVSH",
    currency: "ALL",
  },

  // Americas
  US: {
    country: "United States",
    countryCode: "US",
    taxType: "sales_tax",
    standardRate: 0, // Varies by state
    reducedRates: [],
    zeroRated: false,
    taxName: "Sales Tax",
    currency: "USD",
    notes: "Tax rates vary by state (0% to ~10%)",
  },
  CA: {
    country: "Canada",
    countryCode: "CA",
    taxType: "gst",
    standardRate: 5, // GST, HST varies by province
    reducedRates: [],
    zeroRated: true,
    taxName: "GST/HST",
    currency: "CAD",
    notes: "5% GST federal + provincial taxes vary (0-10%)",
  },
  BR: {
    country: "Brazil",
    countryCode: "BR",
    taxType: "other",
    standardRate: 17, // Average ICMS
    reducedRates: [12, 7],
    zeroRated: false,
    taxName: "ICMS/IPI/ISS",
    currency: "BRL",
    notes: "Complex multi-tier system",
  },

  // Asia-Pacific
  AU: {
    country: "Australia",
    countryCode: "AU",
    taxType: "gst",
    standardRate: 10,
    reducedRates: [],
    zeroRated: true,
    taxName: "GST",
    currency: "AUD",
  },
  NZ: {
    country: "New Zealand",
    countryCode: "NZ",
    taxType: "gst",
    standardRate: 15,
    reducedRates: [],
    zeroRated: true,
    taxName: "GST",
    currency: "NZD",
  },
  JP: {
    country: "Japan",
    countryCode: "JP",
    taxType: "vat",
    standardRate: 10,
    reducedRates: [8],
    zeroRated: false,
    taxName: "Consumption Tax",
    currency: "JPY",
  },
  SG: {
    country: "Singapore",
    countryCode: "SG",
    taxType: "gst",
    standardRate: 9,
    reducedRates: [],
    zeroRated: true,
    taxName: "GST",
    currency: "SGD",
  },
  IN: {
    country: "India",
    countryCode: "IN",
    taxType: "gst",
    standardRate: 18,
    reducedRates: [5, 12],
    zeroRated: true,
    taxName: "GST",
    currency: "INR",
    notes: "4-tier system: 5%, 12%, 18%, 28%",
  },
  CN: {
    country: "China",
    countryCode: "CN",
    taxType: "vat",
    standardRate: 13,
    reducedRates: [6, 9],
    zeroRated: true,
    taxName: "VAT",
    currency: "CNY",
  },

  // Middle East
  AE: {
    country: "United Arab Emirates",
    countryCode: "AE",
    taxType: "vat",
    standardRate: 5,
    reducedRates: [],
    zeroRated: true,
    taxName: "VAT",
    currency: "AED",
  },
  SA: {
    country: "Saudi Arabia",
    countryCode: "SA",
    taxType: "vat",
    standardRate: 15,
    reducedRates: [],
    zeroRated: true,
    taxName: "VAT",
    currency: "SAR",
  },
};

// US State sales tax rates
const US_STATE_TAX_RATES: Record<string, { state: string; rate: number }> = {
  CA: { state: "California", rate: 7.25 },
  TX: { state: "Texas", rate: 6.25 },
  FL: { state: "Florida", rate: 6 },
  NY: { state: "New York", rate: 4 },
  PA: { state: "Pennsylvania", rate: 6 },
  IL: { state: "Illinois", rate: 6.25 },
  OH: { state: "Ohio", rate: 5.75 },
  GA: { state: "Georgia", rate: 4 },
  NC: { state: "North Carolina", rate: 4.75 },
  MI: { state: "Michigan", rate: 6 },
  NJ: { state: "New Jersey", rate: 6.625 },
  VA: { state: "Virginia", rate: 5.3 },
  WA: { state: "Washington", rate: 6.5 },
  AZ: { state: "Arizona", rate: 5.6 },
  MA: { state: "Massachusetts", rate: 6.25 },
  TN: { state: "Tennessee", rate: 7 },
  IN: { state: "Indiana", rate: 7 },
  MO: { state: "Missouri", rate: 4.225 },
  MD: { state: "Maryland", rate: 6 },
  WI: { state: "Wisconsin", rate: 5 },
  CO: { state: "Colorado", rate: 2.9 },
  MN: { state: "Minnesota", rate: 6.875 },
  SC: { state: "South Carolina", rate: 6 },
  AL: { state: "Alabama", rate: 4 },
  LA: { state: "Louisiana", rate: 4.45 },
  KY: { state: "Kentucky", rate: 6 },
  OR: { state: "Oregon", rate: 0 },
  OK: { state: "Oklahoma", rate: 4.5 },
  CT: { state: "Connecticut", rate: 6.35 },
  UT: { state: "Utah", rate: 6.1 },
  NV: { state: "Nevada", rate: 6.85 },
  AR: { state: "Arkansas", rate: 6.5 },
  MS: { state: "Mississippi", rate: 7 },
  KS: { state: "Kansas", rate: 6.5 },
  NM: { state: "New Mexico", rate: 5.125 },
  NE: { state: "Nebraska", rate: 5.5 },
  ID: { state: "Idaho", rate: 6 },
  WV: { state: "West Virginia", rate: 6 },
  HI: { state: "Hawaii", rate: 4 },
  NH: { state: "New Hampshire", rate: 0 },
  ME: { state: "Maine", rate: 5.5 },
  MT: { state: "Montana", rate: 0 },
  RI: { state: "Rhode Island", rate: 7 },
  DE: { state: "Delaware", rate: 0 },
  SD: { state: "South Dakota", rate: 4.5 },
  ND: { state: "North Dakota", rate: 5 },
  AK: { state: "Alaska", rate: 0 },
  VT: { state: "Vermont", rate: 6 },
  WY: { state: "Wyoming", rate: 4 },
  DC: { state: "District of Columbia", rate: 6 },
};

// Tax name variations for detection
const TAX_NAME_PATTERNS: Record<string, TaxType> = {
  vat: "vat",
  "value added tax": "vat",
  pdv: "pdv",
  "porez na dodatu vrednost": "pdv",
  iva: "iva",
  "impuesto sobre el valor añadido": "iva",
  tva: "tva",
  "taxe sur la valeur ajoutée": "tva",
  mwst: "mwst",
  mehrwertsteuer: "mwst",
  ust: "mwst",
  umsatzsteuer: "mwst",
  gst: "gst",
  "goods and services tax": "gst",
  hst: "hst",
  "harmonized sales tax": "hst",
  "sales tax": "sales_tax",
  btw: "vat",
  afa: "vat",
  dph: "vat",
  ddv: "vat",
  pvm: "vat",
  pvn: "vat",
  moms: "vat",
  alv: "vat",
};

// ==============================================
// PUBLIC FUNCTIONS
// ==============================================

/**
 * Get tax rate information for a country
 */
export function getTaxRateByCountry(countryCode: string): TaxRateInfo | null {
  const normalized = countryCode.toUpperCase();
  return TAX_RATES[normalized] || null;
}

/**
 * Get all available country tax rates
 */
export function getAllTaxRates(): TaxRateInfo[] {
  return Object.values(TAX_RATES);
}

/**
 * Get US state tax rate
 */
export function getUSStateTaxRate(stateCode: string): { state: string; rate: number } | null {
  const normalized = stateCode.toUpperCase();
  return US_STATE_TAX_RATES[normalized] || null;
}

/**
 * Detect tax type from text
 */
export function detectTaxType(text: string): TaxType | null {
  const lowerText = text.toLowerCase();

  for (const [pattern, taxType] of Object.entries(TAX_NAME_PATTERNS)) {
    if (lowerText.includes(pattern)) {
      return taxType;
    }
  }

  return null;
}

/**
 * Detect country from text (VAT number, currency, text)
 */
export function detectCountryFromText(text: string): string | null {
  const upperText = text.toUpperCase();

  // VAT number patterns by country
  const vatPatterns: Record<string, RegExp> = {
    AT: /ATU\d{8}/,
    BE: /BE0?\d{9,10}/,
    BG: /BG\d{9,10}/,
    HR: /HR\d{11}/,
    CY: /CY\d{8}[A-Z]/,
    CZ: /CZ\d{8,10}/,
    DK: /DK\d{8}/,
    EE: /EE\d{9}/,
    FI: /FI\d{8}/,
    FR: /FR[A-Z0-9]{2}\d{9}/,
    DE: /DE\d{9}/,
    GR: /EL\d{9}/,
    HU: /HU\d{8}/,
    IE: /IE\d{7}[A-Z]{1,2}/,
    IT: /IT\d{11}/,
    LV: /LV\d{11}/,
    LT: /LT\d{9,12}/,
    LU: /LU\d{8}/,
    MT: /MT\d{8}/,
    NL: /NL\d{9}B\d{2}/,
    PL: /PL\d{10}/,
    PT: /PT\d{9}/,
    RO: /RO\d{2,10}/,
    SK: /SK\d{10}/,
    SI: /SI\d{8}/,
    ES: /ES[A-Z0-9]\d{7}[A-Z0-9]/,
    SE: /SE\d{12}/,
    GB: /GB\d{9,12}/,
    RS: /RS\d{9}/,
  };

  for (const [country, pattern] of Object.entries(vatPatterns)) {
    if (pattern.test(upperText)) {
      return country;
    }
  }

  // Currency detection
  const currencyToCountry: Record<string, string> = {
    RSD: "RS",
    EUR: "DE", // Default to Germany for EUR
    GBP: "GB",
    CHF: "CH",
    SEK: "SE",
    NOK: "NO",
    DKK: "DK",
    PLN: "PL",
    CZK: "CZ",
    HUF: "HU",
    RON: "RO",
    BGN: "BG",
    USD: "US",
    CAD: "CA",
    AUD: "AU",
    NZD: "NZ",
    JPY: "JP",
    CNY: "CN",
    INR: "IN",
    SGD: "SG",
    AED: "AE",
    SAR: "SA",
  };

  for (const [currency, country] of Object.entries(currencyToCountry)) {
    if (upperText.includes(currency)) {
      return country;
    }
  }

  return null;
}

/**
 * Validate if a tax rate is valid for a country
 */
export function validateTaxRate(
  countryCode: string,
  rate: number,
  tolerance: number = 0.5
): { valid: boolean; suggestedRate?: number; message?: string } {
  const taxInfo = getTaxRateByCountry(countryCode);

  if (!taxInfo) {
    return { valid: false, message: `Unknown country: ${countryCode}` };
  }

  const allRates = [
    taxInfo.standardRate,
    ...taxInfo.reducedRates,
    ...(taxInfo.superReducedRate ? [taxInfo.superReducedRate] : []),
    ...(taxInfo.zeroRated ? [0] : []),
  ];

  // Check if rate matches any valid rate within tolerance
  for (const validRate of allRates) {
    if (Math.abs(rate - validRate) <= tolerance) {
      return { valid: true };
    }
  }

  return {
    valid: false,
    suggestedRate: taxInfo.standardRate,
    message: `Rate ${rate}% not valid for ${taxInfo.country}. Valid rates: ${allRates.join("%, ")}%`,
  };
}

/**
 * Detect tax rate from invoice/document text
 */
export function detectTaxFromDocument(
  text: string,
  amount?: number,
  taxAmount?: number
): TaxDetectionResult {
  const result: TaxDetectionResult = {
    detected: false,
    confidence: 0,
  };

  // Try to detect country
  const detectedCountry = detectCountryFromText(text);
  if (detectedCountry) {
    result.countryCode = detectedCountry;
    result.confidence += 0.3;
  }

  // Try to detect tax type
  const detectedTaxType = detectTaxType(text);
  if (detectedTaxType) {
    result.taxType = detectedTaxType;
    result.confidence += 0.2;
  }

  // If we have country, get tax info
  if (detectedCountry) {
    const taxInfo = getTaxRateByCountry(detectedCountry);
    if (taxInfo) {
      result.detected = true;
      result.country = taxInfo.country;
      result.taxName = taxInfo.taxName;
      result.currency = taxInfo.currency;
      result.suggestedRate = taxInfo.standardRate;
      result.allRates = [
        taxInfo.standardRate,
        ...taxInfo.reducedRates,
        ...(taxInfo.superReducedRate ? [taxInfo.superReducedRate] : []),
      ];
      result.confidence += 0.3;
    }
  }

  // If we have amount and tax amount, calculate rate
  if (amount && taxAmount && amount > 0) {
    const calculatedRate = (taxAmount / (amount - taxAmount)) * 100;
    const roundedRate = Math.round(calculatedRate * 10) / 10;

    // If calculated rate matches a known rate, increase confidence
    if (result.allRates?.some((r) => Math.abs(r - roundedRate) < 0.5)) {
      result.suggestedRate = roundedRate;
      result.confidence += 0.2;
    }
  }

  // Normalize confidence to 0-1
  result.confidence = Math.min(result.confidence, 1);

  return result;
}

/**
 * Calculate tax amount from total and rate
 */
export function calculateTaxFromTotal(
  totalAmount: number,
  taxRate: number
): { netAmount: number; taxAmount: number } {
  const netAmount = totalAmount / (1 + taxRate / 100);
  const taxAmount = totalAmount - netAmount;

  return {
    netAmount: Math.round(netAmount * 100) / 100,
    taxAmount: Math.round(taxAmount * 100) / 100,
  };
}

/**
 * Calculate total from net amount and tax rate
 */
export function calculateTotalFromNet(
  netAmount: number,
  taxRate: number
): { totalAmount: number; taxAmount: number } {
  const taxAmount = netAmount * (taxRate / 100);
  const totalAmount = netAmount + taxAmount;

  return {
    totalAmount: Math.round(totalAmount * 100) / 100,
    taxAmount: Math.round(taxAmount * 100) / 100,
  };
}

/**
 * Get EU VAT rates summary
 */
export function getEUVATRates(): TaxRateInfo[] {
  const euCountries = [
    "AT",
    "BE",
    "BG",
    "HR",
    "CY",
    "CZ",
    "DK",
    "EE",
    "FI",
    "FR",
    "DE",
    "GR",
    "HU",
    "IE",
    "IT",
    "LV",
    "LT",
    "LU",
    "MT",
    "NL",
    "PL",
    "PT",
    "RO",
    "SK",
    "SI",
    "ES",
    "SE",
  ];

  return euCountries
    .map((code) => TAX_RATES[code])
    .filter(Boolean)
    .sort((a, b) => b.standardRate - a.standardRate);
}

/**
 * Search countries by name or code
 */
export function searchCountries(query: string): TaxRateInfo[] {
  const lowerQuery = query.toLowerCase();

  return Object.values(TAX_RATES).filter(
    (rate) =>
      rate.country.toLowerCase().includes(lowerQuery) ||
      rate.countryCode.toLowerCase().includes(lowerQuery) ||
      rate.taxName.toLowerCase().includes(lowerQuery)
  );
}

export default {
  getTaxRateByCountry,
  getAllTaxRates,
  getUSStateTaxRate,
  detectTaxType,
  detectCountryFromText,
  validateTaxRate,
  detectTaxFromDocument,
  calculateTaxFromTotal,
  calculateTotalFromNet,
  getEUVATRates,
  searchCountries,
};
