// Find Experts External Search — uses Firecrawl to surface medico-legal experts
// from public South African directories.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface SearchBody {
  province?: string;
  city?: string;
  expertType?: string;
  // Raw search term sent by the quick-search box when the text couldn't be
  // resolved to one of the known professions — e.g. a surname, a niche
  // specialty, or an abbreviation. Lets external search still run a broad,
  // Google-style query instead of refusing.
  query?: string;
  limit?: number;
  trustedOnly?: boolean;
  includeRecomed?: boolean;
  includeMedpages?: boolean;
}

interface ExternalSource {
  url: string;
  host: string;
  title: string;
  trusted: boolean;
}

interface ExternalExpert {
  source_url: string;
  title: string;
  snippet: string;
  name?: string;
  registry_id?: string;
  profession?: string;
  province?: string;
  city?: string;
  trusted?: boolean;
  sources?: ExternalSource[];
  sources_count?: number;
  emails?: string[];
  phones?: string[];
  websites?: { url: string; host: string }[];
}

// --- Profession keyword map --------------------------------------------
// Canonical keyword groups for every medico-legal profession the "Find
// Experts" search supports. Two jobs:
//  1. A result only counts as "on topic" for the requested expertType if
//     one of its keywords appears (word-boundary matched) in the title/snippet.
//  2. A result that clearly matches a *different* profession's keywords —
//     and not the requested one — is a wrong-specialty hit and gets dropped,
//     e.g. searching "Urologist" must never surface a Neurologist.
// Keep this list in sync with MEDICO_LEGAL_PROFESSIONS in
// src/hooks/useExpertSearch.tsx if new professions are added there.
const PROFESSION_KEYWORDS: Record<string, string[]> = {
  'Orthopaedic Surgeon': ['orthopaedic', 'orthopedic', 'orthopaedics', 'orthopedics', 'orthopod'],
  'Neurosurgeon': ['neurosurgeon', 'neurosurgery', 'neurosurgical'],
  'Occupational Therapist': ['occupational therapist', 'occupational therapy'],
  'Clinical Psychologist': ['clinical psychologist', 'clinical psychology'],
  'Industrial Psychologist': ['industrial psychologist', 'industrial psychology', 'organisational psychologist', 'organizational psychologist'],
  'Psychiatrist': ['psychiatrist', 'psychiatry'],
  'Neurologist': ['neurologist', 'neurology', 'neurological'],
  'Plastic Surgeon': ['plastic surgeon', 'plastic surgery', 'reconstructive surgeon', 'reconstructive surgery'],
  'General Surgeon': ['general surgeon', 'general surgery'],
  'Speech Therapist': ['speech therapist', 'speech-language therapist', 'speech therapy', 'speech-language pathologist'],
  'Audiologist': ['audiologist', 'audiology'],
  'Physiotherapist': ['physiotherapist', 'physiotherapy', 'physical therapist'],
  'Educational Psychologist': ['educational psychologist', 'educational psychology'],
  'Actuary': ['actuary', 'actuarial', 'actuaries'],
  'Nursing Expert': ['nursing expert', 'registered nurse', 'nursing specialist', 'clinical nurse specialist'],
  'Emergency Medicine Specialist': ['emergency medicine', 'emergency physician', 'emergency medicine specialist'],
  'Radiologist': ['radiologist', 'radiology'],
  'Urologist': ['urologist', 'urology', 'urological'],
  'Gynaecologist': ['gynaecologist', 'gynecologist', 'obstetrician', 'gynaecology', 'gynecology', 'obstetrics'],
  'Paediatrician': ['paediatrician', 'pediatrician', 'paediatrics', 'pediatrics'],
  'Dentist': ['dentist', 'dental surgeon', 'dentistry'],
  'Maxillofacial Surgeon': ['maxillofacial surgeon', 'maxillofacial surgery', 'oral and maxillofacial'],
  'Ophthalmologist': ['ophthalmologist', 'ophthalmology'],
};

