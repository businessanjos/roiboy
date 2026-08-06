import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { extractText, getDocumentProxy } from 'npm:unpdf@0.12.1';

const DEFAULT_SOURCE_URL = 'https://drive.google.com/file/d/1ElUYqvydwXi1z2kgFJKkAVyjaiZ4wf2-/view';
const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

type Club = {
  name: string;
  tier: string | null;
  mentors: string[];
  audience: string | null;
  positioning: string | null;
  competitor_type: string | null;
};

const TIER_MAP: Record<string, string> = {
  platinum: 'platinum', platina: 'platinum',
  gold: 'gold', ouro: 'gold',
  silver: 'silver', prata: 'silver',
  bronze: 'bronze',
};

function driveDownloadUrl(url: string): string {
  const m = url.match(/\/d\/([A-Za-z0-9_-]+)/) || url.match(/[?&]id=([A-Za-z0-9_-]+)/);
  if (!m) return url;
  return `https://drive.google.com/uc?export=download&id=${m[1]}`;
}

async function fetchPdfText(url: string): Promise<string> {
  let res = await fetch(driveDownloadUrl(url), { redirect: 'follow' });
  let buf = new Uint8Array(await res.arrayBuffer());
  const head = new TextDecoder().decode(buf.slice(0, 200));
  if (!head.startsWith('%PDF')) {
    // Google Drive interstitial page — try the confirm endpoint
    const html = new TextDecoder().decode(buf);
    const idMatch = url.match(/\/d\/([A-Za-z0-9_-]+)/) || url.match(/[?&]id=([A-Za-z0-9_-]+)/);
    const confirm = html.match(/confirm=([0-9A-Za-z_-]+)/)?.[1] ?? 't';
    if (!idMatch) throw new Error('Não foi possível resolver o arquivo do Google Drive');
    res = await fetch(
      `https://drive.usercontent.google.com/download?id=${idMatch[1]}&export=download&confirm=${confirm}`,
      { redirect: 'follow' },
    );
    buf = new Uint8Array(await res.arrayBuffer());
    const head2 = new TextDecoder().decode(buf.slice(0, 200));
    if (!head2.startsWith('%PDF')) {
      throw new Error('O link não retornou um PDF público. Confirme que o compartilhamento está como "qualquer pessoa com o link".');
    }
  }
  const pdf = await getDocumentProxy(buf);
  const { text } = await extractText(pdf, { mergePages: true });
  return String(text || '');
}

async function screenChunk(chunk: string): Promise<Club[]> {
  const res = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages: [
        {
          role: 'system',
          content:
            'Você analisa o Members Book da MLS (rede de clubes de mentoria). Extraia SOMENTE clubes/mentorias que se posicionam para MÉDICOS, ÁREA DA ESTÉTICA ou DENTISTAS. Responda apenas JSON.',
        },
        {
          role: 'user',
          content:
            `Trecho do documento:\n\n${chunk}\n\nRetorne JSON no formato {"clubs":[{"name":"","tier":"platinum|gold|silver|bronze|null","mentors":[""],"audience":"medicos|estetica|odontologia|saude_geral","positioning":"","competitor_type":"direto|indireto|transversal"}]}. Não invente nomes: use exatamente o nome do clube como aparece no documento.`,
        },
      ],
      response_format: { type: 'json_object' },
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`[${res.status}] ${body}`);
  }
  const json = await res.json();
  const raw = json?.choices?.[0]?.message?.content ?? '{}';
  const parsed = JSON.parse(raw);
  const clubs: Club[] = Array.isArray(parsed?.clubs) ? parsed.clubs : [];
  return clubs
    .filter((c) => c?.name && String(c.name).trim().length > 1)
    .map((c) => ({
      name: String(c.name).trim(),
      tier: c.tier ? (TIER_MAP[String(c.tier).toLowerCase()] ?? null) : null,
      mentors: Array.isArray(c.mentors) ? c.mentors.map((m) => String(m).trim()).filter(Boolean) : [],
      audience: c.audience ? String(c.audience) : null,
      positioning: c.positioning ? String(c.positioning) : null,
      competitor_type: c.competitor_type ?? 'direto',
    }));
}

