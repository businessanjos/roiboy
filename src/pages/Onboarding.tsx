import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { 
  Rocket, 
  Building2, 
  Users, 
  Settings, 
  CheckCircle,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Sparkles,
  UserPlus,
  Palette
} from "lucide-react";
import { LoadingScreen } from "@/components/ui/loading-screen";
import { Switch } from "@/components/ui/switch";

const TOTAL_STEPS = 4;

interface OnboardingData {
  accountName: string;
  welcomeMessage: string;
  enableAI: boolean;
  inviteEmails: string;
  primaryColor: string;
}

export default function Onboarding() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { currentUser, loading: userLoading } = useCurrentUser();
  const [currentStep, setCurrentStep] = useState(1);
  const [data, setData] = useState<OnboardingData>({
    accountName: "",
    welcomeMessage: "",
    enableAI: true,
    inviteEmails: "",
    primaryColor: "#3b82f6"
  });

  // Check onboarding status
  const { data: settings, isLoading: settingsLoading } = useQuery({
    queryKey: ["onboarding-settings", currentUser?.account_id],
    queryFn: async () => {
      if (!currentUser?.account_id) return null;
      const { data, error } = await supabase
        .from("account_settings")
        .select("onboarding_completed, onboarding_step")
        .eq("account_id", currentUser.account_id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!currentUser?.account_id
  });

  // Fetch account name
  const { data: account } = useQuery({
    queryKey: ["account", currentUser?.account_id],
    queryFn: async () => {
      if (!currentUser?.account_id) return null;
      const { data, error } = await supabase
        .from("accounts")
        .select("name")
        .eq("id", currentUser.account_id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!currentUser?.account_id
  });

  useEffect(() => {
    if (account?.name) {
      setData(prev => ({ ...prev, accountName: account.name }));
    }
  }, [account]);

  useEffect(() => {
    if (settings?.onboarding_completed) {
      navigate("/dashboard");
    } else if (settings?.onboarding_step) {
      setCurrentStep(settings.onboarding_step);
    }
  }, [settings, navigate]);

  const updateStepMutation = useMutation({
    mutationFn: async (step: number) => {
      if (!currentUser?.account_id) return;
      await supabase
        .from("account_settings")
        .update({ onboarding_step: step })
        .eq("account_id", currentUser.account_id);
    }
  });

  const completeMutation = useMutation({
    mutationFn: async () => {
      if (!currentUser?.account_id) throw new Error("No account");

      // Update account name
      await supabase
        .from("accounts")
        .update({ name: data.accountName })
        .eq("id", currentUser.account_id);

      // Update settings
      await supabase
        .from("account_settings")
        .update({
          ai_auto_analysis_enabled: data.enableAI,
          onboarding_completed: true,
          onboarding_completed_at: new Date().toISOString(),
          onboarding_step: TOTAL_STEPS
        })
        .eq("account_id", currentUser.account_id);

      // Send invites if any
      if (data.inviteEmails.trim()) {
        const emails = data.inviteEmails.split(",").map(e => e.trim()).filter(Boolean);
        // TODO: Implement invite logic via edge function
        console.log("Would invite:", emails);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["onboarding-settings"] });
      toast.success("Configuração concluída! Bem-vindo ao sistema.");
      navigate("/dashboard");
    },
    onError: (error) => {
      toast.error("Erro ao concluir: " + error.message);
    }
  });

  const nextStep = () => {
    if (currentStep < TOTAL_STEPS) {
      const newStep = currentStep + 1;
      setCurrentStep(newStep);
      updateStepMutation.mutate(newStep);
    } else {
      completeMutation.mutate();
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      const newStep = currentStep - 1;
      setCurrentStep(newStep);
      updateStepMutation.mutate(newStep);
    }
  };

  if (userLoading || settingsLoading) {
    return <LoadingScreen message="Preparando onboarding..." />;
  }

  const progress = (currentStep / TOTAL_STEPS) * 100;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-4">
            <Rocket className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Configuração Inicial</h1>
          <p className="text-muted-foreground mt-2">
            Vamos configurar sua conta em poucos passos
          </p>
        </div>

        {/* Progress */}
        <div className="mb-8">
          <div className="flex justify-between text-sm text-muted-foreground mb-2">
            <span>Passo {currentStep} de {TOTAL_STEPS}</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {/* Steps indicator */}
        <div className="flex justify-center gap-2 mb-8">
          {[1, 2, 3, 4].map((step) => (
            <div
              key={step}
              className={`flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all ${
                step === currentStep
                  ? "border-primary bg-primary text-primary-foreground"
                  : step < currentStep
                  ? "border-primary bg-primary/20 text-primary"
                  : "border-muted bg-muted/50 text-muted-foreground"
              }`}
            >
              {step < currentStep ? (
                <CheckCircle className="h-5 w-5" />
              ) : step === 1 ? (
                <Building2 className="h-4 w-4" />
              ) : step === 2 ? (
                <Sparkles className="h-4 w-4" />
              ) : step === 3 ? (
                <UserPlus className="h-4 w-4" />
              ) : (
                <CheckCircle className="h-4 w-4" />
              )}
            </div>
          ))}
        </div>

        {/* Content Card */}
        <Card className="border-0 shadow-lg">
          <CardContent className="p-8">
            {currentStep === 1 && (
              <Step1
                data={data}
                onChange={(updates) => setData({ ...data, ...updates })}
              />
            )}
            {currentStep === 2 && (
              <Step2
                data={data}
                onChange={(updates) => setData({ ...data, ...updates })}
              />
            )}
            {currentStep === 3 && (
              <Step3
                data={data}
                onChange={(updates) => setData({ ...data, ...updates })}
              />
            )}
            {currentStep === 4 && (
              <Step4 data={data} />
            )}

            {/* Navigation */}
            <div className="flex justify-between mt-8 pt-6 border-t">
              <Button
                variant="outline"
                onClick={prevStep}
                disabled={currentStep === 1}
                className="gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Voltar
              </Button>
              <Button
                onClick={nextStep}
                disabled={completeMutation.isPending}
                className="gap-2"
              >
                {completeMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                {currentStep === TOTAL_STEPS ? "Concluir" : "Próximo"}
                {currentStep !== TOTAL_STEPS && <ArrowRight className="h-4 w-4" />}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Skip link */}
        <div className="text-center mt-6">
          <Button
            variant="link"
            className="text-muted-foreground"
            onClick={() => completeMutation.mutate()}
          >
            Pular configuração e ir para o dashboard
          </Button>
        </div>
      </div>
    </div>
  );
}

// Step 1: Account Info
function Step1({ 
  data, 
  onChange 
}: { 
  data: OnboardingData; 
  onChange: (updates: Partial<OnboardingData>) => void;
}) {
  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-blue-500/10 mb-3">
          <Building2 className="h-6 w-6 text-blue-500" />
        </div>
        <h2 className="text-xl font-semibold">Informações da Conta</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Configure os dados básicos da sua empresa
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <Label htmlFor="accountName">Nome da Empresa/Conta</Label>
          <Input
            id="accountName"
            value={data.accountName}
            onChange={(e) => onChange({ accountName: e.target.value })}
            placeholder="Ex: Minha Empresa"
            className="mt-1.5"
          />
        </div>

        <div>
          <Label htmlFor="welcomeMessage">Mensagem de Boas-vindas (opcional)</Label>
          <Textarea
            id="welcomeMessage"
            value={data.welcomeMessage}
            onChange={(e) => onChange({ welcomeMessage: e.target.value })}
            placeholder="Uma mensagem que aparecerá para novos membros da equipe..."
            className="mt-1.5 min-h-[100px]"
          />
        </div>
      </div>
    </div>
  );
}

