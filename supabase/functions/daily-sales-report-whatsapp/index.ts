import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TZ_OFFSET_MINUTES = -180; // America/Sao_Paulo (UTC-3)
const DEFAULT_TO = "5511976461705";

function brDayRange(date = new Date()) {
  // Início/fim do dia local (BRT) convertidos para UTC
  const local = new Date(date.getTime() + TZ_OFFSET_MINUTES * 60_000);
  const y = local.getUTCFullYear();
  const m = local.getUTCMonth();
  const d = local.getUTCDate();
  const startUtc = new Date(Date.UTC(y, m, d, 0, 0, 0) - TZ_OFFSET_MINUTES * 60_000);
  const endUtc = new Date(startUtc.getTime() + 24 * 60 * 60_000);
  const monthStartUtc = new Date(Date.UTC(y, m, 1, 0, 0, 0) - TZ_OFFSET_MINUTES * 60_000);
  const label = `${String(d).padStart(2, "0")}/${String(m + 1).padStart(2, "0")}/${y}`;
  return { startUtc, endUtc, monthStartUtc, label, y, m, d };
}

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

function pct(part: number, total: number) {
  if (!total) return "0%";
  return `${((part / total) * 100).toFixed(1).replace(".", ",")}%`;
}

function normalizePhone(raw: string) {
  const digits = (raw || "").replace(/\D/g, "");
  if (!digits) return "";
  return digits.startsWith("55") ? digits : `55${digits}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const dryRun = body?.dryRun === true;
    const to = normalizePhone(body?.to || DEFAULT_TO);

    const { startUtc, endUtc, monthStartUtc, label } = brDayRange();
    const startIso = startUtc.toISOString();
    const endIso = endUtc.toISOString();
    const monthIso = monthStartUtc.toISOString();

    const [{ data: leadsToday }, { data: dealsToday }, { data: wonToday }, { data: lostToday }, { data: wonMonth }, { data: openDeals }, { data: users }] =
      await Promise.all([
        supabase.from("leads").select("id, source, canal, mql").gte("created_at", startIso).lt("created_at", endIso),
        supabase.from("deals").select("id").is("deleted_at", null).gte("created_at", startIso).lt("created_at", endIso),
        supabase.from("deals").select("id, title, value, responsible_user_id, sdr_user_id").is("deleted_at", null).eq("status", "won").gte("won_at", startIso).lt("won_at", endIso),
        supabase.from("deals").select("id, lost_reason, responsible_user_id").is("deleted_at", null).eq("status", "lost").gte("lost_at", startIso).lt("lost_at", endIso),
        supabase.from("deals").select("id, value, responsible_user_id").is("deleted_at", null).eq("status", "won").gte("won_at", monthIso).lt("won_at", endIso),
        supabase.from("deals").select("id, value").is("deleted_at", null).eq("status", "open"),
        supabase.from("users").select("id, name"),
      ]);

    const nameById = new Map((users || []).map((u: any) => [u.id, (u.name || "").split(" ")[0] || "—"]));

    const leads = leadsToday || [];
    const mqlToday = leads.filter((l: any) => {
      const v = String(l.mql ?? "").toLowerCase();
      return v.startsWith("sim") || v === "opt_1" || v === "true";
    }).length;

    const won = wonToday || [];
    const wonValue = won.reduce((s: number, d: any) => s + Number(d.value || 0), 0);
    const lost = lostToday || [];
    const monthWon = wonMonth || [];
    const monthValue = monthWon.reduce((s: number, d: any) => s + Number(d.value || 0), 0);
    const pipelineValue = (openDeals || []).reduce((s: number, d: any) => s + Number(d.value || 0), 0);

    // Ranking do mês por vendedor
    const byRep = new Map<string, { qtd: number; valor: number }>();
    for (const d of monthWon as any[]) {
      const key = nameById.get(d.responsible_user_id) || "Sem responsável";
      const cur = byRep.get(key) || { qtd: 0, valor: 0 };
      cur.qtd += 1;
      cur.valor += Number(d.value || 0);
      byRep.set(key, cur);
    }
    const ranking = [...byRep.entries()].sort((a, b) => b[1].valor - a[1].valor).slice(0, 5);

    // Canais de leads do dia
    const byChannel = new Map<string, number>();
    for (const l of leads as any[]) {
      const key = l.canal || l.source || "Não informado";
      byChannel.set(key, (byChannel.get(key) || 0) + 1);
    }
    const channels = [...byChannel.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);

    const lines: string[] = [];
    lines.push(`*RELATÓRIO COMERCIAL DIÁRIO*`);
    lines.push(`_${label}_`);
    lines.push("");
    lines.push(`*ENTRADA*`);
    lines.push(`• Leads novos: *${leads.length}*`);
    lines.push(`• MQL: *${mqlToday}* (${pct(mqlToday, leads.length)} dos leads)`);
    lines.push(`• Negócios criados: *${(dealsToday || []).length}*`);
    if (channels.length) {
      lines.push(`• Canais: ${channels.map(([c, n]) => `${c} ${n}`).join(" | ")}`);
    }
    lines.push("");
    lines.push(`*FECHAMENTO DO DIA*`);
    lines.push(`• Vendas: *${won.length}*`);
    lines.push(`• Valor: *${brl(wonValue)}*`);
    lines.push(`• Perdas: *${lost.length}*`);
    if (won.length) {
      lines.push("");
      for (const d of won.slice(0, 8) as any[]) {
        lines.push(`  ✅ ${d.title || "Negócio"} — ${brl(Number(d.value || 0))} (${nameById.get(d.responsible_user_id) || "—"})`);
      }
    }
    lines.push("");
    lines.push(`*MÊS ATÉ AGORA*`);
    lines.push(`• Vendas: *${monthWon.length}*`);
    lines.push(`• Faturamento: *${brl(monthValue)}*`);
    lines.push(`• Pipeline aberto: *${brl(pipelineValue)}*`);
    if (ranking.length) {
      lines.push("");
      lines.push(`*RANKING DO MÊS*`);
      ranking.forEach(([nome, r], i) => {
        const medal = ["🥇", "🥈", "🥉"][i] || `${i + 1}.`;
        lines.push(`${medal} ${nome} — ${r.qtd} venda(s) · ${brl(r.valor)}`);
      });
    }
    lines.push("");
    lines.push(`_ROY APP · gerado automaticamente_`);

    const message = lines.join("\n");

    if (dryRun) {
      return new Response(JSON.stringify({ success: true, dryRun: true, to, message }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Instância do Comercial (setor vendas)
    const { data: integration } = await supabase
      .from("integrations")
      .select("id, config")
      .eq("type", "whatsapp")
      .eq("status", "connected")
      .eq("sector_id", "vendas")
      .maybeSingle();

    const cfg = (integration?.config || {}) as Record<string, string>;
    const instanceToken = cfg.instance_token;
    if (!instanceToken) {
      return new Response(JSON.stringify({ error: "Instância do Comercial não conectada" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: sectorSettings } = await supabase
      .from("sector_settings")
      .select("royzapp_host")
      .eq("sector_id", "vendas")
      .maybeSingle();
    const host = (cfg.host_url || sectorSettings?.royzapp_host || Deno.env.get("UAZAPI_URL") || "https://g1.uazapi.com").replace(/\/$/, "");

    const resp = await fetch(`${host}/send/text`, {
      method: "POST",
      headers: { "Content-Type": "application/json", token: instanceToken },
      body: JSON.stringify({ number: to, text: message }),
    });
    const result = await resp.json().catch(() => ({}));
    const ok = resp.ok && (result.error === false || result.chatid || result.messageid || result.messageId || String(result.status || "").toLowerCase() === "pending");

    if (!ok) {
      console.error(`[daily-sales-report] falha [${resp.status}]:`, JSON.stringify(result));
      return new Response(JSON.stringify({ error: "Falha no envio", status: resp.status, details: result, message }), {
        status: resp.status === 200 ? 502 : resp.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, to, message, result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[daily-sales-report] erro:", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
