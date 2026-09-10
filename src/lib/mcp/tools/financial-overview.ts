import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { failIf, jsonResult, requireSector } from "../helpers";

export default defineTool({
  name: "financial_overview",
  title: "Visão financeira",
  description: "Analisa fluxo de caixa, contas a pagar e receber e inadimplência sem expor anexos, dados bancários ou credenciais.",
  inputSchema: {
    start_date: z.string().describe("Início do período por vencimento (YYYY-MM-DD)."),
    end_date: z.string().describe("Fim do período por vencimento (YYYY-MM-DD)."),
    entry_type: z.enum(["receivable", "payable", "all"]).describe("Tipo de lançamento."),
    status: z.enum(["pending", "paid", "overdue", "partially_paid", "cancelled", "all"]).describe("Status financeiro."),
    include_entries: z.boolean().describe("Incluir lista resumida dos lançamentos."),
    limit: z.number().int().min(1).max(300).describe("Máximo de lançamentos detalhados."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ start_date, end_date, entry_type, status, include_entries, limit }, ctx) => {
    const supabase = await requireSector(ctx, "financeiro");
    let query = supabase.from("financial_entries")
      .select("id, entry_type, description, amount, currency, due_date, payment_date, status, category_id, client_id, supplier_id, installment_number, total_installments, is_conciliated")
      .gte("due_date", start_date).lte("due_date", end_date).order("due_date").limit(limit);
    if (entry_type !== "all") query = query.eq("entry_type", entry_type);
    if (status !== "all") query = query.eq("status", status);
    const { data, error } = await query;
    failIf(error);
    const entries = data ?? [];
    const total = (rows: typeof entries) => rows.reduce((sum, row) => sum + Number(row.amount ?? 0), 0);
    const receivables = entries.filter((row) => row.entry_type === "receivable");
    const payables = entries.filter((row) => row.entry_type === "payable");
    const byStatus = new Map<string, { quantidade: number; valor: number }>();
    entries.forEach((row) => {
      const key = row.status ?? "não informado";
      const current = byStatus.get(key) ?? { quantidade: 0, valor: 0 };
      current.quantidade += 1; current.valor += Number(row.amount ?? 0); byStatus.set(key, current);
    });
    return jsonResult({
      periodo: { inicio: start_date, fim: end_date },
      resumo: { lancamentos: entries.length, a_receber: total(receivables), a_pagar: total(payables), saldo_previsto: total(receivables) - total(payables), conciliados: entries.filter((e) => e.is_conciliated).length },
      por_status: [...byStatus.entries()].map(([nome, values]) => ({ status: nome, ...values })),
      lancamentos: include_entries ? entries : undefined,
      observacao: entries.length === limit ? `Análise limitada aos primeiros ${limit} lançamentos do filtro.` : null,
    });
  },
});
