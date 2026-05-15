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
    const limit = Math.min(Math.max(body.limit ?? 40, 1), 100);
    const trustedOnly = body.trustedOnly === true;
    const includeRecomed = body.includeRecomed !== false;
    const includeMedpages = body.includeMedpages !== false;

    if (!expertType) {
      return json({ error: 'expertType is required' }, 400);
    }

    const apiKey = Deno.env.get('FIRECRAWL_API_KEY');
    if (!apiKey) return json({ error: 'FIRECRAWL_API_KEY not configured' }, 500);

    const locationParts = [city, province, 'South Africa'].filter(Boolean).join(', ');
    const baseQuery = `${expertType} medico-legal expert ${locationParts} HPCSA RAF medical negligence`;
    // Always include Recomed and Medpages as dedicated source queries so results
    // from those directories surface even when general search misses them.
    const recomedQuery = `site:recomed.co.za ${expertType} ${locationParts}`;
    const medpagesQuery = `site:medpages.co.za ${expertType} ${locationParts}`;

    const perQueryLimit = Math.min(limit, 50);
    const runFirecrawl = async (q: string) => {
      const r = await fetch('https://api.firecrawl.dev/v2/search', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q, limit: perQueryLimit, lang: 'en', country: 'za' }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        console.error('firecrawl query failed', q, r.status, d?.error);
        return [];
      }
      const arr: any[] = d?.data?.web ?? d?.web?.results ?? d?.data ?? d?.results ?? [];
      return arr;
    };

    const [generalResults, recomedResults, medpagesResults] = await Promise.all([
      runFirecrawl(baseQuery),
      runFirecrawl(recomedQuery),
      runFirecrawl(medpagesQuery),
    ]);

    // Combine, preserving Recomed/Medpages hits first so identity merging keeps them
    const rawResults: any[] = [...recomedResults, ...medpagesResults, ...generalResults];
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

    const expertWords = expertType.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
    const provinceLower = province.toLowerCase();
    const cityLower = city.toLowerCase();

    const scoreResult = (r: any, url: string, title: string, snippet: string): number => {
      const host = getHost(url);
      const haystack = `${title} ${snippet}`.toLowerCase();
      let score = 0;

      // Trusted source boost
      if (trustedHosts.some((h) => host.includes(h))) score += 40;

      // Profession relevance
      for (const w of expertWords) {
        if (haystack.includes(w)) score += 15;
      }
      if (haystack.includes('medico-legal') || haystack.includes('medico legal')) score += 20;
      if (haystack.includes('expert witness') || haystack.includes('medico-legal report')) score += 10;
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

    rawResults.forEach((r: any, idx: number) => {
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
          profession: expertType,
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

    const allRanked = Array.from(byIdentity.values())
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
      total: byIdentity.size,
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
