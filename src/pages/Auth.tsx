import { useState, useEffect } from "react";
import { Navigate, Link, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "@/hooks/useAuth";
import { useLoginSecurity } from "@/hooks/useLoginSecurity";
import { useSecurityAudit } from "@/hooks/useSecurityAudit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, AlertCircle, ArrowLeft, CheckCircle, CreditCard, Phone, ShieldAlert, Lock, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PasswordStrength, validatePassword, usePasswordStrength } from "@/components/ui/password-strength";
import { LoadingScreen } from "@/components/ui/loading-screen";
import { RoyLogo } from "@/components/ui/roy-logo";
import { Separator } from "@/components/ui/separator";
import { 
  loginFormSchema, 
  signupFormSchema, 
  LoginFormData, 
  SignupFormData,
  SECURITY_LIMITS 
} from "@/lib/security-validators";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

export default function Auth() {
  const { user, loading, signIn, signInWithGoogle, signUp, resetPassword } = useAuth();
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get("tab") === "signup" ? "signup" : "login";
  
  // Security hooks - MUST be called before any early returns
  const { checkAccountLock, recordLoginAttempt, registerSession, isCheckingLock } = useLoginSecurity();
  const { logLoginSuccess, logLoginFailure, logLoginBlocked, logSignupSuccess } = useSecurityAudit();
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<"auth" | "forgot" | "reset">("auth");
  const [resetSent, setResetSent] = useState(false);
  const [passwordUpdated, setPasswordUpdated] = useState(false);
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // React Hook Form with Zod validation - Login
  const loginForm = useForm<LoginFormData>({
    resolver: zodResolver(loginFormSchema),
    defaultValues: { email: "", password: "" },
    mode: "onBlur",
  });

  // React Hook Form with Zod validation - Signup
  const signupForm = useForm<SignupFormData>({
    resolver: zodResolver(signupFormSchema),
    defaultValues: { name: "", email: "", phone: "", password: "" },
    mode: "onBlur",
  });
  
  // Post-signup payment state
  const [showPaymentSetup, setShowPaymentSetup] = useState(false);
  const [paymentStep, setPaymentStep] = useState<"loading" | "form" | "success" | "skip">("loading");

  // Reset password form state
  const [resetEmail, setResetEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  
  // Security state
  const [isAccountLocked, setIsAccountLocked] = useState(false);
  const [lockoutMinutes, setLockoutMinutes] = useState(0);
  const [remainingAttempts, setRemainingAttempts] = useState(5);

  // Check if user came from password reset link
  useEffect(() => {
    const mode = searchParams.get("mode");
    if (mode === "reset") {
      setView("reset");
    }
  }, [searchParams]);

  if (loading) {
    return <LoadingScreen message="Carregando..." />;
  }

  if (user && view !== "reset") {
    return <Navigate to="/dashboard" replace />;
  }

  const handleLogin = async (data: LoginFormData) => {
    setError(null);
    setIsSubmitting(true);

    // Check if account is locked
    const lockStatus = await checkAccountLock(data.email);
    if (lockStatus.isLocked) {
      setIsAccountLocked(true);
      setLockoutMinutes(lockStatus.lockoutMinutes);
      setError(`Conta bloqueada temporariamente. Tente novamente em ${lockStatus.lockoutMinutes} minutos.`);
      logLoginBlocked(data.email);
      setIsSubmitting(false);
      return;
    }

    setRemainingAttempts(lockStatus.remainingAttempts);

    const { error } = await signIn(data.email, data.password);

    if (error) {
      await recordLoginAttempt(data.email, false);
      logLoginFailure(error.message);
      
      const newRemainingAttempts = remainingAttempts - 1;
      setRemainingAttempts(newRemainingAttempts);
      
      if (newRemainingAttempts <= 2 && newRemainingAttempts > 0) {
        setError(`Email ou senha incorretos. ${newRemainingAttempts} ${newRemainingAttempts === 1 ? 'tentativa restante' : 'tentativas restantes'}.`);
      } else if (newRemainingAttempts <= 0) {
        setIsAccountLocked(true);
        setLockoutMinutes(15);
        setError(`Conta bloqueada por 15 minutos devido a múltiplas tentativas falhas.`);
      } else {
        setError("Email ou senha incorretos. Tente novamente.");
      }
      toast.error("Falha ao fazer login");
    } else {
      await recordLoginAttempt(data.email, true);
      logLoginSuccess();
      
      // Register session for active sessions tracking
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const { data: userData } = await supabase
          .from('users')
          .select('id, account_id')
          .eq('auth_user_id', session.user.id)
          .single();
        
        if (userData) {
          await registerSession(userData.id, userData.account_id, session.access_token);
        }
      }
      
      toast.success("Login realizado com sucesso!");
    }

    setIsSubmitting(false);
  };

  const handleSignup = async (data: SignupFormData) => {
    setError(null);
    setIsSubmitting(true);

    const { error } = await signUp(data.email, data.password, data.name, data.phone);

    if (error) {
      if (error.message.includes("already registered")) {
        setError("Este email já está cadastrado. Tente fazer login.");
      } else {
        setError("Erro ao criar conta. Tente novamente.");
      }
      toast.error("Falha ao criar conta");
    } else {
      toast.success("Conta criada com sucesso!");
      logSignupSuccess();
      // Show payment setup dialog after successful signup
      setShowPaymentSetup(true);
      setPaymentStep("form");
    }

    setIsSubmitting(false);
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setIsSubmitting(true);

    const { error } = await signInWithGoogle();

    if (error) {
      setError("Erro ao entrar com Google. Tente novamente.");
      toast.error("Falha ao entrar com Google");
      setIsSubmitting(false);
      return;
    }
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
            <RoyLogo size="lg" />
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">ROY APP</h1>
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
            <RoyLogo size="lg" />
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">ROY APP</h1>
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
                    <div className="relative">
                      <Input
                        id="new-password"
                        type={showNewPassword ? "text" : "password"}
                        placeholder="Crie uma senha forte"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        required
                        minLength={8}
                        disabled={isSubmitting}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        tabIndex={-1}
                      >
                        {showNewPassword ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                      </Button>
                    </div>
                    <PasswordStrength password={newPassword} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirm-password">Confirmar senha</Label>
                    <div className="relative">
                      <Input
                        id="confirm-password"
                        type={showConfirmPassword ? "text" : "password"}
                        placeholder="Digite novamente"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                        minLength={6}
                        disabled={isSubmitting}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        tabIndex={-1}
                      >
                        {showConfirmPassword ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                      </Button>
                    </div>
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
          <div className="flex flex-col items-center justify-center gap-3 mb-8">
            <div className="flex items-center gap-3">
              <RoyLogo size="lg" />
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-foreground">ROY APP</h1>
                <p className="text-sm text-muted-foreground">Sua plataforma de encantamento</p>
              </div>
            </div>
          </div>

        <Card className="shadow-elevated border-border/50">
          <Tabs defaultValue={initialTab} className="w-full">
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
                <div className="space-y-4">
                  <Button type="button" variant="outline" className="w-full" disabled={isSubmitting} onClick={handleGoogleSignIn}>
                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <span className="mr-2 text-base leading-none">G</span>}
                    Entrar com Google
                  </Button>
                  <div className="relative">
                    <Separator />
                    <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-2 text-xs text-muted-foreground">
                      ou continue com email
                    </span>
                  </div>
                </div>
                <Form {...loginForm}>
                  <form onSubmit={loginForm.handleSubmit(handleLogin)} className="space-y-4 pt-4">
                    <FormField
                      control={loginForm.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl>
                            <Input
                              type="email"
                              placeholder="seu@email.com"
                              disabled={isSubmitting}
                              maxLength={SECURITY_LIMITS.EMAIL_MAX}
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={loginForm.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <div className="flex items-center justify-between">
                            <FormLabel>Senha</FormLabel>
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
                          <FormControl>
                            <div className="relative">
                              <Input
                                type={showLoginPassword ? "text" : "password"}
                                placeholder="••••••••"
                                disabled={isSubmitting}
                                maxLength={SECURITY_LIMITS.PASSWORD_MAX}
                                {...field}
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                                onClick={() => setShowLoginPassword(!showLoginPassword)}
                                tabIndex={-1}
                              >
                                {showLoginPassword ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                              </Button>
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
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
                </Form>
              </TabsContent>

              <TabsContent value="signup" className="mt-0">
                <div className="space-y-4">
                  <Button type="button" variant="outline" className="w-full" disabled={isSubmitting} onClick={handleGoogleSignIn}>
                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <span className="mr-2 text-base leading-none">G</span>}
                    Continuar com Google
                  </Button>
                  <div className="relative">
                    <Separator />
                    <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-2 text-xs text-muted-foreground">
                      ou crie com email
                    </span>
                  </div>
                </div>
                <Form {...signupForm}>
                  <form onSubmit={signupForm.handleSubmit(handleSignup)} className="space-y-4 pt-4">
                    <FormField
                      control={signupForm.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nome</FormLabel>
                          <FormControl>
                            <Input
                              type="text"
                              placeholder="Seu nome"
                              disabled={isSubmitting}
                              maxLength={SECURITY_LIMITS.NAME_MAX}
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={signupForm.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl>
                            <Input
                              type="email"
                              placeholder="seu@email.com"
                              disabled={isSubmitting}
                              maxLength={SECURITY_LIMITS.EMAIL_MAX}
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={signupForm.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Telefone</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                              <Input
                                type="tel"
                                placeholder="(11) 99999-9999"
                                disabled={isSubmitting}
                                className="pl-9"
                                maxLength={SECURITY_LIMITS.PHONE_MAX}
                                {...field}
                              />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={signupForm.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Senha</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Input
                                type={showSignupPassword ? "text" : "password"}
                                placeholder="Crie uma senha forte"
                                disabled={isSubmitting}
                                maxLength={SECURITY_LIMITS.PASSWORD_MAX}
                                {...field}
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                                onClick={() => setShowSignupPassword(!showSignupPassword)}
                                tabIndex={-1}
                              >
                                {showSignupPassword ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                              </Button>
                            </div>
                          </FormControl>
                          <PasswordStrength password={field.value} />
                          <FormMessage />
                        </FormItem>
                      )}
                    />
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
                </Form>
              </TabsContent>
            </CardContent>
          </Tabs>
        </Card>

        <p className="text-center text-sm text-muted-foreground mt-6">
          Encante seus clientes e meça o impacto em tempo real.
        </p>
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
