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
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Rocket, 
  Building2, 
  Users, 
  CheckCircle,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Sparkles,
  UserPlus,
  Package,
  Calendar,
  Phone,
  Mail,
  DollarSign,
  Clock,
  MapPin,
  Video,
  User,
  Trophy,
  Star,
  Target,
  Zap,
  Crown,
  Heart
} from "lucide-react";
import { LoadingScreen } from "@/components/ui/loading-screen";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { OnboardingProgress } from "@/components/onboarding/OnboardingProgress";
import { RoyAssistant, ONBOARDING_MESSAGES } from "@/components/onboarding/RoyAssistant";

const TOTAL_STEPS = 6;

interface OnboardingData {
  // Step 1: Account
  accountName: string;
  welcomeMessage: string;
  
  // Step 2: AI Settings
  enableAI: boolean;
  
  // Step 3: First Client
  clientName: string;
  clientPhone: string;
  clientEmail: string;
  
  // Step 4: First Product
  productName: string;
  productDescription: string;
  productPrice: string;
  
  // Step 5: First Event
  eventTitle: string;
  eventType: string;
  eventModality: string;
  eventDate: string;
  eventTime: string;
  eventMeetingUrl: string;
  eventAddress: string;
  
  // Step 6: Team (optional)
  inviteEmails: string;
}

interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  unlocked: boolean;
}