const escapeRegExp = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Word-boundary match so short profession names can't false-positive inside
// unrelated longer words (the bug this replaces: "urologist" is a plain
// substring of "neurologist", so a naive .includes() check would wrongly
// treat every neurologist result as a urologist match).
const containsKeyword = (haystack: string, phrase: string): boolean => {
  const re = new RegExp(`\\b${escapeRegExp(phrase.toLowerCase())}\\b`, 'i');
  return re.test(haystack);
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    // AuthN/AuthZ — must be a logged-in admin / employee / case manager
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return json({ error: 'Unauthorized' }, 401);
    }
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await userClient.auth.getUser();
    if (!userData?.user) return json({ error: 'Unauthorized' }, 401);

    const { data: hasRole } = await userClient.rpc('has_role', {
      _user_id: userData.user.id,
      _role: 'admin',
    });
    if (!hasRole) return json({ error: 'Forbidden' }, 403);

    const body = (await req.json().catch(() => ({}))) as SearchBody;
    const province = (body.province ?? '').trim();
    const city = (body.city ?? '').trim();
    const expertType = (body.expertType ?? '').trim();
    const freeQuery = (body.query ?? '').trim();
    const limit = Math.min(Math.max(body.limit ?? 40, 1), 100);
    const trustedOnly = body.trustedOnly === true;
    const includeRecomed = body.includeRecomed !== false;
    const includeMedpages = body.includeMedpages !== false;

    // A known profession OR free text is required — but unlike before, an
    // unrecognised specialty / surname / abbreviation no longer dead-ends
    // the search. `searchTerm` is what actually drives the Firecrawl
    // queries below; `expertType` (when set) additionally drives the
    // stricter profession-keyword scoring/gating further down.
    const searchTerm = expertType || freeQuery;
    if (!searchTerm) {
      return json({ error: 'expertType or query is required' }, 400);
    }
    // Only apply the strict "known profession" keyword gate/boost when the
    // term is actually one of our listed professions. A free-text term
    // (surname, niche specialty) isn't in PROFESSION_KEYWORDS, so gating on
    // it would incorrectly drop unrelated-looking-but-valid results.
    const isKnownProfession = Object.prototype.hasOwnProperty.call(PROFESSION_KEYWORDS, expertType);

    const apiKey = Deno.env.get('FIRECRAWL_API_KEY');
    if (!apiKey) return json({ error: 'FIRECRAWL_API_KEY not configured' }, 500);

    const locationParts = [city, province, 'South Africa'].filter(Boolean).join(', ');
    // "expert witness" is included directly in the query (not just scored
    // after the fact) so the search itself is biased toward medico-legal
    // expert witness listings rather than general medical directory noise.
    const baseQuery = `${searchTerm} medico-legal expert witness ${locationParts} HPCSA RAF medical negligence`;
    // A second, looser query without the legal-specific terms — this is
    // what makes the search behave more like a general (Google-style)
    // lookup: it catches specialist directory listings, practice pages,
    // and society member lists that never use the phrase "expert witness"
    // but are still exactly who a case manager is looking for.
    const broadQuery = `${searchTerm} ${locationParts} specialist directory`;
    // Always include Recomed and Medpages as dedicated source queries so results
    // from those directories surface even when general search misses them.
    // These two stay focused on profession + location only: they're general
    // medical directories rather than legal-focused ones, so requiring the
    // "expert witness" phrase here would zero out otherwise-good matches.
    const recomedQuery = `site:recomed.co.za ${searchTerm} ${locationParts}`;
    const medpagesQuery = `site:medpages.co.za ${searchTerm} ${locationParts}`;

    const perQueryLimit = Math.min(limit, 50);
    const runFirecrawl = async (q: string) => {
      const r = await fetch('https://api.firecrawl.dev/v2/search', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q, limit: perQueryLimit, lang: 'en', country: 'za', sources: ['web'] }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        console.error('firecrawl query failed', q, r.status, d?.error);
        return [];
      }
      const arr: any[] = d?.data?.web ?? d?.web?.results ?? d?.data ?? d?.results ?? [];
      return arr;
    };

    const [generalResults, broadResults, recomedResults, medpagesResults] = await Promise.all([
      runFirecrawl(baseQuery),
      runFirecrawl(broadQuery),
      includeRecomed ? runFirecrawl(recomedQuery) : Promise.resolve([] as any[]),
      includeMedpages ? runFirecrawl(medpagesQuery) : Promise.resolve([] as any[]),
    ]);

    // Combine, preserving Recomed/Medpages hits first so identity merging keeps them
    const rawResults: any[] = [...recomedResults, ...medpagesResults, ...generalResults, ...broadResults];
    // Host-level filter: when a directory toggle is OFF, drop incidental hits
    // that came in from the general query for that host.
    const filteredRaw = rawResults.filter((r: any) => {
      const url: string = r.url || r.link || '';
      if (!includeRecomed && url.includes('recomed.co.za')) return false;
      if (!includeMedpages && url.includes('medpages.co.za')) return false;
      return true;
    });
    const query = baseQuery;

    const blockedHosts = ['facebook.com', 'twitter.com', 'x.com', 'instagram.com', 'linkedin.com/feed', 'pinterest.com', 'tiktok.com'];

    // Trusted medico-legal / professional registries get a relevance boost
    const trustedHosts = [
      'hpcsa.co.za', 'hpcsaonline.co.za', 'samedical.org', 'sajbl.org.za',
      'mp.org.za', 'saoa.co.za', 'psyssa.com', 'sacssp.co.za',
      'medpages.co.za', 'recomed.co.za', 'doctors.co.za', 'medico-legal', 'raf.co.za',
      'saspweb.org', 'osasa.co.za', 'sasop.co.za',
    ];

    const getHost = (url: string): string => {
      try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; }
    };

    // Keyword group for the requested profession — falls back to the raw
    // search term (expertType, or the free-text query) for any custom/
    // unlisted value so the search still works, just without the extra
    // specificity guarantees.
    const requestedKeywords = PROFESSION_KEYWORDS[expertType] ?? [searchTerm.toLowerCase()];
    const matchesRequestedProfession = (text: string): boolean =>
      requestedKeywords.some((k) => containsKeyword(text, k));
    // True when the text is clearly about a *different* listed profession
    // and doesn't also mention the one that was asked for — this is what
    // keeps a search for "Urologist" from surfacing a Neurologist, or an
    // "Orthopaedic Surgeon" search from surfacing a generic "surgeon" hit.
    // Only meaningful when the request is actually one of our known
    // professions: a free-text term (a surname, an unlisted specialty) was
    // never matched against this keyword list in the first place, so
    // gating it here would drop good results for the wrong reason.
    const matchesConflictingProfession = (text: string): boolean => {
      if (!isKnownProfession) return false;
      if (matchesRequestedProfession(text)) return false;
      for (const [prof, keywords] of Object.entries(PROFESSION_KEYWORDS)) {
        if (prof === expertType) continue;
        if (keywords.some((k) => containsKeyword(text, k))) return true;
      }
      return false;
    };

    const provinceLower = province.toLowerCase();
    const cityLower = city.toLowerCase();

    const scoreResult = (r: any, url: string, title: string, snippet: string): number => {
      const host = getHost(url);
      const haystack = `${title} ${snippet}`.toLowerCase();
      let score = 0;

      // Trusted source boost
      if (trustedHosts.some((h) => host.includes(h))) score += 40;

      // Profession relevance — specific to the requested specialty rather
      // than generic words like "surgeon" or "therapist" that many
      // unrelated professions share.
      if (matchesRequestedProfession(haystack)) score += 35;
      if (haystack.includes('medico-legal') || haystack.includes('medico legal')) score += 20;
      // "Expert witness" is the strongest possible signal that this person
      // already works medico-legal cases, so it carries the biggest boost.
      if (haystack.includes('expert witness')) score += 30;
      if (haystack.includes('medico-legal report')) score += 10;
      if (haystack.includes('hpcsa')) score += 8;
      if (haystack.includes('raf') || haystack.includes('road accident fund')) score += 8;
      if (haystack.includes('negligence')) score += 6;

      // Location confidence
      let locScore = 0;
      if (cityLower && haystack.includes(cityLower)) locScore += 25;
      if (provinceLower && haystack.includes(provinceLower)) locScore += 18;
      if (haystack.includes('south africa') || host.endsWith('.co.za') || host.endsWith('.org.za')) locScore += 8;
      score += locScore;

      // Penalise generic aggregators / forums when stronger results exist
      if (host.includes('reddit.com') || host.includes('quora.com')) score -= 20;

      // Position in original results (slight)
      score += Math.max(0, 10 - (r.__idx ?? 0));

      return score;
    };

    const detectLocation = (text: string): { province?: string; city?: string } => {
      const t = text.toLowerCase();
      const provinces = ['Gauteng','Western Cape','KwaZulu-Natal','Eastern Cape','Free State','Limpopo','Mpumalanga','North West','Northern Cape'];
      const cities = ['Pretoria','Johannesburg','Sandton','Midrand','Centurion','Cape Town','Bellville','Stellenbosch','Durban','Pietermaritzburg','Umhlanga','Gqeberha','Port Elizabeth','East London','Bloemfontein','Polokwane','Nelspruit','Mahikeng','Rustenburg','Kimberley'];
      return {
        province: provinces.find((p) => t.includes(p.toLowerCase())),
        city: cities.find((c) => t.includes(c.toLowerCase())),
      };
    };

    // --- Identity extractors ---------------------------------------------
    // HPCSA registration numbers in SA take prefixes like MP/DP/PS/OT/PT/SP/AU/OP/PR/MT/DT
    // followed by 6-7 digits. Practice numbers are usually 7 digits prefixed with PR.
    const REGISTRY_RE = /\b(?:MP|DP|PS|OT|PT|SP|AU|OP|PR|MT|DT)\s?\d{4,7}\b/i;
    const extractRegistryId = (text: string): string | undefined => {
      const m = text.match(REGISTRY_RE);
      return m ? m[0].replace(/\s+/g, '').toUpperCase() : undefined;
    };

    // Pull a likely person name out of the title: drop site suffixes,
    // titles (Dr/Prof), and trailing punctuation.
    const SITE_SUFFIX_RE = /\s*[-–|·•]\s*(linkedin|hpcsa|medpages|doctors\.co\.za|find a.+|profile.*|.*directory).*$/i;
    const extractName = (title: string): string | undefined => {
      let t = title.replace(SITE_SUFFIX_RE, '').trim();
      t = t.replace(/^(dr\.?|prof\.?|professor|mr\.?|mrs\.?|ms\.?)\s+/i, '');
      // Capture first 2-4 capitalised tokens that look like a name
      const m = t.match(/^([A-Z][a-zA-Z'’\-]+(?:\s+[A-Z][a-zA-Z'’\-]+){1,3})/);
      const name = (m ? m[1] : t).trim();
      if (!name || name.length < 4 || name.split(/\s+/).length < 2) return undefined;
      return name;
    };

    const normalizeName = (name: string): string =>
      name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z\s]/g, '').replace(/\s+/g, ' ').trim();

    // Email & phone extractors
    const EMAIL_RE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
    const extractEmails = (text: string): string[] => {
      const found = text.match(EMAIL_RE) ?? [];
      const cleaned = found
        .map((e) => e.toLowerCase())
        .filter((e) => !/\.(png|jpg|jpeg|gif|svg|webp)$/i.test(e))
        .filter((e) => !e.includes('example.com') && !e.includes('sentry.io'));
      return Array.from(new Set(cleaned));
    };

    // SA phone numbers: +27 or 0 followed by 9 digits (allowing spaces, dashes, parens)
    const PHONE_RE = /(?:\+?27|\b0)[\s\-().]*\d[\s\-().]*\d(?:[\s\-().]*\d){7}/g;
    const extractPhones = (text: string): string[] => {
      const matches = text.match(PHONE_RE) ?? [];
      const cleaned = matches
        .map((p) => p.replace(/[^\d+]/g, ''))
        .filter((p) => {
          const digits = p.replace(/^\+/, '');
          return digits.length === 10 || digits.length === 11 || digits.length === 12;
        })
        .map((p) => {
          // Normalize to +27 format
          if (p.startsWith('+27')) return p;
          if (p.startsWith('27') && p.length === 11) return `+${p}`;
          if (p.startsWith('0') && p.length === 10) return `+27${p.slice(1)}`;
          return p;
        });
      return Array.from(new Set(cleaned));
    };


    // --- Merge into identity buckets -------------------------------------
    type Bucket = {
      item: ExternalExpert;
      score: number;
      locConfidence: number;
      sources: Map<string, ExternalSource>; // keyed by normalized URL
    };
    const byIdentity = new Map<string, Bucket>();
    const seenUrls = new Set<string>();

    filteredRaw.forEach((r: any, idx: number) => {
      r.__idx = idx;
      const url: string = r.url || r.link || '';
      if (!url) return;
      const normalizedUrl = url.split('#')[0].replace(/\/$/, '');
      if (seenUrls.has(normalizedUrl)) return;
      if (blockedHosts.some((h) => url.includes(h))) return;
      seenUrls.add(normalizedUrl);

      const title = r.title || r.metadata?.title || 'Untitled';
      const snippet = r.description || r.snippet || r.metadata?.description || '';
      const haystack = `${title} ${snippet}`;

      // Specificity gate: this result is clearly about a different
      // profession (e.g. a Neurologist showing up in a Urologist search) —
      // drop it outright rather than merely down-ranking it, so every
      // profession + location search stays limited to that practicing field.
      if (matchesConflictingProfession(haystack)) return;

      const detected = detectLocation(haystack);
      const host = getHost(url);
      const isTrusted = trustedHosts.some((h) => host.includes(h));

      const registryId = extractRegistryId(haystack);
      const name = extractName(title) ?? extractName(snippet);
      const emails = extractEmails(haystack);
      const phones = extractPhones(haystack);
      const identityKey =
        registryId ??
        (name ? `name:${normalizeName(name)}` : `url:${normalizedUrl}`);

      const score = scoreResult(r, url, title, snippet)
        + (registryId ? 25 : 0)
        + (name ? 5 : 0)
        + (emails.length ? 6 : 0)
        + (phones.length ? 4 : 0);
      const locConfidence =
        (cityLower && haystack.toLowerCase().includes(cityLower) ? 2 : 0) +
        (provinceLower && haystack.toLowerCase().includes(provinceLower) ? 1 : 0);

      const source: ExternalSource = { url: normalizedUrl, host, title, trusted: isTrusted };
      const websiteEntry = { url: `${(() => { try { const u = new URL(url); return `${u.protocol}//${u.host}`; } catch { return normalizedUrl; } })()}`, host };

      const mergeArr = (a: string[] = [], b: string[] = []) =>
        Array.from(new Set([...(a || []), ...(b || [])]));
      const mergeWebsites = (a: { url: string; host: string }[] = [], b: { url: string; host: string }[] = []) => {
        const seen = new Set<string>();
        const out: { url: string; host: string }[] = [];
        for (const w of [...(a || []), ...(b || [])]) {
          if (!seen.has(w.host)) { seen.add(w.host); out.push(w); }
        }
        return out;
      };

      const existing = byIdentity.get(identityKey);
      if (existing) {
        existing.sources.set(normalizedUrl, source);
        const mergedEmails = mergeArr(existing.item.emails, emails);
        const mergedPhones = mergeArr(existing.item.phones, phones);
        const mergedWebsites = mergeWebsites(existing.item.websites, [websiteEntry]);
        // Promote to higher-quality representative if this hit is stronger
        if (score > existing.score) {
          existing.score = score;
          existing.locConfidence = Math.max(existing.locConfidence, locConfidence);
          existing.item = {
            ...existing.item,
            source_url: normalizedUrl,
            title,
            snippet,
            name: name ?? existing.item.name,
            registry_id: registryId ?? existing.item.registry_id,
            province: detected.province ?? existing.item.province ?? (province || undefined),
            city: detected.city ?? existing.item.city ?? (city || undefined),
            trusted: existing.item.trusted || isTrusted,
            emails: mergedEmails,
            phones: mergedPhones,
            websites: mergedWebsites,
          };
        } else {
          // Still enrich missing identity fields from this weaker hit
          if (!existing.item.name && name) existing.item.name = name;
          if (!existing.item.registry_id && registryId) existing.item.registry_id = registryId;
          if (isTrusted) existing.item.trusted = true;
          existing.item.emails = mergedEmails;
          existing.item.phones = mergedPhones;
          existing.item.websites = mergedWebsites;
        }
        return;
      }

      byIdentity.set(identityKey, {
        item: {
          source_url: normalizedUrl,
          title,
          snippet,
          name,
          registry_id: registryId,
          province: detected.province ?? (province || undefined),
          city: detected.city ?? (city || undefined),
          profession: expertType || undefined,
          trusted: isTrusted,
          emails,
          phones,
          websites: [websiteEntry],
        },
        score,
        locConfidence,
        sources: new Map([[normalizedUrl, source]]),
      });
    });

    // --- Cross-bucket merge -----------------------------------------------
    // The first pass keys identity on (registryId | name | url) which can
    // split the same expert across buckets when different hits surface
    // different signals. Union-find any buckets that share a normalized
    // signal: registry_id, normalized name, any email, any phone, or
    // canonical website (host + first path segment).
    const buckets = Array.from(byIdentity.values());
    const parent = buckets.map((_, i) => i);
    const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
    const union = (a: number, b: number) => {
      const ra = find(a); const rb = find(b);
      if (ra !== rb) parent[ra] = rb;
    };

    const canonSite = (u: string): string => {
      try {
        const url = new URL(u);
        const host = url.hostname.replace(/^www\./, '').toLowerCase();
        const seg = url.pathname.split('/').filter(Boolean)[0] || '';
        return seg ? `${host}/${seg.toLowerCase()}` : host;
      } catch { return u.toLowerCase(); }
    };

    const sigIndex = new Map<string, number>();
    const addSig = (sig: string, i: number) => {
      if (!sig) return;
      const prev = sigIndex.get(sig);
      if (prev === undefined) sigIndex.set(sig, i);
      else union(prev, i);
    };

    buckets.forEach((b, i) => {
      if (b.item.registry_id) addSig(`reg:${b.item.registry_id.toUpperCase()}`, i);
      if (b.item.name) addSig(`name:${normalizeName(b.item.name)}`, i);
      (b.item.emails || []).forEach((e) => addSig(`email:${e.toLowerCase().trim()}`, i));
      (b.item.phones || []).forEach((p) => addSig(`phone:${p.replace(/\D/g, '').slice(-9)}`, i));
      for (const src of b.sources.values()) addSig(`site:${canonSite(src.url)}`, i);
    });

    const groups = new Map<number, number[]>();
    buckets.forEach((_, i) => {
      const r = find(i);
      if (!groups.has(r)) groups.set(r, []);
      groups.get(r)!.push(i);
    });

    const mergedBuckets: Bucket[] = [];
    for (const idxs of groups.values()) {
      if (idxs.length === 1) { mergedBuckets.push(buckets[idxs[0]]); continue; }
      // Pick highest-scoring bucket as representative, then fold the rest in.
      const sorted = idxs.map((i) => buckets[i]).sort((a, b) => b.score - a.score);
      const rep = sorted[0];
      for (let k = 1; k < sorted.length; k++) {
        const other = sorted[k];
        for (const [u, s] of other.sources) if (!rep.sources.has(u)) rep.sources.set(u, s);
        rep.item.emails = Array.from(new Set([...(rep.item.emails || []), ...(other.item.emails || [])]));
        rep.item.phones = Array.from(new Set([...(rep.item.phones || []), ...(other.item.phones || [])]));
        const seenHost = new Set((rep.item.websites || []).map((w) => w.host));
        for (const w of other.item.websites || []) if (!seenHost.has(w.host)) { seenHost.add(w.host); (rep.item.websites ||= []).push(w); }
        if (!rep.item.name && other.item.name) rep.item.name = other.item.name;
        if (!rep.item.registry_id && other.item.registry_id) rep.item.registry_id = other.item.registry_id;
        if (!rep.item.province && other.item.province) rep.item.province = other.item.province;
        if (!rep.item.city && other.item.city) rep.item.city = other.item.city;
        if (other.item.trusted) rep.item.trusted = true;
        rep.locConfidence = Math.max(rep.locConfidence, other.locConfidence);
        rep.score += Math.round(other.score * 0.2);
      }
      mergedBuckets.push(rep);
    }

    const allRanked = mergedBuckets
      .map((b) => {
        const sources = Array.from(b.sources.values());
        const item: ExternalExpert = {
          ...b.item,
          sources,
          sources_count: sources.length,
          trusted: b.item.trusted || sources.some((s) => s.trusted),
        };
        return { item, score: b.score + (sources.length - 1) * 4, locConfidence: b.locConfidence };
      })
      .sort((a, b) => {
        if (b.locConfidence !== a.locConfidence) return b.locConfidence - a.locConfidence;
        return b.score - a.score;
      });

    const trustedRanked = allRanked.filter((x) => x.item.trusted);
    const chosen = trustedOnly ? trustedRanked : allRanked;
    const ranked = chosen.slice(0, limit).map((x) => x.item);

    return json({
      results: ranked,
      query,
      total: mergedBuckets.length,
      trusted_total: trustedRanked.length,
      trusted_only: trustedOnly,
    });
  } catch (err: any) {
    console.error('find-experts-external error', err);
    return json({ error: err?.message || 'Unknown error' }, 500);
  }
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
