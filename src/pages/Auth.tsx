import { useState, useEffect } from "react";
import { Navigate, Link, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrendingUp, Loader2, AlertCircle, Info, ArrowLeft, CheckCircle, CreditCard, Phone } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PasswordStrength, validatePassword, usePasswordStrength } from "@/components/ui/password-strength";

export default function Auth() {
  const { user, loading, signIn, signUp, resetPassword } = useAuth();
  const [searchParams] = useSearchParams();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<"auth" | "forgot" | "reset">("auth");
  const [resetSent, setResetSent] = useState(false);
  const [passwordUpdated, setPasswordUpdated] = useState(false);

  // Login form state
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // Signup form state
  const [signupName, setSignupName] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPhone, setSignupPhone] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  
  // Post-signup payment state
  const [showPaymentSetup, setShowPaymentSetup] = useState(false);
  const [paymentStep, setPaymentStep] = useState<"loading" | "form" | "success" | "skip">("loading");

  // Reset password form state
  const [resetEmail, setResetEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Check if user came from password reset link
  useEffect(() => {
    const mode = searchParams.get("mode");
    if (mode === "reset") {
      setView("reset");
    }
  }, [searchParams]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (user && view !== "reset") {
    return <Navigate to="/dashboard" replace />;
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const { error } = await signIn(loginEmail, loginPassword);

    if (error) {
      setError("Email ou senha incorretos. Tente novamente.");
      toast.error("Falha ao fazer login");
    } else {
      toast.success("Login realizado com sucesso!");
    }

    setIsSubmitting(false);
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!signupPhone.trim()) {
      setError("O telefone é obrigatório.");
      return;
    }

    // Validate password strength
    const passwordValidation = validatePassword(signupPassword);
    if (!passwordValidation.isValid) {
      setError(passwordValidation.error);
      return;
    }

    setIsSubmitting(true);

    const { error } = await signUp(signupEmail, signupPassword, signupName, signupPhone);

    if (error) {
      if (error.message.includes("already registered")) {
        setError("Este email já está cadastrado. Tente fazer login.");
      } else {
        setError("Erro ao criar conta. Tente novamente.");
      }
      toast.error("Falha ao criar conta");
    } else {
      toast.success("Conta criada com sucesso!");
      // Show payment setup dialog after successful signup
      setShowPaymentSetup(true);
      setPaymentStep("form");
    }

    setIsSubmitting(false);
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const { error } = await resetPassword(resetEmail);

    if (error) {
      setError("Erro ao enviar email de recuperação. Verifique o email e tente novamente.");
      toast.error("Falha ao enviar email");
    } else {
      setResetSent(true);
      toast.success("Email de recuperação enviado!");
    }

    setIsSubmitting(false);
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate password strength
    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.isValid) {
      setError(passwordValidation.error);
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("As senhas não coincidem.");
      return;
    }

    setIsSubmitting(true);

    const { error } = await supabase.auth.updateUser({ password: newPassword });

    if (error) {
      setError("Erro ao atualizar senha. Tente novamente.");
      toast.error("Falha ao atualizar senha");
    } else {
      setPasswordUpdated(true);
      toast.success("Senha atualizada com sucesso!");
    }

    setIsSubmitting(false);
  };

  // Forgot password view
  if (view === "forgot") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary/5 rounded-full blur-3xl" />
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-primary/5 rounded-full blur-3xl" />
        </div>

        <div className="relative z-10 w-full max-w-md animate-fade-in">
          <div className="flex items-center justify-center gap-3 mb-8">
            <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-hero shadow-lg">
              <TrendingUp className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">ROY</h1>
              <p className="text-sm text-muted-foreground">Recuperar senha</p>
            </div>
          </div>

          <Card className="shadow-elevated border-border/50">
            <CardHeader>
              <CardTitle>Esqueceu sua senha?</CardTitle>
              <CardDescription>
                Digite seu email e enviaremos um link para redefinir sua senha.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {error && (
                <div className="flex items-center gap-2 p-3 mb-4 text-sm text-danger bg-danger-muted rounded-lg">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {resetSent ? (
                <div className="text-center space-y-4">
                  <div className="flex items-center justify-center">
                    <div className="h-12 w-12 rounded-full bg-success/10 flex items-center justify-center">
                      <CheckCircle className="h-6 w-6 text-success" />
                    </div>
                  </div>
                  <div>
                    <h3 className="font-semibold">Email enviado!</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Verifique sua caixa de entrada e clique no link para redefinir sua senha.
                    </p>
                  </div>
                  <Button 
                    variant="outline" 
                    className="w-full"
                    onClick={() => {
                      setView("auth");
                      setResetSent(false);
                      setResetEmail("");
                    }}
                  >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Voltar ao login
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleForgotPassword} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="reset-email">Email</Label>
                    <Input
                      id="reset-email"
                      type="email"
                      placeholder="seu@email.com"
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      required
                      disabled={isSubmitting}
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={isSubmitting}>
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Enviando...
                      </>
                    ) : (
                      "Enviar link de recuperação"
                    )}
                  </Button>
                  <Button 
                    type="button"
                    variant="ghost" 
                    className="w-full"
                    onClick={() => {
                      setView("auth");
                      setError(null);
                    }}
                  >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Voltar ao login
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Reset password view (when user clicks the link in email)
  if (view === "reset") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary/5 rounded-full blur-3xl" />
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-primary/5 rounded-full blur-3xl" />
        </div>

        <div className="relative z-10 w-full max-w-md animate-fade-in">
          <div className="flex items-center justify-center gap-3 mb-8">
            <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-hero shadow-lg">
              <TrendingUp className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">ROY</h1>
              <p className="text-sm text-muted-foreground">Redefinir senha</p>
            </div>
          </div>

          <Card className="shadow-elevated border-border/50">
            <CardHeader>
              <CardTitle>Criar nova senha</CardTitle>
              <CardDescription>
                Digite sua nova senha abaixo.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {error && (
                <div className="flex items-center gap-2 p-3 mb-4 text-sm text-danger bg-danger-muted rounded-lg">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {passwordUpdated ? (
                <div className="text-center space-y-4">
                  <div className="flex items-center justify-center">
                    <div className="h-12 w-12 rounded-full bg-success/10 flex items-center justify-center">
                      <CheckCircle className="h-6 w-6 text-success" />
                    </div>
                  </div>
                  <div>
                    <h3 className="font-semibold">Senha atualizada!</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Sua senha foi alterada com sucesso.
                    </p>
                  </div>
                  <Button 
                    className="w-full"
                    onClick={() => window.location.href = "/dashboard"}
                  >
                    Ir para o Dashboard
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleUpdatePassword} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="new-password">Nova senha</Label>
                    <Input
                      id="new-password"
                      type="password"
                      placeholder="Crie uma senha forte"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                      minLength={8}
                      disabled={isSubmitting}
                    />
                    <PasswordStrength password={newPassword} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirm-password">Confirmar senha</Label>
                    <Input
                      id="confirm-password"
                      type="password"
                      placeholder="Digite novamente"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      minLength={6}
                      disabled={isSubmitting}
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={isSubmitting}>
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Atualizando...
                      </>
                    ) : (
                      "Atualizar senha"
                    )}
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-primary/5 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-md animate-fade-in">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-hero shadow-lg">
            <TrendingUp className="h-6 w-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">ROY</h1>
            <p className="text-sm text-muted-foreground">Sua plataforma de encantamento</p>
          </div>
        </div>

        <Card className="shadow-elevated border-border/50">
          <Tabs defaultValue="login" className="w-full">
            <CardHeader className="pb-4">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login">Entrar</TabsTrigger>
                <TabsTrigger value="signup">Criar conta</TabsTrigger>
              </TabsList>
            </CardHeader>

            <CardContent>
              {error && (
                <div className="flex items-center gap-2 p-3 mb-4 text-sm text-danger bg-danger-muted rounded-lg">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <TabsContent value="login" className="mt-0">
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-email">Email</Label>
                    <Input
                      id="login-email"
                      type="email"
                      placeholder="seu@email.com"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      required
                      disabled={isSubmitting}
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="login-password">Senha</Label>
                      <Button
                        type="button"
                        variant="link"
                        className="px-0 h-auto text-xs text-muted-foreground hover:text-primary"
                        onClick={() => {
                          setView("forgot");
                          setError(null);
                        }}
                      >
                        Esqueceu a senha?
                      </Button>
                    </div>
                    <Input
                      id="login-password"
                      type="password"
                      placeholder="••••••••"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      required
                      disabled={isSubmitting}
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={isSubmitting}>
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Entrando...
                      </>
                    ) : (
                      "Entrar"
                    )}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="signup" className="mt-0">
                <form onSubmit={handleSignup} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-name">Nome</Label>
                    <Input
                      id="signup-name"
                      type="text"
                      placeholder="Seu nome"
                      value={signupName}
                      onChange={(e) => setSignupName(e.target.value)}
                      required
                      disabled={isSubmitting}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-email">Email</Label>
                    <Input
                      id="signup-email"
                      type="email"
                      placeholder="seu@email.com"
                      value={signupEmail}
                      onChange={(e) => setSignupEmail(e.target.value)}
                      required
                      disabled={isSubmitting}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-phone">Telefone</Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="signup-phone"
                        type="tel"
                        placeholder="(11) 99999-9999"
                        value={signupPhone}
                        onChange={(e) => setSignupPhone(e.target.value)}
                        required
                        disabled={isSubmitting}
                        className="pl-9"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Senha</Label>
                    <Input
                      id="signup-password"
                      type="password"
                      placeholder="Crie uma senha forte"
                      value={signupPassword}
                      onChange={(e) => setSignupPassword(e.target.value)}
                      required
                      minLength={8}
                      disabled={isSubmitting}
                    />
                    <PasswordStrength password={signupPassword} />
                  </div>
                  <Button type="submit" className="w-full" disabled={isSubmitting}>
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Criando conta...
                      </>
                    ) : (
                      "Criar conta"
                    )}
                  </Button>
                </form>
              </TabsContent>
            </CardContent>
          </Tabs>
        </Card>

        <p className="text-center text-sm text-muted-foreground mt-6">
          Encante seus clientes e meça o impacto em tempo real.
        </p>
        
        <Link 
          to="/sobre" 
          className="flex items-center justify-center gap-2 text-sm text-primary hover:underline mt-4"
        >
          <Info className="h-4 w-4" />
          Conheça mais sobre o ROY
        </Link>
      </div>

      {/* Payment Setup Dialog */}
      <Dialog open={showPaymentSetup} onOpenChange={(open) => {
        if (!open && paymentStep === "form") {
          // User is trying to close without setting up payment
          setPaymentStep("skip");
        }
        if (!open && (paymentStep === "success" || paymentStep === "skip")) {
          setShowPaymentSetup(false);
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-primary" />
              Configurar Pagamento
            </DialogTitle>
            <DialogDescription>
              {paymentStep === "form" && "Configure seu método de pagamento para aproveitar todos os recursos."}
              {paymentStep === "skip" && "Você pode configurar o pagamento depois nas configurações."}
              {paymentStep === "success" && "Cartão configurado com sucesso!"}
            </DialogDescription>
          </DialogHeader>

          {paymentStep === "form" && (
            <div className="space-y-4">
              <div className="p-4 bg-muted/50 rounded-lg space-y-3">
                <p className="text-sm text-muted-foreground">
                  Você está no período de teste gratuito. Configure seu cartão agora para não perder acesso quando o trial terminar.
                </p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <CheckCircle className="h-3.5 w-3.5 text-success" />
                  <span>Não cobramos nada durante o trial</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <CheckCircle className="h-3.5 w-3.5 text-success" />
                  <span>Cancele a qualquer momento</span>
                </div>
              </div>

              <div className="flex gap-2">
                <Button 
                  className="flex-1"
                  onClick={() => {
                    // Open Asaas payment link or redirect to settings
                    window.location.href = "/settings?tab=subscription";
                  }}
                >
                  <CreditCard className="h-4 w-4 mr-2" />
                  Configurar Cartão
                </Button>
              </div>

              <Button 
                variant="ghost" 
                className="w-full text-muted-foreground"
                onClick={() => setPaymentStep("skip")}
              >
                Configurar depois
              </Button>
            </div>
          )}

          {paymentStep === "skip" && (
            <div className="space-y-4">
              <div className="p-4 bg-warning/10 rounded-lg">
                <p className="text-sm">
                  Sem problemas! Você pode configurar o pagamento a qualquer momento em <strong>Configurações → Assinatura</strong>.
                </p>
              </div>
              <Button 
                className="w-full"
                onClick={() => {
                  setShowPaymentSetup(false);
                  window.location.href = "/dashboard";
                }}
              >
                Ir para o Dashboard
              </Button>
            </div>
          )}

          {paymentStep === "success" && (
            <div className="space-y-4">
              <div className="flex items-center justify-center">
                <div className="h-12 w-12 rounded-full bg-success/10 flex items-center justify-center">
                  <CheckCircle className="h-6 w-6 text-success" />
                </div>
              </div>
              <p className="text-center text-sm text-muted-foreground">
                Seu cartão foi configurado. Você não será cobrado durante o período de teste.
              </p>
              <Button 
                className="w-full"
                onClick={() => {
                  setShowPaymentSetup(false);
                  window.location.href = "/dashboard";
                }}
              >
                Ir para o Dashboard
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