export default function Onboarding() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { currentUser, loading: userLoading } = useCurrentUser();
  const [currentStep, setCurrentStep] = useState(1);
  const [skippedSteps, setSkippedSteps] = useState<number[]>([]);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [royMinimized, setRoyMinimized] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [data, setData] = useState<OnboardingData>({
    accountName: "",
    welcomeMessage: "",
    enableAI: true,
    clientName: "",
    clientPhone: "",
    clientEmail: "",
    productName: "",
    productDescription: "",
    productPrice: "",
    eventTitle: "",
    eventType: "live",
    eventModality: "online",
    eventDate: "",
    eventTime: "",
    eventMeetingUrl: "",
    eventAddress: "",
    inviteEmails: ""
  });

  // Achievements system
  const achievements: Achievement[] = [
    {
      id: "first_step",
      title: "Primeiros Passos",
      description: "Completou a configuração da conta",
      icon: Star,
      unlocked: completedSteps.includes(1)
    },
    {
      id: "ai_master",
      title: "Mestre da IA",
      description: "Configurou a inteligência artificial",
      icon: Zap,
      unlocked: completedSteps.includes(2)
    },
    {
      id: "first_client",
      title: "Primeiro Cliente",
      description: "Cadastrou seu primeiro cliente",
      icon: Target,
      unlocked: completedSteps.includes(3) && !skippedSteps.includes(3)
    },
    {
      id: "product_pro",
      title: "Catálogo Iniciado",
      description: "Cadastrou seu primeiro produto",
      icon: Package,
      unlocked: completedSteps.includes(4) && !skippedSteps.includes(4)
    },
    {
      id: "event_planner",
      title: "Organizador",
      description: "Criou seu primeiro evento",
      icon: Calendar,
      unlocked: completedSteps.includes(5) && !skippedSteps.includes(5)
    },
    {
      id: "team_builder",
      title: "Líder de Equipe",
      description: "Convidou membros para a equipe",
      icon: Crown,
      unlocked: completedSteps.includes(6) && !skippedSteps.includes(6) && data.inviteEmails.trim().length > 0
    }
  ];

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
      // Mark previous steps as completed
      const completed = Array.from({ length: settings.onboarding_step - 1 }, (_, i) => i + 1);
      setCompletedSteps(completed);
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

      // Create first client if provided
      if (data.clientName && data.clientPhone && !skippedSteps.includes(3)) {
        const phone = data.clientPhone.replace(/\D/g, "");
        const phoneE164 = phone.startsWith("55") ? `+${phone}` : `+55${phone}`;
        
        await supabase
          .from("clients")
          .insert({
            account_id: currentUser.account_id,
            full_name: data.clientName,
            phone_e164: phoneE164,
            emails: data.clientEmail ? [{ email: data.clientEmail, type: "main" }] : [],
            status: "active"
          });
      }

      // Create first product if provided
      if (data.productName && !skippedSteps.includes(4)) {
        await supabase
          .from("products")
          .insert({
            account_id: currentUser.account_id,
            name: data.productName,
            description: data.productDescription || null,
            price: data.productPrice ? parseFloat(data.productPrice.replace(/[^\d.,]/g, "").replace(",", ".")) : 0,
            is_active: true
          });
      }

      // Create first event if provided
      if (data.eventTitle && data.eventDate && !skippedSteps.includes(5)) {
        const scheduledAt = data.eventTime 
          ? new Date(`${data.eventDate}T${data.eventTime}:00`)
          : new Date(`${data.eventDate}T09:00:00`);
        
        await supabase
          .from("events")
          .insert({
            account_id: currentUser.account_id,
            title: data.eventTitle,
            event_type: data.eventType as any,
            modality: data.eventModality as any,
            scheduled_at: scheduledAt.toISOString(),
            meeting_url: data.eventModality === "online" ? data.eventMeetingUrl : null,
            address: data.eventModality === "presential" ? data.eventAddress : null
          });
      }

      // TODO: Implement invite logic
      if (data.inviteEmails.trim() && !skippedSteps.includes(6)) {
        const emails = data.inviteEmails.split(",").map(e => e.trim()).filter(Boolean);
        console.log("Would invite:", emails);
      }
    },
    onSuccess: () => {
      setShowCelebration(true);
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["onboarding-settings"] });
        toast.success("Configuração concluída! Bem-vindo ao Roy.");
        navigate("/dashboard");
      }, 2000);
    },
    onError: (error) => {
      toast.error("Erro ao concluir: " + error.message);
    }
  });

  const nextStep = () => {
    // Mark current step as completed
    if (!completedSteps.includes(currentStep)) {
      setCompletedSteps(prev => [...prev, currentStep]);
    }

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

  const skipStep = () => {
    setSkippedSteps(prev => [...prev, currentStep]);
    if (!completedSteps.includes(currentStep)) {
      setCompletedSteps(prev => [...prev, currentStep]);
    }
    nextStep();
  };

  const canSkip = currentStep >= 3 && currentStep <= 6;

  if (userLoading || settingsLoading) {
    return <LoadingScreen message="Preparando onboarding..." />;
  }

  const stepIcons = [Building2, Sparkles, User, Package, Calendar, UserPlus];
  const stepLabels = ["Conta", "IA", "Cliente", "Produto", "Evento", "Equipe"];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Celebration confetti */}
      <AnimatePresence>
        {showCelebration && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 pointer-events-none z-50"
          >
            {Array.from({ length: 50 }).map((_, i) => (
              <motion.div
                key={i}
                initial={{ 
                  x: Math.random() * window.innerWidth, 
                  y: window.innerHeight + 20,
                  rotate: 0,
                  scale: Math.random() * 0.5 + 0.5
                }}
                animate={{ 
                  y: -20, 
                  rotate: Math.random() * 720,
                  transition: { 
                    duration: 2 + Math.random() * 2,
                    ease: "easeOut",
                    delay: Math.random() * 0.5
                  }
                }}
                className="absolute w-3 h-3 rounded-full"
                style={{
                  backgroundColor: ['#d2ae6d', '#506767', '#ef4444', '#22c55e', '#3b82f6'][Math.floor(Math.random() * 5)]
                }}
              />
            ))}
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.5, type: "spring" }}
              className="absolute inset-0 flex items-center justify-center"
            >
              <div className="bg-background/95 rounded-2xl p-8 text-center shadow-elevated">
                <motion.div
                  animate={{ rotate: [0, -10, 10, -10, 0] }}
                  transition={{ duration: 0.5, delay: 0.8 }}
                >
                  <Trophy className="h-16 w-16 text-primary mx-auto mb-4" />
                </motion.div>
                <h2 className="text-2xl font-bold mb-2">Parabéns!</h2>
                <p className="text-muted-foreground">Sua conta está pronta para uso</p>
                <div className="flex justify-center gap-2 mt-4">
                  {achievements.filter(a => a.unlocked).map(a => (
                    <div 
                      key={a.id}
                      className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-white"
                    >
                      <a.icon className="h-4 w-4" />
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="w-full max-w-3xl">
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-6"
        >
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-4">
            <Rocket className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Bem-vindo ao Roy</h1>
          <p className="text-muted-foreground mt-2">
            Vamos configurar sua conta e criar seus primeiros cadastros
          </p>
        </motion.div>

        {/* Roy Assistant */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="mb-6"
        >
          <RoyAssistant
            step={currentStep}
            messages={ONBOARDING_MESSAGES}
            minimized={royMinimized}
            onToggle={() => setRoyMinimized(!royMinimized)}
          />
        </motion.div>

        {/* Progress with achievements */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mb-6"
        >
          <OnboardingProgress
            currentStep={currentStep}
            totalSteps={TOTAL_STEPS}
            completedSteps={completedSteps}
            skippedSteps={skippedSteps}
            stepLabels={stepLabels}
            stepIcons={stepIcons}
            achievements={achievements}
          />
        </motion.div>

        {/* Content Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Card className="border-0 shadow-lg overflow-hidden">
            <CardContent className="p-8">
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentStep}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
                >
                  {currentStep === 1 && (
                    <StepAccount
                      data={data}
                      onChange={(updates) => setData({ ...data, ...updates })}
                    />
                  )}
                  {currentStep === 2 && (
                    <StepAI
                      data={data}
                      onChange={(updates) => setData({ ...data, ...updates })}
                    />
                  )}
                  {currentStep === 3 && (
                    <StepClient
                      data={data}
                      onChange={(updates) => setData({ ...data, ...updates })}
                    />
                  )}
                  {currentStep === 4 && (
                    <StepProduct
                      data={data}
                      onChange={(updates) => setData({ ...data, ...updates })}
                    />
                  )}
                  {currentStep === 5 && (
                    <StepEvent
                      data={data}
                      onChange={(updates) => setData({ ...data, ...updates })}
                    />
                  )}
                  {currentStep === 6 && (
                    <StepTeam
                      data={data}
                      onChange={(updates) => setData({ ...data, ...updates })}
                    />
                  )}
                </motion.div>
              </AnimatePresence>

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
                <div className="flex gap-2">
                  {canSkip && (
                    <Button
                      variant="ghost"
                      onClick={skipStep}
                      className="text-muted-foreground"
                    >
                      Pular
                    </Button>
                  )}
                  <Button
                    onClick={nextStep}
                    disabled={completeMutation.isPending}
                    className="gap-2"
                  >
                    {completeMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                    {currentStep === TOTAL_STEPS ? (
                      <>
                        <Trophy className="h-4 w-4" />
                        Concluir
                      </>
                    ) : (
                      <>
                        Próximo
                        <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Skip all link */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-center mt-6"
        >
          <Button
            variant="link"
            className="text-muted-foreground"
            onClick={() => completeMutation.mutate()}
          >
            Pular configuração e ir para o dashboard
          </Button>
        </motion.div>
      </div>
    </div>
  );
}

// Step 1: Account Info
function StepAccount({ 
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
          <Label htmlFor="accountName">Nome da Empresa/Conta *</Label>
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
            className="mt-1.5 min-h-[80px]"
          />
        </div>
      </div>
    </div>
  );
}

// Step 2: AI Settings
function StepAI({ 
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
        <h2 className="text-xl font-semibold">Inteligência Artificial</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Configure os recursos inteligentes do sistema
        </p>
      </div>

      <div className="space-y-4">
        <motion.div 
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="flex items-center justify-between p-4 rounded-lg border bg-muted/30"
        >
          <div className="flex-1">
            <p className="font-medium">Análise de IA Automática</p>
            <p className="text-sm text-muted-foreground">
              Analisa mensagens para detectar ROI, riscos e eventos de vida
            </p>
          </div>
          <Switch
            checked={data.enableAI}
            onCheckedChange={(checked) => onChange({ enableAI: checked })}
          />
        </motion.div>

        <motion.div 
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="p-4 rounded-lg border bg-gradient-to-r from-purple-500/5 to-blue-500/5"
        >
          <div className="flex items-start gap-3">
            <Sparkles className="h-5 w-5 text-purple-500 mt-0.5" />
            <div>
              <p className="font-medium text-sm">Recursos de IA incluem:</p>
              <ul className="text-sm text-muted-foreground mt-2 space-y-1">
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-3 w-3 text-green-500" />
                  Detecção automática de percepção de ROI
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-3 w-3 text-green-500" />
                  Alertas de risco de churn
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-3 w-3 text-green-500" />
                  Identificação de eventos de vida importantes
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-3 w-3 text-green-500" />
                  Recomendações de ação personalizadas
                </li>
              </ul>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

// Step 3: First Client
function StepClient({ 
  data, 
  onChange 
}: { 
  data: OnboardingData; 
  onChange: (updates: Partial<OnboardingData>) => void;
}) {
  const formatPhone = (value: string) => {
    const numbers = value.replace(/\D/g, "");
    if (numbers.length <= 2) return numbers;
    if (numbers.length <= 7) return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
    if (numbers.length <= 11) return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7)}`;
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`;
  };

  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-green-500/10 mb-3">
          <User className="h-6 w-6 text-green-500" />
        </div>
        <h2 className="text-xl font-semibold">Seu Primeiro Cliente</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Cadastre seu primeiro cliente para começar
        </p>
      </div>

      <div className="space-y-4">
        <motion.div
          initial={{ x: -10, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
        >
          <Label htmlFor="clientName" className="flex items-center gap-2">
            <User className="h-4 w-4" />
            Nome Completo *
          </Label>
          <Input
            id="clientName"
            value={data.clientName}
            onChange={(e) => onChange({ clientName: e.target.value })}
            placeholder="Ex: João da Silva"
            className="mt-1.5"
          />
        </motion.div>

        <motion.div
          initial={{ x: -10, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
        >
          <Label htmlFor="clientPhone" className="flex items-center gap-2">
            <Phone className="h-4 w-4" />
            WhatsApp *
          </Label>
          <Input
            id="clientPhone"
            value={data.clientPhone}
            onChange={(e) => onChange({ clientPhone: formatPhone(e.target.value) })}
            placeholder="(11) 99999-9999"
            className="mt-1.5"
          />
        </motion.div>

        <motion.div
          initial={{ x: -10, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <Label htmlFor="clientEmail" className="flex items-center gap-2">
            <Mail className="h-4 w-4" />
            E-mail (opcional)
          </Label>
          <Input
            id="clientEmail"
            type="email"
            value={data.clientEmail}
            onChange={(e) => onChange({ clientEmail: e.target.value })}
            placeholder="email@exemplo.com"
            className="mt-1.5"
          />
        </motion.div>
      </div>

      <motion.div 
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="p-4 rounded-lg border bg-muted/30"
      >
        <p className="text-sm text-muted-foreground">
          💡 Você pode importar mais clientes em massa depois via CSV
        </p>
      </motion.div>
    </div>
  );
}

// Step 4: First Product
function StepProduct({ 
  data, 
  onChange 
}: { 
  data: OnboardingData; 
  onChange: (updates: Partial<OnboardingData>) => void;
}) {
  const formatCurrency = (value: string) => {
    const numbers = value.replace(/\D/g, "");
    if (!numbers) return "";
    const amount = parseFloat(numbers) / 100;
    return amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  };

  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-orange-500/10 mb-3">
          <Package className="h-6 w-6 text-orange-500" />
        </div>
        <h2 className="text-xl font-semibold">Seu Primeiro Produto</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Cadastre um produto ou serviço que você oferece
        </p>
      </div>

      <div className="space-y-4">
        <motion.div
          initial={{ x: -10, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
        >
          <Label htmlFor="productName" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            Nome do Produto/Serviço *
          </Label>
          <Input
            id="productName"
            value={data.productName}
            onChange={(e) => onChange({ productName: e.target.value })}
            placeholder="Ex: Mentoria Premium, Curso de Vendas..."
            className="mt-1.5"
          />
        </motion.div>

        <motion.div
          initial={{ x: -10, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
        >
          <Label htmlFor="productDescription">Descrição (opcional)</Label>
          <Textarea
            id="productDescription"
            value={data.productDescription}
            onChange={(e) => onChange({ productDescription: e.target.value })}
            placeholder="Uma breve descrição do produto..."
            className="mt-1.5 min-h-[80px]"
          />
        </motion.div>

        <motion.div
          initial={{ x: -10, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <Label htmlFor="productPrice" className="flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Preço (opcional)
          </Label>
          <Input
            id="productPrice"
            value={data.productPrice}
            onChange={(e) => onChange({ productPrice: formatCurrency(e.target.value) })}
            placeholder="R$ 0,00"
            className="mt-1.5"
          />
        </motion.div>
      </div>
    </div>
  );
}

// Step 5: First Event
function StepEvent({ 
  data, 
  onChange 
}: { 
  data: OnboardingData; 
  onChange: (updates: Partial<OnboardingData>) => void;
}) {
  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-indigo-500/10 mb-3">
          <Calendar className="h-6 w-6 text-indigo-500" />
        </div>
        <h2 className="text-xl font-semibold">Seu Primeiro Evento</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Agende uma live, encontro ou reunião
        </p>
      </div>

      <div className="space-y-4">
        <motion.div
          initial={{ x: -10, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
        >
          <Label htmlFor="eventTitle">Título do Evento *</Label>
          <Input
            id="eventTitle"
            value={data.eventTitle}
            onChange={(e) => onChange({ eventTitle: e.target.value })}
            placeholder="Ex: Live de Boas-vindas, Mentoria em Grupo..."
            className="mt-1.5"
          />
        </motion.div>

        <motion.div
          initial={{ x: -10, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-2 gap-4"
        >
          <div>
            <Label>Tipo</Label>
            <Select
              value={data.eventType}
              onValueChange={(value) => onChange({ eventType: value })}
            >
              <SelectTrigger className="mt-1.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="live">Live</SelectItem>
                <SelectItem value="meeting">Reunião</SelectItem>
                <SelectItem value="workshop">Workshop</SelectItem>
                <SelectItem value="course">Aula</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Modalidade</Label>
            <Select
              value={data.eventModality}
              onValueChange={(value) => onChange({ eventModality: value })}
            >
              <SelectTrigger className="mt-1.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="online">Online</SelectItem>
                <SelectItem value="presential">Presencial</SelectItem>
                <SelectItem value="hybrid">Híbrido</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </motion.div>

        <motion.div
          initial={{ x: -10, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="grid grid-cols-2 gap-4"
        >
          <div>
            <Label htmlFor="eventDate" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Data *
            </Label>
            <Input
              id="eventDate"
              type="date"
              value={data.eventDate}
              onChange={(e) => onChange({ eventDate: e.target.value })}
              className="mt-1.5"
            />
          </div>

          <div>
            <Label htmlFor="eventTime" className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Horário
            </Label>
            <Input
              id="eventTime"
              type="time"
              value={data.eventTime}
              onChange={(e) => onChange({ eventTime: e.target.value })}
              className="mt-1.5"
            />
          </div>
        </motion.div>

        {data.eventModality === "online" || data.eventModality === "hybrid" ? (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
          >
            <Label htmlFor="eventMeetingUrl" className="flex items-center gap-2">
              <Video className="h-4 w-4" />
              Link da Reunião (opcional)
            </Label>
            <Input
              id="eventMeetingUrl"
              value={data.eventMeetingUrl}
              onChange={(e) => onChange({ eventMeetingUrl: e.target.value })}
              placeholder="https://meet.google.com/..."
              className="mt-1.5"
            />
          </motion.div>
        ) : null}

        {data.eventModality === "presential" || data.eventModality === "hybrid" ? (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
          >
            <Label htmlFor="eventAddress" className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Endereço (opcional)
            </Label>
            <Input
              id="eventAddress"
              value={data.eventAddress}
              onChange={(e) => onChange({ eventAddress: e.target.value })}
              placeholder="Rua, número, cidade..."
              className="mt-1.5"
            />
          </motion.div>
        ) : null}
      </div>
    </div>
  );
}

// Step 6: Team Invites
function StepTeam({ 
  data, 
  onChange 
}: { 
  data: OnboardingData; 
  onChange: (updates: Partial<OnboardingData>) => void;
}) {
  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-cyan-500/10 mb-3">
          <UserPlus className="h-6 w-6 text-cyan-500" />
        </div>
        <h2 className="text-xl font-semibold">Convide sua Equipe</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Adicione membros da equipe para colaborar
        </p>
      </div>

      <div className="space-y-4">
        <motion.div
          initial={{ x: -10, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
        >
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
        </motion.div>

        <motion.div 
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="p-4 rounded-lg border bg-muted/30"
        >
          <div className="flex items-start gap-3">
            <Users className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div>
              <p className="text-sm text-muted-foreground">
                Os convidados receberão um e-mail com instruções para criar suas contas.
              </p>
            </div>
          </div>
        </motion.div>
      </div>

      <motion.div 
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="p-4 rounded-lg bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20"
      >
        <div className="flex items-center gap-3">
          <Trophy className="h-5 w-5 text-primary" />
          <p className="text-sm">
            Clique em <strong>Concluir</strong> para salvar tudo e acessar o dashboard
          </p>
        </div>
      </motion.div>
    </div>
  );
}
