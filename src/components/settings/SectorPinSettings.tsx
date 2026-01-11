import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Loader2, Lock, LockOpen, Save, Trash2, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { sectors, SectorId } from "@/config/sectors";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";

// Setores que podem ter PIN
const PIN_ENABLED_SECTORS: SectorId[] = ["diretoria"];

export function SectorPinSettings() {
  const [newPin, setNewPin] = useState("");
  const [saving, setSaving] = useState(false);
  const [selectedSector, setSelectedSector] = useState<SectorId>("diretoria");
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [checkingAdmin, setCheckingAdmin] = useState(true);

  // Verificar se é super_admin
  useEffect(() => {
    const checkSuperAdmin = async () => {
      try {
        const { data } = await supabase.rpc("is_super_admin");
        setIsSuperAdmin(!!data);
      } catch (error) {
        console.error("Error checking super admin:", error);
      } finally {
        setCheckingAdmin(false);
      }
    };
    checkSuperAdmin();
  }, []);

  // Buscar status do PIN para setores
  const { data: sectorPinStatus, refetch: refetchPinStatus } = useQuery({
    queryKey: ["sector-pin-status"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sector_settings")
        .select("sector_id, pin_hash")
        .in("sector_id", PIN_ENABLED_SECTORS);
      
      if (error) throw error;
      
      const statusMap: Record<string, boolean> = {};
      (data || []).forEach((item: any) => {
        statusMap[item.sector_id] = !!item.pin_hash;
      });
      return statusMap;
    },
    enabled: isSuperAdmin,
  });

  const handleSavePin = async () => {
    if (newPin.length !== 6) {
      toast.error("Digite um PIN de 6 dígitos");
      return;
    }

    setSaving(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      
      const { data, error } = await supabase.functions.invoke("set-sector-pin", {
        body: { sector_id: selectedSector, pin: newPin },
        headers: {
          Authorization: `Bearer ${session.session?.access_token}`,
        },
      });

      if (error) throw error;
      
      if (data.success) {
        toast.success("PIN definido com sucesso");
        setNewPin("");
        refetchPinStatus();
      } else {
        toast.error(data.error || "Erro ao definir PIN");
      }
    } catch (error: any) {
      console.error("Error setting PIN:", error);
      toast.error(error.message || "Erro ao definir PIN");
    } finally {
      setSaving(false);
    }
  };

  const handleRemovePin = async () => {
    setSaving(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      
      const { data, error } = await supabase.functions.invoke("set-sector-pin", {
        body: { sector_id: selectedSector, pin: null },
        headers: {
          Authorization: `Bearer ${session.session?.access_token}`,
        },
      });

      if (error) throw error;
      
      if (data.success) {
        toast.success("PIN removido");
        refetchPinStatus();
      } else {
        toast.error(data.error || "Erro ao remover PIN");
      }
    } catch (error: any) {
      console.error("Error removing PIN:", error);
      toast.error(error.message || "Erro ao remover PIN");
    } finally {
      setSaving(false);
    }
  };

  if (checkingAdmin) {
    return (
      <div className="flex items-center justify-center p-4">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isSuperAdmin) {
    return null; // Não exibir para não super admins
  }

  const sectorInfo = sectors.find(s => s.id === selectedSector);
  const hasPinConfigured = sectorPinStatus?.[selectedSector];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg">Proteção por PIN</CardTitle>
        </div>
        <CardDescription>
          Configure um PIN de 6 dígitos para restringir o acesso a setores sensíveis no ROY zAPP
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Seleção de setor */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Setor</label>
          <div className="flex flex-wrap gap-2">
            {PIN_ENABLED_SECTORS.map(sectorId => {
              const sector = sectors.find(s => s.id === sectorId);
              if (!sector) return null;
              
              const Icon = sector.icon;
              const isActive = selectedSector === sectorId;
              const hasPin = sectorPinStatus?.[sectorId];
              
              return (
                <Button
                  key={sectorId}
                  variant={isActive ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedSector(sectorId)}
                  className="gap-2"
                >
                  <Icon className="h-4 w-4" />
                  {sector.name}
                  {hasPin && (
                    <Lock className="h-3 w-3 text-amber-500" />
                  )}
                </Button>
              );
            })}
          </div>
        </div>

        {/* Status atual */}
        <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
          {hasPinConfigured ? (
            <>
              <Lock className="h-5 w-5 text-amber-500" />
              <div className="flex-1">
                <p className="text-sm font-medium">PIN configurado</p>
                <p className="text-xs text-muted-foreground">
                  O setor {sectorInfo?.name} está protegido por PIN
                </p>
              </div>
              <Badge variant="outline" className="text-amber-600 border-amber-300">
                Protegido
              </Badge>
            </>
          ) : (
            <>
              <LockOpen className="h-5 w-5 text-muted-foreground" />
              <div className="flex-1">
                <p className="text-sm font-medium">Sem PIN</p>
                <p className="text-xs text-muted-foreground">
                  O acesso ao setor {sectorInfo?.name} não está restrito por PIN
                </p>
              </div>
              <Badge variant="outline">Livre</Badge>
            </>
          )}
        </div>

        {/* Formulário de PIN */}
        <div className="space-y-4">
          <label className="text-sm font-medium">
            {hasPinConfigured ? "Novo PIN (substituir atual)" : "Definir PIN"}
          </label>
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <InputOTP
              maxLength={6}
              value={newPin}
              onChange={setNewPin}
              disabled={saving}
            >
              <InputOTPGroup>
                <InputOTPSlot index={0} />
                <InputOTPSlot index={1} />
                <InputOTPSlot index={2} />
                <InputOTPSlot index={3} />
                <InputOTPSlot index={4} />
                <InputOTPSlot index={5} />
              </InputOTPGroup>
            </InputOTP>
            
            <div className="flex gap-2">
              <Button
                onClick={handleSavePin}
                disabled={newPin.length !== 6 || saving}
                size="sm"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Salvar
                  </>
                )}
              </Button>
              
              {hasPinConfigured && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleRemovePin}
                  disabled={saving}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Remover
                </Button>
              )}
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            O PIN será solicitado ao acessar o setor no ROY zAPP. O acesso é liberado para a sessão após a verificação.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
