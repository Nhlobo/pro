// Find Attorneys External Search — uses Firecrawl to surface RAF / personal-injury
// attorneys from public South African legal directories.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface SearchBody {
  province?: string;
  city?: string;
  practiceArea?: string;
  attorneyRole?: string; // plaintiff | defense | general
  limit?: number;
  trustedOnly?: boolean;
  includeLssa?: boolean;
  includeFindAnAttorney?: boolean;
  includeGoogle?: boolean;
  name?: string;
  phone?: string;
  email?: string;
}

interface ExternalSource {
  url: string;
  host: string;
  title: string;
  trusted: boolean;
}

interface ExternalAttorney {
  source_url: string;
  title: string;
  snippet: string;
  name?: string;
  firm?: string;
  bar_number?: string;
  practice_area?: string;
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
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Unauthorized' }, 401);

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
    const practiceArea = (body.practiceArea ?? '').trim();
    const attorneyRole = (body.attorneyRole ?? '').trim().toLowerCase();
    const limit = Math.min(Math.max(body.limit ?? 40, 1), 100);
    const trustedOnly = body.trustedOnly === true;
    const includeLssa = body.includeLssa !== false;
    const includeFindAnAttorney = body.includeFindAnAttorney !== false;

    if (!practiceArea) return json({ error: 'practiceArea is required' }, 400);

    const apiKey = Deno.env.get('FIRECRAWL_API_KEY');
    if (!apiKey) return json({ error: 'FIRECRAWL_API_KEY not configured' }, 500);

