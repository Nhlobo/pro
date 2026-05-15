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
}

interface ExternalExpert {
  source_url: string;
  title: string;
  snippet: string;
  name?: string;
  profession?: string;
  province?: string;
  city?: string;
  trusted?: boolean;
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
    const limit = Math.min(Math.max(body.limit ?? 8, 1), 20);
    const trustedOnly = body.trustedOnly === true;

    if (!expertType) {
      return json({ error: 'expertType is required' }, 400);
    }

    const apiKey = Deno.env.get('FIRECRAWL_API_KEY');
    if (!apiKey) return json({ error: 'FIRECRAWL_API_KEY not configured' }, 500);

    const locationParts = [city, province, 'South Africa'].filter(Boolean).join(', ');
    const query = `${expertType} medico-legal expert ${locationParts} HPCSA RAF medical negligence`;

    const fcRes = await fetch('https://api.firecrawl.dev/v2/search', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query, limit, lang: 'en', country: 'za' }),
    });

    const fcData = await fcRes.json();
    if (!fcRes.ok) {
      return json({ error: fcData?.error || 'Firecrawl search failed', status: fcRes.status }, 502);
    }

    // Normalise Firecrawl v2 response (results may be under `web` or `data`)
    const rawResults: any[] =
      fcData?.data?.web ?? fcData?.web?.results ?? fcData?.data ?? fcData?.results ?? [];

    const blockedHosts = ['facebook.com', 'twitter.com', 'x.com', 'instagram.com', 'linkedin.com/feed', 'pinterest.com', 'tiktok.com'];

    // Trusted medico-legal / professional registries get a relevance boost
    const trustedHosts = [
      'hpcsa.co.za', 'hpcsaonline.co.za', 'samedical.org', 'sajbl.org.za',
      'mp.org.za', 'saoa.co.za', 'psyssa.com', 'sacssp.co.za',
      'medpages.co.za', 'doctors.co.za', 'medico-legal', 'raf.co.za',
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

    // Deduplicate: prefer highest-scoring result per host, and dedupe identical URLs
    const byHost = new Map<string, { item: ExternalExpert; score: number; locConfidence: number }>();
    const seenUrls = new Set<string>();

    rawResults.forEach((r: any, idx: number) => {
      r.__idx = idx;
      const url: string = r.url || r.link || '';
      if (!url) return;
      const normalizedUrl = url.split('#')[0].replace(/\/$/, '');
      if (seenUrls.has(normalizedUrl)) return;
      if (blockedHosts.some((h) => url.includes(h))) return;

      const title = r.title || r.metadata?.title || 'Untitled';
      const snippet = r.description || r.snippet || r.metadata?.description || '';
      const haystack = `${title} ${snippet}`;
      const detected = detectLocation(haystack);

      const score = scoreResult(r, url, title, snippet);
      const locConfidence =
        (cityLower && haystack.toLowerCase().includes(cityLower) ? 2 : 0) +
        (provinceLower && haystack.toLowerCase().includes(provinceLower) ? 1 : 0);

      const item: ExternalExpert = {
        source_url: normalizedUrl,
        title,
        snippet,
        province: detected.province ?? (province || undefined),
        city: detected.city ?? (city || undefined),
        profession: expertType,
      };

      seenUrls.add(normalizedUrl);
      const host = getHost(url);
      const existing = byHost.get(host);
      if (!existing || score > existing.score) {
        byHost.set(host, { item, score, locConfidence });
      }
    });

    const allRanked = Array.from(byHost.entries())
      .map(([host, v]) => ({ host, ...v }))
      .sort((a, b) => {
        if (b.locConfidence !== a.locConfidence) return b.locConfidence - a.locConfidence;
        return b.score - a.score;
      });

    const trustedRanked = allRanked.filter((x) => trustedHosts.some((h) => x.host.includes(h)));
    const chosen = trustedOnly ? trustedRanked : allRanked;
    const ranked = chosen.slice(0, limit).map((x) => x.item);

    return json({
      results: ranked,
      query,
      total: byHost.size,
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
