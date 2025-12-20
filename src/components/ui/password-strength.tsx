import { useMemo } from "react";
import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface PasswordStrengthProps {
  password: string;
  showRequirements?: boolean;
}

interface PasswordRequirement {
  label: string;
  regex: RegExp;
  met: boolean;
}

export function usePasswordStrength(password: string) {
  const requirements: PasswordRequirement[] = useMemo(() => [
    {
      label: "Mínimo 8 caracteres",
      regex: /.{8,}/,
      met: /.{8,}/.test(password),
    },
    {
      label: "Letra maiúscula (A-Z)",
      regex: /[A-Z]/,
      met: /[A-Z]/.test(password),
    },
    {
      label: "Letra minúscula (a-z)",
      regex: /[a-z]/,
      met: /[a-z]/.test(password),
    },
    {
      label: "Número (0-9)",
      regex: /[0-9]/,
      met: /[0-9]/.test(password),
    },
    {
      label: "Caractere especial (!@#$%...)",
      regex: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/,
      met: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password),
    },
  ], [password]);

  const strength = useMemo(() => {
    const metCount = requirements.filter((r) => r.met).length;
    return {
      score: metCount,
      percentage: (metCount / requirements.length) * 100,
      isValid: metCount === requirements.length,
      label: metCount === 0 
        ? "" 
        : metCount <= 2 
          ? "Fraca" 
          : metCount <= 4 
            ? "Média" 
            : "Forte",
      color: metCount === 0 
        ? "bg-muted" 
        : metCount <= 2 
          ? "bg-destructive" 
          : metCount <= 4 
            ? "bg-warning" 
            : "bg-success",
    };
  }, [requirements]);

  return { requirements, strength };
}

export function PasswordStrength({ password, showRequirements = true }: PasswordStrengthProps) {
  const { requirements, strength } = usePasswordStrength(password);

  if (!password) return null;

  return (
    <div className="space-y-3">
      {/* Strength bar */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Força da senha</span>
          <span className={cn(
            "font-medium",
            strength.score <= 2 ? "text-destructive" : 
            strength.score <= 4 ? "text-warning" : 
            "text-success"
          )}>
            {strength.label}
          </span>
        </div>
        <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
          <div 
            className={cn("h-full transition-all duration-300", strength.color)}
            style={{ width: `${strength.percentage}%` }}
          />
        </div>
      </div>

      {/* Requirements list */}
      {showRequirements && (
        <div className="space-y-1">
          {requirements.map((req, index) => (
            <div 
              key={index}
              className={cn(
                "flex items-center gap-2 text-xs transition-colors",
                req.met ? "text-success" : "text-muted-foreground"
              )}
            >
              {req.met ? (
                <Check className="h-3 w-3" />
              ) : (
                <X className="h-3 w-3" />
              )}
              <span>{req.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function validatePassword(password: string): { isValid: boolean; error: string | null } {
  if (password.length < 8) {
    return { isValid: false, error: "A senha deve ter pelo menos 8 caracteres." };
  }
  if (!/[A-Z]/.test(password)) {
    return { isValid: false, error: "A senha deve conter pelo menos uma letra maiúscula." };
  }
  if (!/[a-z]/.test(password)) {
    return { isValid: false, error: "A senha deve conter pelo menos uma letra minúscula." };
  }
  if (!/[0-9]/.test(password)) {
    return { isValid: false, error: "A senha deve conter pelo menos um número." };
  }
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    return { isValid: false, error: "A senha deve conter pelo menos um caractere especial (!@#$%...)." };
  }
  return { isValid: true, error: null };
}
