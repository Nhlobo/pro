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
}

interface ExternalExpert {
  source_url: string;
  title: string;
  snippet: string;
  name?: string;
  profession?: string;
  province?: string;
  city?: string;
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

    const blockedHosts = ['facebook.com', 'twitter.com', 'x.com', 'instagram.com'];
    const results: ExternalExpert[] = rawResults
      .filter((r) => {
        const url = r.url || r.link || '';
        return url && !blockedHosts.some((h) => url.includes(h));
      })
      .map((r) => ({
        source_url: r.url || r.link,
        title: r.title || r.metadata?.title || 'Untitled',
        snippet: r.description || r.snippet || r.metadata?.description || '',
        province: province || undefined,
        city: city || undefined,
        profession: expertType,
      }));

    return json({ results, query });
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