    const locationParts = [city, province, 'South Africa'].filter(Boolean).join(', ');
    const roleHint =
      attorneyRole === 'plaintiff'
        ? 'plaintiff attorney'
        : attorneyRole === 'defense'
        ? 'defense attorney'
        : 'attorney';
    const baseQuery = `${practiceArea} ${roleHint} ${locationParts} Law Society RAF personal injury`;
    const lssaQuery = `site:lssa.org.za ${practiceArea} ${locationParts}`;
    const faaQuery = `site:findanattorney.co.za ${practiceArea} ${locationParts}`;

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
      return (d?.data?.web ?? d?.web?.results ?? d?.data ?? d?.results ?? []) as any[];
    };

    const [generalResults, lssaResults, faaResults] = await Promise.all([
      runFirecrawl(baseQuery),
      includeLssa ? runFirecrawl(lssaQuery) : Promise.resolve([] as any[]),
      includeFindAnAttorney ? runFirecrawl(faaQuery) : Promise.resolve([] as any[]),
    ]);

    const rawResults: any[] = [...lssaResults, ...faaResults, ...generalResults];
    const filteredRaw = rawResults.filter((r: any) => {
      const url: string = r.url || r.link || '';
      if (!includeLssa && url.includes('lssa.org.za')) return false;
      if (!includeFindAnAttorney && url.includes('findanattorney.co.za')) return false;
      return true;
    });

    const blockedHosts = ['facebook.com', 'twitter.com', 'x.com', 'instagram.com', 'linkedin.com/feed', 'pinterest.com', 'tiktok.com'];

    // Trusted SA legal registries / professional bodies
    const trustedHosts = [
      'lssa.org.za', 'lpc.org.za', 'gcbsa.co.za', 'sabar.co.za',
      'findanattorney.co.za', 'lawsociety.org.za', 'derebus.org.za',
      'judiciary.org.za', 'justice.gov.za', 'legalbrief.co.za',
      'golegal.co.za', 'attorneys.law.za',
    ];

    const getHost = (url: string): string => {
      try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; }
    };

    const areaWords = practiceArea.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
    const provinceLower = province.toLowerCase();
    const cityLower = city.toLowerCase();

    const scoreResult = (r: any, url: string, title: string, snippet: string): number => {
      const host = getHost(url);
      const haystack = `${title} ${snippet}`.toLowerCase();
      let score = 0;
      if (trustedHosts.some((h) => host.includes(h))) score += 40;
      for (const w of areaWords) if (haystack.includes(w)) score += 15;
      if (haystack.includes('attorney') || haystack.includes('attorneys')) score += 10;
      if (haystack.includes('law firm') || haystack.includes('inc') || haystack.includes('incorporated')) score += 6;
      if (haystack.includes('raf') || haystack.includes('road accident fund')) score += 8;
      if (haystack.includes('personal injury') || haystack.includes('medical negligence')) score += 8;
      if (haystack.includes('plaintiff') && attorneyRole === 'plaintiff') score += 10;
      if (haystack.includes('defen') && attorneyRole === 'defense') score += 10;

      let locScore = 0;
      if (cityLower && haystack.includes(cityLower)) locScore += 25;
      if (provinceLower && haystack.includes(provinceLower)) locScore += 18;
      if (haystack.includes('south africa') || host.endsWith('.co.za') || host.endsWith('.org.za')) locScore += 8;
      score += locScore;

      if (host.includes('reddit.com') || host.includes('quora.com')) score -= 20;
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

    // Bar / practice number patterns commonly seen on SA attorney profiles
    const BAR_RE = /\b(?:LPC|LSSA|GCB)\s?\d{3,7}\b/i;
    const extractBarNumber = (text: string): string | undefined => {
      const m = text.match(BAR_RE);
      return m ? m[0].replace(/\s+/g, '').toUpperCase() : undefined;
    };

    const SITE_SUFFIX_RE = /\s*[-–|·•]\s*(linkedin|lssa|findanattorney|legalbrief|find an attorney|profile.*|.*directory|.*law firm).*$/i;
    const extractName = (title: string): string | undefined => {
      let t = title.replace(SITE_SUFFIX_RE, '').trim();
      t = t.replace(/^(adv\.?|advocate|attorney|mr\.?|mrs\.?|ms\.?|dr\.?|prof\.?)\s+/i, '');
      const m = t.match(/^([A-Z][a-zA-Z'’\-]+(?:\s+[A-Z][a-zA-Z'’\-]+){1,3})/);
      const name = (m ? m[1] : t).trim();
      if (!name || name.length < 4 || name.split(/\s+/).length < 2) return undefined;
      return name;
    };

    const extractFirm = (title: string, snippet: string): string | undefined => {
      const re = /([A-Z][A-Za-z&'’\-]+(?:\s+[A-Z][A-Za-z&'’\-]+){0,4}\s+(?:Attorneys|Inc|Incorporated|Law Firm|& Associates|Partners))/;
      return (title.match(re)?.[1] ?? snippet.match(re)?.[1])?.trim();
    };

    const normalizeName = (name: string): string =>
      name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z\s]/g, '').replace(/\s+/g, ' ').trim();

    const EMAIL_RE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
    const extractEmails = (text: string): string[] => {
      const found = text.match(EMAIL_RE) ?? [];
      return Array.from(new Set(found
        .map((e) => e.toLowerCase())
        .filter((e) => !/\.(png|jpg|jpeg|gif|svg|webp)$/i.test(e))
        .filter((e) => !e.includes('example.com') && !e.includes('sentry.io'))));
    };

    const PHONE_RE = /(?:\+?27|\b0)[\s\-().]*\d[\s\-().]*\d(?:[\s\-().]*\d){7}/g;
    const extractPhones = (text: string): string[] => {
      const matches = text.match(PHONE_RE) ?? [];
      return Array.from(new Set(matches
        .map((p) => p.replace(/[^\d+]/g, ''))
        .filter((p) => {
          const digits = p.replace(/^\+/, '');
          return digits.length === 10 || digits.length === 11 || digits.length === 12;
        })
        .map((p) => {
          if (p.startsWith('+27')) return p;
          if (p.startsWith('27') && p.length === 11) return `+${p}`;
          if (p.startsWith('0') && p.length === 10) return `+27${p.slice(1)}`;
          return p;
        })));
    };

    type Bucket = {
      item: ExternalAttorney;
      score: number;
      locConfidence: number;
      sources: Map<string, ExternalSource>;
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
      const detected = detectLocation(haystack);
      const host = getHost(url);
      const isTrusted = trustedHosts.some((h) => host.includes(h));

      const barNumber = extractBarNumber(haystack);
      const name = extractName(title) ?? extractName(snippet);
      const firm = extractFirm(title, snippet);
      const emails = extractEmails(haystack);
      const phones = extractPhones(haystack);
      const identityKey =
        barNumber ??
        (name ? `name:${normalizeName(name)}` : firm ? `firm:${normalizeName(firm)}` : `url:${normalizedUrl}`);

      const score = scoreResult(r, url, title, snippet)
        + (barNumber ? 25 : 0) + (name ? 5 : 0) + (firm ? 4 : 0)
        + (emails.length ? 6 : 0) + (phones.length ? 4 : 0);
      const locConfidence =
        (cityLower && haystack.toLowerCase().includes(cityLower) ? 2 : 0) +
        (provinceLower && haystack.toLowerCase().includes(provinceLower) ? 1 : 0);

      const source: ExternalSource = { url: normalizedUrl, host, title, trusted: isTrusted };
      const websiteEntry = { url: (() => { try { const u = new URL(url); return `${u.protocol}//${u.host}`; } catch { return normalizedUrl; } })(), host };

      const mergeArr = (a: string[] = [], b: string[] = []) => Array.from(new Set([...(a || []), ...(b || [])]));
      const mergeWebsites = (a: { url: string; host: string }[] = [], b: { url: string; host: string }[] = []) => {
        const seen = new Set<string>();
        const out: { url: string; host: string }[] = [];
        for (const w of [...(a || []), ...(b || [])]) if (!seen.has(w.host)) { seen.add(w.host); out.push(w); }
        return out;
      };

      const existing = byIdentity.get(identityKey);
      if (existing) {
        existing.sources.set(normalizedUrl, source);
        const mergedEmails = mergeArr(existing.item.emails, emails);
        const mergedPhones = mergeArr(existing.item.phones, phones);
        const mergedWebsites = mergeWebsites(existing.item.websites, [websiteEntry]);
        if (score > existing.score) {
          existing.score = score;
          existing.locConfidence = Math.max(existing.locConfidence, locConfidence);
          existing.item = {
            ...existing.item,
            source_url: normalizedUrl,
            title,
            snippet,
            name: name ?? existing.item.name,
            firm: firm ?? existing.item.firm,
            bar_number: barNumber ?? existing.item.bar_number,
            province: detected.province ?? existing.item.province ?? (province || undefined),
            city: detected.city ?? existing.item.city ?? (city || undefined),
            trusted: existing.item.trusted || isTrusted,
            emails: mergedEmails,
            phones: mergedPhones,
            websites: mergedWebsites,
          };
        } else {
          if (!existing.item.name && name) existing.item.name = name;
          if (!existing.item.firm && firm) existing.item.firm = firm;
          if (!existing.item.bar_number && barNumber) existing.item.bar_number = barNumber;
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
          firm,
          bar_number: barNumber,
          province: detected.province ?? (province || undefined),
          city: detected.city ?? (city || undefined),
          practice_area: practiceArea,
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
        const item: ExternalAttorney = {
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
      query: baseQuery,
      total: byIdentity.size,
      trusted_total: trustedRanked.length,
      trusted_only: trustedOnly,
    });
  } catch (err: any) {
    console.error('find-attorneys-external error', err);
    return json({ error: err?.message || 'Unknown error' }, 500);
  }
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
