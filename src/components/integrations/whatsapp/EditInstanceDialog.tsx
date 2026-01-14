import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Loader2, Lock, LockOpen, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { SectorInstance } from "./SectorInstanceCard";

interface EditInstanceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  instance: SectorInstance | null;
  onSuccess: () => void;
}

export function EditInstanceDialog({
  open,
  onOpenChange,
  instance,
  onSuccess,
}: EditInstanceDialogProps) {
  const [loading, setLoading] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [activeTab, setActiveTab] = useState("name");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");

  useEffect(() => {
    if (instance) {
      setDisplayName(instance.display_name || "");
      setNewPin("");
      setConfirmPin("");
    }
  }, [instance]);

  const handleSaveName = async () => {
    if (!instance) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from("integrations")
        .update({ display_name: displayName || null })
        .eq("id", instance.id);

      if (error) throw error;

      toast.success("Nome atualizado");
      onSuccess();
      onOpenChange(false);
    } catch (err) {
      console.error("Failed to update name:", err);
      toast.error("Erro ao atualizar nome");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePin = async () => {
    if (!instance) return;

    if (newPin.length < 4) {
      toast.error("O PIN deve ter 4 dígitos");
      return;
    }

    if (newPin !== confirmPin) {
      toast.error("Os PINs não conferem");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("uazapi-manager", {
        body: {
          action: "update_instance_pin",
          integration_id: instance.id,
          pin: newPin,
        },
      });

      if (error) throw error;

      toast.success("PIN atualizado");
      onSuccess();
      onOpenChange(false);
    } catch (err) {
      console.error("Failed to update PIN:", err);
      toast.error("Erro ao atualizar PIN");
    } finally {
      setLoading(false);
    }
  };

  const handleRemovePin = async () => {
    if (!instance) return;

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("uazapi-manager", {
        body: {
          action: "update_instance_pin",
          integration_id: instance.id,
          pin: null,
        },
      });

      if (error) throw error;

      toast.success("PIN removido");
      onSuccess();
      onOpenChange(false);
    } catch (err) {
      console.error("Failed to remove PIN:", err);
      toast.error("Erro ao remover PIN");
    } finally {
      setLoading(false);
    }
  };

  if (!instance) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar Instância</DialogTitle>
          <DialogDescription>
            {instance.profile_name || instance.instance_name}
            {instance.phone_number && ` (${instance.phone_number})`}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="name">Nome</TabsTrigger>
            <TabsTrigger value="pin">
              {instance.has_pin ? <Lock className="h-3.5 w-3.5 mr-1.5" /> : <LockOpen className="h-3.5 w-3.5 mr-1.5" />}
              PIN
            </TabsTrigger>
          </TabsList>

          <TabsContent value="name" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="editDisplayName">Nome de exibição</Label>
              <Input
                id="editDisplayName"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Ex: WhatsApp Vendas Principal"
              />
              <p className="text-xs text-muted-foreground">
                Nome personalizado para identificar esta instância.
              </p>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
                Cancelar
              </Button>
              <Button onClick={handleSaveName} disabled={loading}>
                {loading ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Salvando...</>
                ) : (
                  "Salvar"
                )}
              </Button>
            </DialogFooter>
          </TabsContent>

          <TabsContent value="pin" className="space-y-4 mt-4">
            {instance.has_pin ? (
              <>
                <div className="p-3 bg-amber-500/10 rounded-lg border border-amber-500/20">
                  <div className="flex items-start gap-2">
                    <Lock className="h-4 w-4 text-amber-500 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium">Esta instância está protegida</p>
                      <p className="text-xs text-muted-foreground">
                        Usuários precisam digitar o PIN para acessar.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Novo PIN (4 dígitos)</Label>
                  <InputOTP maxLength={4} value={newPin} onChange={setNewPin}>
                    <InputOTPGroup>
                      <InputOTPSlot index={0} />
                      <InputOTPSlot index={1} />
                      <InputOTPSlot index={2} />
                      <InputOTPSlot index={3} />
                    </InputOTPGroup>
                  </InputOTP>
                </div>

                <div className="space-y-2">
                  <Label>Confirmar novo PIN</Label>
                  <InputOTP maxLength={4} value={confirmPin} onChange={setConfirmPin}>
                    <InputOTPGroup>
                      <InputOTPSlot index={0} />
                      <InputOTPSlot index={1} />
                      <InputOTPSlot index={2} />
                      <InputOTPSlot index={3} />
                    </InputOTPGroup>
                  </InputOTP>
                </div>

                <DialogFooter className="flex-col sm:flex-row gap-2">
                  <Button
                    variant="outline"
                    onClick={handleRemovePin}
                    disabled={loading}
                    className="text-destructive hover:text-destructive"
                  >
                    <LockOpen className="h-4 w-4 mr-2" />
                    Remover PIN
                  </Button>
                  <Button onClick={handleUpdatePin} disabled={loading || newPin.length < 4}>
                    {loading ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Salvando...</>
                    ) : (
                      "Alterar PIN"
                    )}
                  </Button>
                </DialogFooter>
              </>
            ) : (
              <>
                <div className="p-3 bg-muted rounded-lg">
                  <div className="flex items-start gap-2">
                    <LockOpen className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-sm font-medium">Sem proteção por PIN</p>
                      <p className="text-xs text-muted-foreground">
                        Adicione um PIN para restringir o acesso a esta instância.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Novo PIN (4 dígitos)</Label>
                  <InputOTP maxLength={4} value={newPin} onChange={setNewPin}>
                    <InputOTPGroup>
                      <InputOTPSlot index={0} />
                      <InputOTPSlot index={1} />
                      <InputOTPSlot index={2} />
                      <InputOTPSlot index={3} />
                    </InputOTPGroup>
                  </InputOTP>
                </div>

                <div className="space-y-2">
                  <Label>Confirmar PIN</Label>
                  <InputOTP maxLength={4} value={confirmPin} onChange={setConfirmPin}>
                    <InputOTPGroup>
                      <InputOTPSlot index={0} />
                      <InputOTPSlot index={1} />
                      <InputOTPSlot index={2} />
                      <InputOTPSlot index={3} />
                    </InputOTPGroup>
                  </InputOTP>
                </div>

                <DialogFooter>
                  <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
                    Cancelar
                  </Button>
                  <Button onClick={handleUpdatePin} disabled={loading || newPin.length < 4}>
                    {loading ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Salvando...</>
                    ) : (
                      <>
                        <Lock className="h-4 w-4 mr-2" />
                        Definir PIN
                      </>
                    )}
                  </Button>
                </DialogFooter>
              </>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
