// Super-admin panel embedded inside Permissions tab.
// Lets a super admin manage role, email, password, active state and
// multi-account memberships of a single user.
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Loader2, Mail, KeyRound, UserCog, Building2, Plus, Trash2, ShieldOff, ShieldCheck } from "lucide-react";

interface Account { id: string; name: string }

interface Membership {
  user_id: string;
  account_id: string;
  account_name: string | null;
  role: string;
  is_active: boolean;
  name: string;
  email: string;
}

// Perfil de Acesso ao sistema (NÃO confundir com Cargo).
// Cargo (Mentor, Consultor, Head, Líder, CX, CS, etc.) é gerenciado em
// Configurações › Equipe (tabela team_roles). Aqui controlamos apenas o
// nível de acesso reconhecido pelo motor de permissões.
const ACCESS_PROFILES = [
  { value: "admin", label: "Admin", hint: "Acesso total ao sistema" },
  { value: "gestor", label: "Gestor", hint: "Gerencia equipe e configurações" },
  { value: "member", label: "Membro", hint: "Uso padrão" },
  { value: "viewer", label: "Viewer", hint: "Apenas visualização" },
];

const ACCESS_PROFILE_VALUES = new Set(ACCESS_PROFILES.map((p) => p.value));

function accessProfileLabel(value: string): string {
  return ACCESS_PROFILES.find((p) => p.value === value)?.label ?? value;
}