// Step 2: AI & Features
function Step2({ 
  data, 
  onChange 
}: { 
  data: OnboardingData; 
  onChange: (updates: Partial<OnboardingData>) => void;
}) {
  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-purple-500/10 mb-3">
          <Sparkles className="h-6 w-6 text-purple-500" />
        </div>
        <h2 className="text-xl font-semibold">Recursos e IA</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Configure os recursos inteligentes do sistema
        </p>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/30">
          <div className="flex-1">
            <p className="font-medium">Análise de IA Automática</p>
            <p className="text-sm text-muted-foreground">
              Analisa mensagens automaticamente para detectar ROI, riscos e eventos de vida
            </p>
          </div>
          <Switch
            checked={data.enableAI}
            onCheckedChange={(checked) => onChange({ enableAI: checked })}
          />
        </div>

        <div className="p-4 rounded-lg border bg-gradient-to-r from-purple-500/5 to-blue-500/5">
          <div className="flex items-start gap-3">
            <Sparkles className="h-5 w-5 text-purple-500 mt-0.5" />
            <div>
              <p className="font-medium text-sm">Recursos de IA incluem:</p>
              <ul className="text-sm text-muted-foreground mt-2 space-y-1">
                <li>• Detecção automática de percepção de ROI</li>
                <li>• Alertas de risco de churn</li>
                <li>• Identificação de eventos de vida importantes</li>
                <li>• Recomendações de ação personalizadas</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Step 3: Team Invites
function Step3({ 
  data, 
  onChange 
}: { 
  data: OnboardingData; 
  onChange: (updates: Partial<OnboardingData>) => void;
}) {
  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-green-500/10 mb-3">
          <UserPlus className="h-6 w-6 text-green-500" />
        </div>
        <h2 className="text-xl font-semibold">Convide sua Equipe</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Adicione membros da equipe para colaborar
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <Label htmlFor="inviteEmails">E-mails para Convidar</Label>
          <Textarea
            id="inviteEmails"
            value={data.inviteEmails}
            onChange={(e) => onChange({ inviteEmails: e.target.value })}
            placeholder="email1@empresa.com, email2@empresa.com"
            className="mt-1.5 min-h-[100px]"
          />
          <p className="text-xs text-muted-foreground mt-1.5">
            Separe múltiplos e-mails por vírgula. Você pode convidar mais pessoas depois.
          </p>
        </div>

        <div className="p-4 rounded-lg border bg-muted/30">
          <div className="flex items-start gap-3">
            <Users className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div>
              <p className="text-sm text-muted-foreground">
                Os convidados receberão um e-mail com instruções para criar suas contas 
                e acessar o sistema.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Step 4: Confirmation
function Step4({ data }: { data: OnboardingData }) {
  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-emerald-500/10 mb-3">
          <CheckCircle className="h-6 w-6 text-emerald-500" />
        </div>
        <h2 className="text-xl font-semibold">Tudo Pronto!</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Revise suas configurações antes de finalizar
        </p>
      </div>

      <div className="space-y-3">
        <div className="p-4 rounded-lg border">
          <div className="flex items-center gap-3">
            <Building2 className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-sm text-muted-foreground">Nome da Conta</p>
              <p className="font-medium">{data.accountName || "Não definido"}</p>
            </div>
          </div>
        </div>

        <div className="p-4 rounded-lg border">
          <div className="flex items-center gap-3">
            <Sparkles className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-sm text-muted-foreground">Análise de IA</p>
              <p className="font-medium">{data.enableAI ? "Ativada" : "Desativada"}</p>
            </div>
          </div>
        </div>

        {data.inviteEmails && (
          <div className="p-4 rounded-lg border">
            <div className="flex items-center gap-3">
              <UserPlus className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Convites</p>
                <p className="font-medium">
                  {data.inviteEmails.split(",").filter(e => e.trim()).length} pessoa(s)
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="p-4 rounded-lg bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20">
        <p className="text-sm text-center">
          Clique em <strong>Concluir</strong> para salvar e acessar o dashboard
        </p>
      </div>
    </div>
  );
}
