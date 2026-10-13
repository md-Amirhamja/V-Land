// Unit sizes are in square feet. Regional values vary by district – edit freely.
const SQFT_PER_SQM = 10.7639;

export const BASE = {
  bigha:   { bn: 'বিঘা',     en: 'Bigha',   sqft: 14400 },
  katha:   { bn: 'কাঠা',     en: 'Katha',   sqft: 720 },
  chhatak: { bn: 'ছটাক',     en: 'Chhatak', sqft: 45 },
  decimal: { bn: 'শতাংশ',    en: 'Decimal', sqft: 435.6 },
  kani:    { bn: 'কানি',     en: 'Kani',    sqft: 69696 },     // Chattogram (160 decimal)
  nkani:   { bn: 'কানি',     en: 'Kani',    sqft: 17424 },     // Noakhali  (40 decimal)
  ganda:   { bn: 'গণ্ডা',    en: 'Ganda',   sqft: 3484.8 },
  nganda:  { bn: 'গণ্ডা',    en: 'Ganda',   sqft: 871.2 },
  kora:    { bn: 'কড়া',     en: 'Kora',    sqft: 871.2 },
  kranti:  { bn: 'ক্রান্তি', en: 'Kranti',  sqft: 290.4 },
  kear:    { bn: 'কেয়ার',   en: 'Kear',    sqft: 5227.2 },     // Sylhet (12 decimal)
  acre:    { bn: 'একর',      en: 'Acre',    sqft: 43560 },
  sqft:    { bn: 'বর্গফুট',   en: 'sq ft',   sqft: 1 },
  sqm:     { bn: 'বর্গমিটার', en: 'sq m',    sqft: SQFT_PER_SQM ** -1 * 1 },
};
BASE.sqm.sqft = SQFT_PER_SQM;

export const REGIONS = {
  standard: { bn: 'সাধারণ',   en: 'Standard',   hint: { bn: 'শতাংশ, কাঠা, বিঘা', en: 'Decimal, Katha, Bigha' }, units: ['decimal', 'katha', 'bigha'] },
  dhaka:    { bn: 'ঢাকা',     en: 'Dhaka',      hint: { bn: 'কাঠা, ছটাক, বিঘা', en: 'Katha, Chhatak, Bigha' }, units: ['bigha', 'katha', 'chhatak'] },
  ctg:      { bn: 'চট্টগ্রাম', en: 'Chattogram', hint: { bn: 'কানি, গণ্ডা, কড়া, ক্রান্তি', en: 'Kani, Ganda, Kora, Kranti' }, units: ['kani', 'ganda', 'kora', 'kranti'] },
  sylhet:   { bn: 'সিলেট',    en: 'Sylhet',     hint: { bn: 'কেয়ার, শতাংশ', en: 'Kear, Decimal' }, units: ['kear', 'decimal'] },
  noakhali: { bn: 'নোয়াখালী', en: 'Noakhali',   hint: { bn: 'কানি (৪০ শতাংশ), গণ্ডা', en: 'Kani (40 decimal), Ganda' }, units: ['nkani', 'nganda', 'decimal'] },
};

const BN_DIGITS = '০১২৩৪৫৬৭৮৯';
export const digits = (s, lang) => (lang === 'bn' ? String(s).replace(/\d/g, (d) => BN_DIGITS[d]) : String(s));
export const num = (n, lang, dp = 2) =>
  digits(Number(n).toLocaleString('en-US', { maximumFractionDigits: dp, minimumFractionDigits: 0 }), lang);

export const sqmToUnit = (sqm, id) => (sqm * SQFT_PER_SQM) / BASE[id].sqft;

/** chip list for a region: its own units + decimal/acre/sqft/sqm */
export function chipsFor(region) {
  const own = REGIONS[region].units;
  return [...own, ...['decimal', 'acre', 'sqft', 'sqm'].filter((u) => !own.includes(u))];
}

/** "2 Bigha 5 Katha 3 Chhatak" style breakdown using the region's own units */
export function breakdown(sqm, region, lang) {
  let rest = sqm * SQFT_PER_SQM;
  const parts = [];
  const ids = REGIONS[region].units;
  ids.forEach((id, i) => {
    const size = BASE[id].sqft;
    const last = i === ids.length - 1;
    const v = last ? rest / size : Math.floor(rest / size + 1e-9);
    rest -= Math.floor(rest / size + 1e-9) * size;
    if (v > 0.005 || (last && !parts.length)) parts.push(`${num(v, lang, last ? 2 : 0)} ${BASE[id][lang]}`);
  });
  return parts.join(' ');
}