export function UserManagementPanel({
  authUserId,
  currentEmail,
  currentRole,
  currentRowId,
  isActive,
  accounts,
}: {
  authUserId: string | null;
  currentEmail: string;
  currentRole: string;
  currentRowId: string;
  isActive: boolean;
  accounts: Account[];
}) {
  const qc = useQueryClient();
  const [newEmail, setNewEmail] = useState(currentEmail);
  const [newPassword, setNewPassword] = useState("");
  const [linkAccountId, setLinkAccountId] = useState<string>("");
  const [linkRole, setLinkRole] = useState<string>("member");

  const memberships = useQuery({
    queryKey: ["admin-memberships", authUserId],
    enabled: !!authUserId,
    queryFn: async (): Promise<Membership[]> => {
      const { data, error } = await supabase.functions.invoke("admin-manage-user", {
        body: { action: "list_memberships", auth_user_id: authUserId },
      });
      if (error) throw error;
      return (data as any)?.memberships || [];
    },
  });

  const call = async (body: Record<string, unknown>) => {
    const { data, error } = await supabase.functions.invoke("admin-manage-user", { body });
    if (error) throw new Error(error.message);
    if ((data as any)?.error) throw new Error((data as any).error);
    return data;
  };

  const refreshAll = () => {
    qc.invalidateQueries({ queryKey: ["admin-memberships", authUserId] });
    qc.invalidateQueries({ queryKey: ["admin-permissions-users"] });
  };

  const emailMut = useMutation({
    mutationFn: () => call({ action: "change_email", auth_user_id: authUserId, new_email: newEmail }),
    onSuccess: () => { toast.success("E-mail atualizado."); refreshAll(); },
    onError: (e: any) => toast.error(e.message),
  });
  const passMut = useMutation({
    mutationFn: () => call({ action: "change_password", auth_user_id: authUserId, new_password: newPassword }),
    onSuccess: () => { toast.success("Senha atualizada."); setNewPassword(""); },
    onError: (e: any) => toast.error(e.message),
  });
  const activeMut = useMutation({
    mutationFn: (next: boolean) => call({ action: "set_active", auth_user_id: authUserId, is_active: next }),
    onSuccess: () => { toast.success("Status de acesso atualizado."); refreshAll(); },
    onError: (e: any) => toast.error(e.message),
  });
  const roleMut = useMutation({
    mutationFn: (role: string) => call({ action: "set_role", user_row_id: currentRowId, role }),
    onSuccess: () => { toast.success("Função atualizada."); refreshAll(); },
    onError: (e: any) => toast.error(e.message),
  });
  const linkMut = useMutation({
    mutationFn: () =>
      call({ action: "link_account", auth_user_id: authUserId, account_id: linkAccountId, role: linkRole }),
    onSuccess: () => { toast.success("Vinculado."); setLinkAccountId(""); refreshAll(); },
    onError: (e: any) => toast.error(e.message),
  });
  const unlinkMut = useMutation({
    mutationFn: (rowId: string) => call({ action: "unlink_account", user_row_id: rowId }),
    onSuccess: () => { toast.success("Vínculo removido."); refreshAll(); },
    onError: (e: any) => toast.error(e.message),
  });

  if (!authUserId) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-6 text-sm text-muted-foreground">
          Este usuário ainda não tem conta de acesso (sem auth_user_id). Crie/convide-o pela área de equipe.
        </CardContent>
      </Card>
    );
  }

  const linkedIds = new Set((memberships.data || []).map((m) => m.account_id));
  const availableAccounts = accounts.filter((a) => !linkedIds.has(a.id));

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <UserCog className="h-4 w-4 text-primary" /> Gestão do usuário (Super Admin)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Role + active */}
        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-1.5 md:col-span-2">
            <Label className="text-xs">Perfil de Acesso</Label>
            <Select defaultValue={currentRole} onValueChange={(v) => roleMut.mutate(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ACCESS_PROFILES.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    <div className="flex flex-col">
                      <span>{r.label}</span>
                      <span className="text-[10px] text-muted-foreground">{r.hint}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[10px] text-muted-foreground">
              Cargo (ex: Mentor, Consultor, Head) é gerenciado em Configurações › Equipe.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Acesso ao sistema</Label>
            <div className="flex items-center gap-3 h-10 px-3 border rounded-md">
              <Switch
                checked={isActive}
                disabled={activeMut.isPending}
                onCheckedChange={(v) => activeMut.mutate(v)}
              />
              <span className="text-sm flex items-center gap-1.5">
                {isActive ? <><ShieldCheck className="h-4 w-4 text-emerald-500" /> Ativo</>
                          : <><ShieldOff className="h-4 w-4 text-destructive" /> Inativo</>}
              </span>
            </div>
          </div>
        </div>

        {/* Email */}
        <div className="space-y-1.5">
          <Label className="text-xs flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" /> E-mail de login</Label>
          <div className="flex gap-2">
            <Input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
            <Button
              onClick={() => emailMut.mutate()}
              disabled={emailMut.isPending || !newEmail || newEmail === currentEmail}
            >
              {emailMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
            </Button>
          </div>
        </div>

        {/* Password */}
        <div className="space-y-1.5">
          <Label className="text-xs flex items-center gap-1.5"><KeyRound className="h-3.5 w-3.5" /> Nova senha temporária</Label>
          <div className="flex gap-2">
            <Input
              type="text"
              placeholder="Mínimo 6 caracteres"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
            <Button
              variant="outline"
              onClick={() => passMut.mutate()}
              disabled={passMut.isPending || newPassword.length < 6}
            >
              {passMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Definir"}
            </Button>
          </div>
        </div>

        {/* Memberships */}
        <div className="space-y-2">
          <Label className="text-xs flex items-center gap-1.5">
            <Building2 className="h-3.5 w-3.5" /> Contas vinculadas
          </Label>
          <div className="space-y-1.5">
            {(memberships.data || []).map((m) => {
              const isOfficial = ACCESS_PROFILE_VALUES.has(m.role);
              return (
                <div key={m.user_id} className="flex items-center justify-between gap-2 px-3 py-2 border rounded-md">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm truncate">{m.account_name || m.account_id}</span>
                    <Badge
                      variant={isOfficial ? "secondary" : "destructive"}
                      className="text-[10px]"
                      title={isOfficial ? "Perfil de acesso" : "Valor legado — atualize para um perfil oficial"}
                    >
                      {accessProfileLabel(m.role)}
                    </Badge>
                    {!m.is_active && <Badge variant="outline" className="text-[10px]">inativo</Badge>}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => unlinkMut.mutate(m.user_id)}
                    disabled={unlinkMut.isPending}
                    title="Remover vínculo"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              );
            })}
          </div>

          <div className="pt-2 space-y-2 border-t">
            <Label className="text-xs">Vincular a outra conta</Label>
            <p className="text-[11px] text-muted-foreground">
              Cargos (Mentor, Consultor, Head, etc.) são definidos em Configurações › Equipe. Aqui escolha apenas o
              <strong> Perfil de Acesso</strong> ao sistema.
            </p>
            <div className="grid gap-2 sm:grid-cols-[1fr_220px_auto]">
              <Select value={linkAccountId} onValueChange={setLinkAccountId}>
                <SelectTrigger><SelectValue placeholder="Selecione a conta…" /></SelectTrigger>
                <SelectContent>
                  {availableAccounts.length === 0 ? (
                    <div className="px-2 py-1.5 text-xs text-muted-foreground">
                      Nenhuma conta disponível
                    </div>
                  ) : (
                    availableAccounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)
                  )}
                </SelectContent>
              </Select>
              <Select value={linkRole} onValueChange={setLinkRole}>
                <SelectTrigger>
                  <SelectValue placeholder="Perfil de acesso" />
                </SelectTrigger>
                <SelectContent>
                  {ACCESS_PROFILES.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      <div className="flex flex-col">
                        <span className="text-sm">{r.label}</span>
                        <span className="text-[11px] text-muted-foreground">{r.hint}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                onClick={() => linkMut.mutate()}
                disabled={!linkAccountId || linkMut.isPending}
                title="Vincular conta"
              >
                {linkMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
