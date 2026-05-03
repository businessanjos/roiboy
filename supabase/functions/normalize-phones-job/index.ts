// Job de normalização de phone_e164 para o formato canônico +55DDD9XXXXXXXX.
// Percorre clients e zapp_conversations, recalcula via canonicalE164, e atualiza
// apenas quando o novo valor difere do atual E não há colisão com outro registro
// (para evitar violar unique constraints / criar duplicatas silenciosas).
//
// Uso:
//   POST /functions/v1/normalize-phones-job
//   body opcional: { "dryRun": true, "tables": ["clients","zapp_conversations"], "limit": 5000 }
//
// Pode ser chamado manualmente ou via pg_cron.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { canonicalE164 } from "../_shared/phone-normalize.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface TableReport {
  table: string;
  scanned: number;
  changed: number;
  collisions: number;
  unparseable: number;
  errors: number;
  samples: Array<{ id: string; from: string | null; to: string }>;
}

const SUPPORTED = ["clients", "zapp_conversations"] as const;
type Supported = typeof SUPPORTED[number];

async function processTable(
  supabase: ReturnType<typeof createClient>,
  table: Supported,
  dryRun: boolean,
  limit: number,
): Promise<TableReport> {
  const report: TableReport = {
    table,
    scanned: 0,
    changed: 0,
    collisions: 0,
    unparseable: 0,
    errors: 0,
    samples: [],
  };

  const pageSize = 1000;
  let offset = 0;
  while (report.scanned < limit) {
    const { data, error } = await supabase
      .from(table)
      .select("id, phone_e164")
      .not("phone_e164", "is", null)
      .order("id", { ascending: true })
      .range(offset, offset + pageSize - 1);

    if (error) {
      report.errors++;
      break;
    }
    if (!data || data.length === 0) break;

    for (const row of data) {
      report.scanned++;
      const current = (row as any).phone_e164 as string | null;
      const next = canonicalE164(current);
      if (!next) {
        report.unparseable++;
        continue;
      }
      if (next === current) continue;

      // Checa colisão com outro registro
      const { data: collide, error: cErr } = await supabase
        .from(table)
        .select("id")
        .eq("phone_e164", next)
        .neq("id", (row as any).id)
        .limit(1);

      if (cErr) {
        report.errors++;
        continue;
      }
      if (collide && collide.length > 0) {
        report.collisions++;
        continue;
      }

      if (report.samples.length < 20) {
        report.samples.push({ id: (row as any).id, from: current, to: next });
      }

      if (!dryRun) {
        const { error: uErr } = await supabase
          .from(table)
          .update({ phone_e164: next })
          .eq("id", (row as any).id);
        if (uErr) {
          report.errors++;
          continue;
        }
      }
      report.changed++;
    }

    if (data.length < pageSize) break;
    offset += pageSize;
  }

  return report;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    let body: any = {};
    try {
      body = await req.json();
    } catch (_) {
      body = {};
    }

    const dryRun = Boolean(body?.dryRun);
    const limit = Math.max(1, Math.min(Number(body?.limit) || 50000, 200000));
    const requested: string[] = Array.isArray(body?.tables)
      ? body.tables
      : [...SUPPORTED];
    const tables = requested.filter((t): t is Supported =>
      (SUPPORTED as readonly string[]).includes(t)
    );

    const reports: TableReport[] = [];
    for (const t of tables) {
      reports.push(await processTable(supabase, t, dryRun, limit));
    }

    return new Response(
      JSON.stringify({
        ok: true,
        dryRun,
        reports,
        totals: {
          scanned: reports.reduce((a, r) => a + r.scanned, 0),
          changed: reports.reduce((a, r) => a + r.changed, 0),
          collisions: reports.reduce((a, r) => a + r.collisions, 0),
          unparseable: reports.reduce((a, r) => a + r.unparseable, 0),
          errors: reports.reduce((a, r) => a + r.errors, 0),
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ ok: false, error: String((e as Error).message || e) }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
