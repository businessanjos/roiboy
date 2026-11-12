import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  useZappMessageLimit, ZAPP_LIMIT_DEFAULT, ZAPP_LIMIT_SAFE_MAX, ZAPP_LIMIT_MIN, ZAPP_LIMIT_MAX,
} from "@/hooks/useZappMessageLimit";

function clamp(n: number) {
  return Math.min(ZAPP_LIMIT_MAX, Math.max(ZAPP_LIMIT_MIN, Math.round(n || 0)));
}

export function ZappMessageLimitSection({ sectorId }: { sectorId: string }) {
  const l = useZappMessageLimit(sectorId);
  const [base, setBase] = useState(String(l.base));
  const [today, setToday] = useState(String(l.todayLimit ?? 120));
  const [ack, setAck] = useState(false);
  useEffect(() => setBase(String(l.base)), [l.base]);

  const risky = (n: number) => n > ZAPP_LIMIT_SAFE_MAX;
  const baseN = clamp(Number(base));
  const todayN = clamp(Number(today));
  const needsAck = risky(baseN) || risky(todayN);

  return (
    <div className="space-y-3 pt-4 border-t border-zapp-border">
      <div>
        <p className="text-zapp-text text-sm font-medium">Limite de mensagens por hora</p>
        <p className="text-zapp-text-muted text-xs">
          Cada atendente pode enviar até <b>{l.effective}</b> mensagens a cada 60 minutos
          {l.todayLimit ? " (limite aumentado só hoje)" : ""}. Padrão: {ZAPP_LIMIT_DEFAULT}.
        </p>
      </div>

      <div className="flex gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-zapp-text">
        <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" />
        <p>
          <b>Risco de banimento:</b> o WhatsApp bloqueia números que mandam muitas mensagens em pouco tempo.
          Acima de {ZAPP_LIMIT_SAFE_MAX}/hora o risco sobe bastante e pode derrubar o número do setor inteiro.
          Prefira aumentar <b>só hoje</b>, em dias de campanha, e voltar ao padrão.
        </p>
      </div>

      {!l.canEdit ? (
        <p className="text-zapp-text-muted text-xs">Só gestor ou admin deste setor pode alterar.</p>
      ) : (
        <>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="p-3 bg-zapp-panel rounded-lg space-y-2">
              <p className="text-zapp-text text-sm">Limite fixo (todos os dias)</p>
              <div className="flex gap-2">
                <Input type="number" min={ZAPP_LIMIT_MIN} max={ZAPP_LIMIT_MAX} value={base}
                  onChange={(e) => setBase(e.target.value)} className="h-8 w-24" />
                <Button size="sm" variant="outline" disabled={l.saving || (risky(baseN) && !ack)}
                  onClick={() => l.setBase(baseN)}>Salvar</Button>
              </div>
            </div>
            <div className="p-3 bg-zapp-panel rounded-lg space-y-2">
              <p className="text-zapp-text text-sm">Aumentar só hoje</p>
              <p className="text-zapp-text-muted text-xs">Volta sozinho ao limite fixo à meia-noite.</p>
              <div className="flex flex-wrap gap-2">
                <Input type="number" min={ZAPP_LIMIT_MIN} max={ZAPP_LIMIT_MAX} value={today}
                  onChange={(e) => setToday(e.target.value)} className="h-8 w-24" />
                <Button size="sm" disabled={l.saving || (risky(todayN) && !ack)}
                  onClick={() => l.setToday(todayN)}>Aplicar hoje</Button>
                {l.todayLimit && (
                  <Button size="sm" variant="ghost" disabled={l.saving} onClick={() => l.setToday(null)}>
                    Cancelar
                  </Button>
                )}
              </div>
            </div>
          </div>
          {needsAck && (
            <label className="flex items-start gap-2 text-xs text-zapp-text">
              <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} className="mt-0.5" />
              Estou ciente de que acima de {ZAPP_LIMIT_SAFE_MAX} mensagens por hora o número pode ser banido pelo WhatsApp.
            </label>
          )}

          <div className="p-3 bg-zapp-panel rounded-lg">
            <p className="text-zapp-text text-sm mb-2">Como está hoje</p>
            {l.usage.length === 0 ? (
              <p className="text-zapp-text-muted text-xs">Nenhuma mensagem enviada hoje.</p>
            ) : (
              <div className="space-y-1.5 max-h-64 overflow-y-auto">
                {l.usage.map((u) => {
                  const pct = Math.min(100, (Number(u.last_hour) / l.effective) * 100);
                  return (
                    <div key={u.user_id} className="text-xs">
                      <div className="flex justify-between text-zapp-text">
                        <span className="truncate">{u.user_name}</span>
                        <span className="tabular-nums text-zapp-text-muted">
                          {u.last_hour}/{l.effective} na última hora · {u.today} hoje
                        </span>
                      </div>
                      <div className="h-1.5 rounded bg-zapp-border overflow-hidden">
                        <div className={cn("h-full", pct >= 100 ? "bg-destructive" : pct >= 75 ? "bg-primary" : "bg-zapp-accent")}
                          style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <div className="p-3 bg-zapp-panel rounded-lg">
            <p className="text-zapp-text text-sm mb-2">Histórico de mudanças</p>
            {l.history.length === 0 ? (
              <p className="text-zapp-text-muted text-xs">Nenhuma mudança registrada ainda.</p>
            ) : (
              <ul className="space-y-1.5 max-h-56 overflow-y-auto text-xs">
                {l.history.map((h) => {
                  const parts: string[] = [];
                  if (h.old_hourly !== h.new_hourly) parts.push(`Limite fixo: ${h.old_hourly ?? ZAPP_LIMIT_DEFAULT} → ${h.new_hourly}`);
                  if (h.old_today !== h.new_today) parts.push(h.new_today ? `Só hoje: ${h.new_today}/hora` : "Cancelou o aumento de hoje");
                  return (
                    <li key={h.id} className="flex justify-between gap-2 border-b border-zapp-border/60 pb-1 last:border-0">
                      <span className="text-zapp-text">
                        <b>{h.changed_by_name || "Alguém"}</b> · {parts.join(" · ") || "Salvou sem mudar"}
                      </span>
                      <span className="shrink-0 tabular-nums text-zapp-text-muted">
                        {new Date(h.changed_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
