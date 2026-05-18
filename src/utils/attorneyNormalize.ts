// Shared normalization helpers used to deduplicate attorney records across
// internal directory entries and external (Firecrawl / Google) search results.

const NAME_HONORIFICS = /\b(adv|advocate|attorney|attorneys|mr|mrs|ms|miss|mx|dr|prof|hon|sir|madam|the)\b\.?/g;
const FIRM_SUFFIXES = /\b(inc|incorporated|llp|llc|cc|pty|pty\.?\s*ltd|ltd|limited|law\s*firm|law\s*office|law\s*offices|legal|legal\s*practitioners?|advocates?|attorneys?|associates?|partners?|& associates|& partners|& co|& sons|& son|chambers|consultants?|practice)\b\.?/g;

/** Lowercase, strip diacritics/apostrophes, drop honorifics and firm suffixes. */
export const normName = (s?: string): string =>
  (s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/['’`]/g, '')
    .replace(NAME_HONORIFICS, ' ')
    .replace(FIRM_SUFFIXES, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** Drop single-letter initials so "J P Smith" matches "John Peter Smith". */
export const nameKey = (s?: string): string => {
  const tokens = normName(s).split(' ').filter((t) => t.length > 1);
  return tokens.join(' ');
};

const GMAIL_HOSTS = new Set(['gmail.com', 'googlemail.com']);
/** Lowercase, strip `+tag`, normalize gmail dots, fold googlemail → gmail. */
export const normEmail = (s?: string): string => {
  const e = (s || '').toLowerCase().trim();
  const at = e.indexOf('@');
  if (at < 1) return '';
  let local = e.slice(0, at);
  let domain = e.slice(at + 1);
  const plus = local.indexOf('+');
  if (plus >= 0) local = local.slice(0, plus);
  if (GMAIL_HOSTS.has(domain)) { local = local.replace(/\./g, ''); domain = 'gmail.com'; }
  if (!local || !domain.includes('.')) return '';
  return `${local}@${domain}`;
};

/** Canonical ZA phone: last 9 subscriber digits (ignores +27 / 0027 / 0 prefixes). */
export const normPhone = (s?: string): string => {
  let d = (s || '').replace(/\D/g, '');
  if (!d) return '';
  if (d.startsWith('0027')) d = d.slice(2);
  if (d.startsWith('27')) d = d.slice(2);
  if (d.startsWith('0')) d = d.slice(1);
  return d.length >= 9 ? d.slice(-9) : (d.length >= 7 ? d : '');
};

export const canonUrl = (u?: string): string =>
  (u || '').split('#')[0].split('?')[0].replace(/\/$/, '').toLowerCase();

export const hostOf = (u?: string): string => {
  try { return new URL(u || '').hostname.replace(/^www\./, '').toLowerCase(); } catch { return ''; }
};
