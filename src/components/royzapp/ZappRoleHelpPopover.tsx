import { memo } from "react";
import { Check, HelpCircle, Minus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  ZAPP_ROLE_LABELS,
  zappRoleCapabilities,
  type ZappSectorRole,
} from "@/lib/royZappRoles";

const ROLES: ZappSectorRole[] = ["admin", "manager", "member", "viewer"];

const ROLE_SUMMARY: Record<ZappSectorRole, string> = {
  admin: "Controle total do WhatsApp do setor, incluindo conexão e configurações.",
  manager: "Vê a fila inteira do setor, transfere conversas e responde.",
  member: "Vê apenas as conversas atribuídas a ele + a fila (para assumir) e responde.",
  viewer: "Somente leitura: acompanha as conversas sem interagir.",
};

const CAPABILITIES: { key: keyof ReturnType<typeof zappRoleCapabilities>; label: string }[] = [
  { key: "canSeeAllSectorConversations", label: "Ver conversas de outros atendentes" },
  { key: "canReply", label: "Enviar mensagens (texto, mídia, áudio)" },
  { key: "canClaim", label: "Puxar da fila / devolver / mudar status" },
  { key: "canTransfer", label: "Transferir para outro atendente ou fila" },
  { key: "canEditTags", label: "Criar e aplicar tags" },
  { key: "canManageConnection", label: "Gerenciar conexão (QR Code, reset, webhook)" },
];

interface ZappRoleHelpPopoverProps {
  /** Papel do usuário atual neste setor — destacado na tabela. */
  currentRole?: ZappSectorRole | null;
  className?: string;
}

export const ZappRoleHelpPopover = memo(function ZappRoleHelpPopover({
  currentRole,
  className,
}: ZappRoleHelpPopoverProps) {
  return (
    <Popover>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Entenda os papéis do ROY zAPP"
              className={cn(
                "shrink-0 rounded-full h-8 w-8 text-zapp-text-muted hover:bg-zapp-panel hover:text-zapp-text",
                className
              )}
            >
              <HelpCircle className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          {currentRole
            ? `Seu papel aqui: ${ZAPP_ROLE_LABELS[currentRole]} — ver o que muda`
            : "O que muda em cada papel"}
        </TooltipContent>
      </Tooltip>

      <PopoverContent
        align="end"
        side="bottom"
        className="w-[min(92vw,520px)] max-h-[70vh] overflow-y-auto bg-zapp-panel border-zapp-border text-zapp-text p-0"
      >
        <div className="px-4 pt-4 pb-3 border-b border-zapp-border">
          <h4 className="text-sm font-semibold">Papéis no ROY zAPP</h4>
          <p className="text-xs text-zapp-text-muted mt-1">
            O papel é definido por setor (WhatsApp) na área de Admin &gt; Permissões. As regras
            valem também no backend — não é apenas a interface que esconde os botões.
          </p>
        </div>

        <div className="p-4 space-y-3">
          {ROLES.map((role) => (
            <div
              key={role}
              className={cn(
                "rounded-lg border p-3",
                currentRole === role
                  ? "border-zapp-accent/50 bg-zapp-accent/10"
                  : "border-zapp-border bg-zapp-bg/40"
              )}
            >
              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className="border-zapp-border text-zapp-text text-[10px] uppercase tracking-wide"
                >
                  {ZAPP_ROLE_LABELS[role]}
                </Badge>
                {currentRole === role && (
                  <span className="text-[10px] text-zapp-accent font-medium">seu papel</span>
                )}
              </div>
              <p className="text-xs text-zapp-text-muted mt-2">{ROLE_SUMMARY[role]}</p>
            </div>
          ))}
        </div>

        <div className="px-4 pb-4">
          <div className="text-[11px] font-medium text-zapp-text-muted mb-2 uppercase tracking-wide">
            Ações por papel
          </div>
          <div className="overflow-hidden rounded-lg border border-zapp-border">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-zapp-bg/60">
                  <th className="text-left font-medium px-2 py-2 text-zapp-text-muted">Ação</th>
                  {ROLES.map((role) => (
                    <th
                      key={role}
                      className={cn(
                        "px-1 py-2 font-medium text-center whitespace-nowrap",
                        currentRole === role ? "text-zapp-accent" : "text-zapp-text-muted"
                      )}
                    >
                      {ZAPP_ROLE_LABELS[role]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {CAPABILITIES.map(({ key, label }) => (
                  <tr key={key} className="border-t border-zapp-border">
                    <td className="px-2 py-2 text-zapp-text">{label}</td>
                    {ROLES.map((role) => {
                      const allowed = zappRoleCapabilities(role)[key];
                      return (
                        <td key={role} className="px-1 py-2 text-center">
                          {allowed ? (
                            <Check
                              className="h-3.5 w-3.5 mx-auto text-zapp-accent"
                              aria-label="Habilitado"
                            />
                          ) : (
                            <Minus
                              className="h-3.5 w-3.5 mx-auto text-zapp-text-muted/60"
                              aria-label="Desabilitado"
                            />
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-zapp-text-muted mt-2">
            Observação: um cargo de gestão (Head, Diretor, Sócio…) é tratado como Gestor. Um Viewer
            explícito é somente leitura, mas todos os papéis podem transferir conversas.
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
});