const norm = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
  let runId: string | null = null;
  let accountId: string | null = null;

  try {
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY não configurada');
    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
    const scheduled = body?.scheduled === true;

    // ----- resolve accounts to process -----
    type Job = { account_id: string; source_url: string; config_id: string | null; interval_days: number };
    const jobs: Job[] = [];

    if (scheduled) {
      const { data: configs } = await admin
        .from('mi_competitor_sync_config')
        .select('*')
        .eq('auto_enabled', true)
        .lte('next_run_at', new Date().toISOString());
      for (const c of configs ?? []) {
        jobs.push({ account_id: c.account_id, source_url: c.source_url, config_id: c.id, interval_days: c.interval_days });
      }
      if (jobs.length === 0) {
        return new Response(JSON.stringify({ ok: true, skipped: true, message: 'Nenhuma conta vencida' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    } else {
      const authHeader = req.headers.get('Authorization') ?? '';
      const userClient = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: auth } = await userClient.auth.getUser();
      if (!auth?.user) throw new Error('Não autenticado');
      const { data: profile } = await admin
        .from('users')
        .select('account_id')
        .eq('auth_user_id', auth.user.id)
        .maybeSingle();
      if (!profile?.account_id) throw new Error('Usuário sem conta');
      const { data: cfg } = await admin
        .from('mi_competitor_sync_config')
        .select('*')
        .eq('account_id', profile.account_id)
        .maybeSingle();
      jobs.push({
        account_id: profile.account_id,
        source_url: body?.sourceUrl || cfg?.source_url || DEFAULT_SOURCE_URL,
        config_id: cfg?.id ?? null,
        interval_days: cfg?.interval_days ?? 30,
      });
    }

    const results: unknown[] = [];

    for (const job of jobs) {
      accountId = job.account_id;
      const { data: run } = await admin
        .from('mi_competitor_sync_runs')
        .insert({
          account_id: job.account_id,
          source_url: job.source_url,
          status: 'running',
          trigger_source: scheduled ? 'cron' : 'manual',
        })
        .select('id')
        .single();
      runId = run?.id ?? null;

      const text = await fetchPdfText(job.source_url);
      if (text.trim().length < 200) throw new Error('Não foi possível extrair texto do PDF');

      const CHUNK = 24000;
      const chunks: string[] = [];
      for (let i = 0; i < text.length; i += CHUNK) chunks.push(text.slice(i, i + CHUNK));

      const found = new Map<string, Club>();
      for (const chunk of chunks.slice(0, 12)) {
        const clubs = await screenChunk(chunk);
        for (const c of clubs) {
          const key = norm(c.name);
          const prev = found.get(key);
          if (!prev) found.set(key, c);
          else found.set(key, { ...prev, ...c, mentors: Array.from(new Set([...prev.mentors, ...c.mentors])) });
        }
      }

      const { data: existing } = await admin
        .from('mi_competitors')
        .select('id, name, tier, mentors, positioning, audience, verification_status')
        .eq('account_id', job.account_id);

      const byName = new Map((existing ?? []).map((e) => [norm(e.name), e]));
      const changes: any[] = [];
      let newCount = 0;
      let tierChanged = 0;
      const nowIso = new Date().toISOString();

      for (const [key, club] of found) {
        const match = byName.get(key);
        if (!match) {
          const { error } = await admin.from('mi_competitors').insert({
            account_id: job.account_id,
            name: club.name,
            tier: club.tier,
            mentors: club.mentors,
            audience: club.audience,
            positioning: club.positioning,
            competitor_type: club.competitor_type ?? 'direto',
            source: 'members_book_mls',
            source_url: job.source_url,
            last_seen_at: nowIso,
            verification_status: 'nao_verificado',
          });
          if (!error) {
            newCount++;
            changes.push({ type: 'novo', name: club.name, tier: club.tier });
          }
        } else if (match.verification_status === 'removido') {
          // Curadoria humana descartou este clube — não reintroduzir nem sobrescrever.
          changes.push({ type: 'ignorado_descartado', name: match.name });
        } else {
          const curated = match.verification_status === 'verificado';
          const patch: Record<string, unknown> = { last_seen_at: nowIso, source_url: job.source_url };
          if (!curated && club.tier && club.tier !== match.tier) {
            patch.tier = club.tier;
            tierChanged++;
            changes.push({ type: 'tier', name: match.name, from: match.tier, to: club.tier });
          }
          if (!curated && club.mentors.length && (match.mentors ?? []).length === 0) patch.mentors = club.mentors;
          if (!curated && club.positioning && !match.positioning) patch.positioning = club.positioning;
          await admin.from('mi_competitors').update(patch).eq('id', match.id);
        }
      }


      const missing = (existing ?? []).filter(
        (e) => !found.has(norm(e.name)),
      );
      for (const m of missing) changes.push({ type: 'ausente', name: m.name, tier: m.tier });

      await admin
        .from('mi_competitor_sync_runs')
        .update({
          status: 'success',
          finished_at: nowIso,
          clubs_found: found.size,
          new_count: newCount,
          tier_changed_count: tierChanged,
          missing_count: missing.length,
          changes,
        })
        .eq('id', runId!);

      const next = new Date(Date.now() + job.interval_days * 24 * 60 * 60 * 1000).toISOString();
      if (job.config_id) {
        await admin
          .from('mi_competitor_sync_config')
          .update({ last_run_at: nowIso, next_run_at: next })
          .eq('id', job.config_id);
      } else {
        await admin.from('mi_competitor_sync_config').insert({
          account_id: job.account_id,
          source_url: job.source_url,
          last_run_at: nowIso,
          next_run_at: next,
        });
      }

      results.push({
        account_id: job.account_id,
        clubs_found: found.size,
        new_count: newCount,
        tier_changed_count: tierChanged,
        missing_count: missing.length,
        changes,
      });
      runId = null;
    }

    return new Response(JSON.stringify({ ok: true, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error('mi-competitors-refresh failed:', message);
    if (runId) {
      await admin
        .from('mi_competitor_sync_runs')
        .update({ status: 'error', error: message, finished_at: new Date().toISOString() })
        .eq('id', runId);
    }
    return new Response(JSON.stringify({ error: message, account_id: accountId }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
