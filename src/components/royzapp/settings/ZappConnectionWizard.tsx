import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  Smartphone,
  Globe,
  ChevronLeft,
  ChevronRight,
  Check,
  Wifi,
  WifiOff,
  Copy,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type ConnectionType = "uazapi" | "meta";

interface UazapiInstance {
  name: string;
  status: string;
  owner: string;
  profileName: string;
  linked_sector_id: string | null;
}

interface ZappConnectionWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sectorId: string;
  sectorName: string;
  existingInstanceNames: string[];
  onSuccess: () => void;
}

const STEPS = [
  { id: 1, label: "Tipo" },
  { id: 2, label: "Dados" },
  { id: 3, label: "Conectar" },
];

export function ZappConnectionWizard({
  open,
  onOpenChange,
  sectorId,
  sectorName,
  existingInstanceNames,
  onSuccess,
}: ZappConnectionWizardProps) {
  const [step, setStep] = useState(1);
  const [type, setType] = useState<ConnectionType | null>(null);

  // UAZAPI fields
  const [loadingInstances, setLoadingInstances] = useState(false);
  const [availableInstances, setAvailableInstances] = useState<UazapiInstance[]>([]);
  const [selectedInstance, setSelectedInstance] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [usePin, setUsePin] = useState(false);
  const [pin, setPin] = useState("");

  // Meta fields
  const [phoneNumberId, setPhoneNumberId] = useState("");
  const [metaDisplayName, setMetaDisplayName] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/meta-webhook`;

  const reset = () => {
    setStep(1);
    setType(null);
    setSelectedInstance("");
    setDisplayName("");
    setUsePin(false);
    setPin("");
    setPhoneNumberId("");
    setMetaDisplayName("");
    setDone(false);
    setAvailableInstances([]);
  };

  const handleClose = () => {
    if (submitting) return;
    reset();
    onOpenChange(false);
  };

  // Fetch UAZAPI instances when entering step 2 with type=uazapi
  useEffect(() => {
    if (step !== 2 || type !== "uazapi") return;
    let cancelled = false;
    (async () => {
      setLoadingInstances(true);
      try {
        const { data, error } = await supabase.functions.invoke("uazapi-manager", {
          body: { action: "list_instances" },
        });
        if (error) throw error;
        const all = (data?.data?.instances || data?.instances || []) as UazapiInstance[];
        const free = all.filter(
          (i) => i.linked_sector_id === null && !existingInstanceNames.includes(i.name)
        );
        if (!cancelled) setAvailableInstances(free);
      } catch (e) {
        console.error(e);
        toast.error("Erro ao carregar instâncias UAZAPI");
      } finally {
        if (!cancelled) setLoadingInstances(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [step, type, existingInstanceNames]);

  const canAdvance = useMemo(() => {
    if (step === 1) return !!type;
    if (step === 2) {
      if (type === "uazapi") return !!selectedInstance && (!usePin || pin.length === 4);
      if (type === "meta") return phoneNumberId.trim().length > 0;
    }
    return true;
  }, [step, type, selectedInstance, usePin, pin, phoneNumberId]);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      if (type === "uazapi") {
        const { error } = await supabase.functions.invoke("uazapi-manager", {
          body: {
            action: "add_instance_to_sector",
            sector_id: sectorId,
            instance_name: selectedInstance,
            display_name: displayName || null,
            pin: usePin ? pin : null,
          },
        });
        if (error) throw error;
      } else if (type === "meta") {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Não autenticado");
        const { data: u } = await supabase
          .from("users")
          .select("account_id")
          .eq("auth_user_id", user.id)
          .single();
        if (!u) throw new Error("Usuário não encontrado");
        const { error } = await supabase.from("integrations").insert({
          account_id: u.account_id,
          type: "whatsapp",
          sector_id: sectorId,
          status: "disconnected",
          display_name: metaDisplayName || `Meta API - ${sectorName}`,
          config: {
            provider: "meta_official",
            phone_number_id: phoneNumberId.trim(),
          },
        });
        if (error) throw error;
      }
      toast.success("Conexão criada!");
      setDone(true);
      onSuccess();
    } catch (e) {
      console.error(e);
      const msg = e instanceof Error ? e.message : "Erro ao criar conexão";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="sm:max-w-2xl bg-zapp-bg border-zapp-border text-zapp-text">
        <DialogHeader>
          <DialogTitle className="text-zapp-text">Nova Conexão WhatsApp</DialogTitle>
          <DialogDescription className="text-zapp-text-muted">
            Adicione um número ao setor <strong>{sectorName}</strong>
          </DialogDescription>
        </DialogHeader>

        {/* Stepper */}
        <div className="flex items-center justify-center gap-2 py-2">
          {STEPS.map((s, i) => (
            <div key={s.id} className="flex items-center gap-2">
              <div
                className={cn(
                  "flex items-center justify-center w-7 h-7 rounded-full text-xs font-medium border",
                  step > s.id
                    ? "bg-zapp-accent border-zapp-accent text-white"
                    : step === s.id
                    ? "bg-zapp-accent/20 border-zapp-accent text-zapp-accent"
                    : "bg-zapp-panel border-zapp-border text-zapp-text-muted"
                )}
              >
                {step > s.id ? <Check className="h-3.5 w-3.5" /> : s.id}
              </div>
              <span
                className={cn(
                  "text-xs",
                  step === s.id ? "text-zapp-text font-medium" : "text-zapp-text-muted"
                )}
              >
                {s.label}
              </span>
              {i < STEPS.length - 1 && (
                <div
                  className={cn(
                    "w-8 h-px mx-1",
                    step > s.id ? "bg-zapp-accent" : "bg-zapp-border"
                  )}
                />
              )}
            </div>
          ))}
        </div>

        <div className="min-h-[280px] py-2">
          {/* Step 1: Type */}
          {step === 1 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setType("uazapi")}
                className={cn(
                  "p-5 rounded-lg border-2 text-left transition-all",
                  type === "uazapi"
                    ? "border-zapp-accent bg-zapp-accent/10"
                    : "border-zapp-border bg-zapp-panel hover:border-zapp-accent/50"
                )}
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 rounded-lg bg-emerald-500/10">
                    <Smartphone className="h-5 w-5 text-emerald-500" />
                  </div>
                  <div>
                    <p className="font-medium text-zapp-text">UAZAPI (QR Code)</p>
                    <Badge variant="secondary" className="text-[10px] mt-1">Recomendado</Badge>
                  </div>
                </div>
                <p className="text-xs text-zapp-text-muted">
                  Conecte um número escaneando o QR Code, igual ao WhatsApp Web. Rápido e flexível.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setType("meta")}
                className={cn(
                  "p-5 rounded-lg border-2 text-left transition-all",
                  type === "meta"
                    ? "border-zapp-accent bg-zapp-accent/10"
                    : "border-zapp-border bg-zapp-panel hover:border-zapp-accent/50"
                )}
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 rounded-lg bg-blue-500/10">
                    <Globe className="h-5 w-5 text-blue-500" />
                  </div>
                  <div>
                    <p className="font-medium text-zapp-text">Meta Cloud API</p>
                    <Badge variant="secondary" className="text-[10px] mt-1">Oficial</Badge>
                  </div>
                </div>
                <p className="text-xs text-zapp-text-muted">
                  API oficial do WhatsApp pela Meta. Requer conta verificada e Phone Number ID.
                </p>
              </button>
            </div>
          )}

          {/* Step 2: Data */}
          {step === 2 && type === "uazapi" && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-zapp-text">Instância UAZAPI</Label>
                {loadingInstances ? (
                  <div className="flex items-center justify-center p-4">
                    <Loader2 className="h-5 w-5 animate-spin text-zapp-text-muted" />
                  </div>
                ) : availableInstances.length === 0 ? (
                  <Alert className="bg-zapp-panel border-zapp-border">
                    <AlertDescription className="text-xs text-zapp-text-muted">
                      Nenhuma instância livre. Crie primeiro no painel UAZAPI.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <Select value={selectedInstance} onValueChange={setSelectedInstance}>
                    <SelectTrigger className="bg-zapp-input border-zapp-border text-zapp-text">
                      <SelectValue placeholder="Selecione uma instância..." />
                    </SelectTrigger>
                    <SelectContent>
                      {availableInstances.map((i) => (
                        <SelectItem key={i.name} value={i.name}>
                          <div className="flex items-center gap-2">
                            <span
                              className={cn(
                                "w-2 h-2 rounded-full",
                                i.status === "connected" ? "bg-emerald-500" : "bg-red-500"
                              )}
                            />
                            <span>{i.profileName || i.name}</span>
                            {i.owner && (
                              <span className="text-xs text-muted-foreground">
                                ({i.owner})
                              </span>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="dn" className="text-zapp-text">Nome de exibição (opcional)</Label>
                <Input
                  id="dn"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder={`Ex: WhatsApp ${sectorName} Principal`}
                  className="bg-zapp-input border-zapp-border text-zapp-text"
                />
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="pin"
                    checked={usePin}
                    onCheckedChange={(c) => setUsePin(c === true)}
                  />
                  <Label htmlFor="pin" className="text-zapp-text cursor-pointer">
                    Proteger com PIN (4 dígitos)
                  </Label>
                </div>
                {usePin && (
                  <InputOTP maxLength={4} value={pin} onChange={setPin}>
                    <InputOTPGroup>
                      <InputOTPSlot index={0} />
                      <InputOTPSlot index={1} />
                      <InputOTPSlot index={2} />
                      <InputOTPSlot index={3} />
                    </InputOTPGroup>
                  </InputOTP>
                )}
              </div>
            </div>
          )}

          {step === 2 && type === "meta" && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="pid" className="text-zapp-text">Phone Number ID *</Label>
                <Input
                  id="pid"
                  value={phoneNumberId}
                  onChange={(e) => setPhoneNumberId(e.target.value)}
                  placeholder="Ex: 123456789012345"
                  className="font-mono bg-zapp-input border-zapp-border text-zapp-text"
                />
                <p className="text-xs text-zapp-text-muted">
                  Encontre em{" "}
                  <a
                    href="https://developers.facebook.com"
                    target="_blank"
                    rel="noreferrer"
                    className="text-zapp-accent hover:underline inline-flex items-center gap-0.5"
                  >
                    developers.facebook.com <ExternalLink className="h-3 w-3" />
                  </a>{" "}
                  → Seu App → WhatsApp → API Setup
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="mdn" className="text-zapp-text">Nome de exibição (opcional)</Label>
                <Input
                  id="mdn"
                  value={metaDisplayName}
                  onChange={(e) => setMetaDisplayName(e.target.value)}
                  placeholder={`Ex: WhatsApp ${sectorName} (Meta)`}
                  className="bg-zapp-input border-zapp-border text-zapp-text"
                />
              </div>

              <Alert className="bg-zapp-panel border-zapp-border">
                <AlertDescription className="text-xs text-zapp-text-muted">
                  💡 Token e Verify Token já estão configurados no backend. Você só precisa do
                  Phone Number ID deste setor.
                </AlertDescription>
              </Alert>
            </div>
          )}

          {/* Step 3: Connect */}
          {step === 3 && (
            <div className="space-y-4">
              {!done ? (
                <div className="space-y-3">
                  <Alert className="bg-zapp-panel border-zapp-border">
                    <AlertDescription className="text-sm text-zapp-text">
                      Tudo pronto. Clique em <strong>Concluir</strong> para criar a conexão.
                    </AlertDescription>
                  </Alert>
                  <div className="rounded-lg bg-zapp-panel border border-zapp-border p-4 space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-zapp-text-muted">Tipo</span>
                      <span className="text-zapp-text font-medium">
                        {type === "uazapi" ? "UAZAPI (QR Code)" : "Meta Cloud API"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zapp-text-muted">Setor</span>
                      <span className="text-zapp-text font-medium">{sectorName}</span>
                    </div>
                    {type === "uazapi" && (
                      <div className="flex justify-between">
                        <span className="text-zapp-text-muted">Instância</span>
                        <span className="text-zapp-text font-medium">{selectedInstance}</span>
                      </div>
                    )}
                    {type === "meta" && (
                      <div className="flex justify-between">
                        <span className="text-zapp-text-muted">Phone Number ID</span>
                        <span className="text-zapp-text font-mono text-xs">{phoneNumberId}</span>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex flex-col items-center gap-2 py-4">
                    <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center">
                      <Check className="h-6 w-6 text-emerald-500" />
                    </div>
                    <p className="text-zapp-text font-medium">Conexão criada com sucesso!</p>
                  </div>

                  {type === "uazapi" && (
                    <Alert className="bg-zapp-panel border-zapp-border">
                      <AlertDescription className="text-xs text-zapp-text">
                        Use o botão <Wifi className="inline h-3 w-3" /> no card da conexão para
                        escanear o QR Code e finalizar o pareamento.
                      </AlertDescription>
                    </Alert>
                  )}

                  {type === "meta" && (
                    <div className="space-y-2">
                      <Label className="text-zapp-text">URL do Webhook (cole na Meta)</Label>
                      <div className="flex items-center gap-2">
                        <Input
                          value={webhookUrl}
                          readOnly
                          className="font-mono text-xs bg-zapp-input border-zapp-border text-zapp-text"
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            navigator.clipboard.writeText(webhookUrl);
                            toast.success("URL copiada!");
                          }}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                      <p className="text-xs text-zapp-text-muted">
                        Painel Meta → Webhooks → Callback URL
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="flex-row justify-between sm:justify-between gap-2">
          <Button
            variant="ghost"
            onClick={() => (step === 1 ? handleClose() : setStep((s) => s - 1))}
            disabled={submitting}
            className="text-zapp-text hover:bg-zapp-hover"
          >
            {step === 1 ? "Cancelar" : (<><ChevronLeft className="h-4 w-4 mr-1" /> Voltar</>)}
          </Button>

          {done ? (
            <Button
              onClick={handleClose}
              className="bg-zapp-accent hover:bg-zapp-accent-hover text-white"
            >
              Fechar
            </Button>
          ) : step < 3 ? (
            <Button
              onClick={() => setStep((s) => s + 1)}
              disabled={!canAdvance}
              className="bg-zapp-accent hover:bg-zapp-accent-hover text-white"
            >
              Próximo <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={submitting}
              className="bg-zapp-accent hover:bg-zapp-accent-hover text-white"
            >
              {submitting ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Criando...</>
              ) : (
                <>Concluir <Check className="h-4 w-4 ml-1" /></>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
