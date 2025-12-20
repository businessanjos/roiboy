import React from "react";
import { Check, X, AlertTriangle, Info, CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";

// Success Checkmark Animation
export function SuccessCheck({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center justify-center", className)}>
      <div className="relative">
        <div className="h-16 w-16 rounded-full bg-success/10 flex items-center justify-center animate-scale-in">
          <CheckCircle2 className="h-10 w-10 text-success animate-fade-in" style={{ animationDelay: "0.2s" }} />
        </div>
        <div className="absolute inset-0 rounded-full border-2 border-success animate-ping opacity-20" />
      </div>
    </div>
  );
}

// Error X Animation
export function ErrorX({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center justify-center", className)}>
      <div className="relative">
        <div className="h-16 w-16 rounded-full bg-danger/10 flex items-center justify-center animate-shake">
          <XCircle className="h-10 w-10 text-danger" />
        </div>
      </div>
    </div>
  );
}

// Inline Status Badge
const statusBadgeVariants = cva(
  "inline-flex items-center gap-1.5 text-xs font-medium rounded-full px-2.5 py-1 transition-all",
  {
    variants: {
      variant: {
        success: "bg-success/10 text-success border border-success/20",
        error: "bg-danger/10 text-danger border border-danger/20",
        warning: "bg-warning/10 text-warning-foreground border border-warning/20",
        info: "bg-info/10 text-info border border-info/20",
        neutral: "bg-muted text-muted-foreground border border-border",
      },
      animated: {
        true: "animate-fade-in",
        false: "",
      }
    },
    defaultVariants: {
      variant: "neutral",
      animated: true,
    }
  }
);

interface StatusBadgeProps extends VariantProps<typeof statusBadgeVariants> {
  children: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}

const variantIcons = {
  success: Check,
  error: X,
  warning: AlertTriangle,
  info: Info,
  neutral: null,
};

export function StatusBadge({ children, variant = "neutral", icon, animated, className }: StatusBadgeProps) {
  const IconComponent = icon ? null : variantIcons[variant || "neutral"];
  
  return (
    <span className={cn(statusBadgeVariants({ variant, animated }), className)}>
      {icon || (IconComponent && <IconComponent className="h-3 w-3" />)}
      {children}
    </span>
  );
}

// Progress Steps
interface ProgressStepsProps {
  steps: string[];
  currentStep: number;
  className?: string;
}

export function ProgressSteps({ steps, currentStep, className }: ProgressStepsProps) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      {steps.map((step, index) => (
        <React.Fragment key={step}>
          <div className="flex items-center gap-2">
            <div 
              className={cn(
                "h-8 w-8 rounded-full flex items-center justify-center text-sm font-medium transition-all duration-300",
                index < currentStep && "bg-success text-success-foreground",
                index === currentStep && "bg-primary text-primary-foreground ring-2 ring-primary/30",
                index > currentStep && "bg-muted text-muted-foreground"
              )}
            >
              {index < currentStep ? (
                <Check className="h-4 w-4" />
              ) : (
                index + 1
              )}
            </div>
            <span className={cn(
              "text-sm hidden sm:inline transition-colors",
              index === currentStep ? "text-foreground font-medium" : "text-muted-foreground"
            )}>
              {step}
            </span>
          </div>
          {index < steps.length - 1 && (
            <div 
              className={cn(
                "h-0.5 w-8 transition-colors duration-300",
                index < currentStep ? "bg-success" : "bg-border"
              )} 
            />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

// Confirmation Dialog Content
interface ConfirmationContentProps {
  variant: "success" | "error" | "warning";
  title: string;
  description?: string;
}

export function ConfirmationContent({ variant, title, description }: ConfirmationContentProps) {
  return (
    <div className="flex flex-col items-center py-4 text-center">
      {variant === "success" && <SuccessCheck className="mb-4" />}
      {variant === "error" && <ErrorX className="mb-4" />}
      {variant === "warning" && (
        <div className="h-16 w-16 rounded-full bg-warning/10 flex items-center justify-center mb-4 animate-scale-in">
          <AlertTriangle className="h-10 w-10 text-warning" />
        </div>
      )}
      <h3 className="text-lg font-semibold text-foreground">{title}</h3>
      {description && (
        <p className="text-sm text-muted-foreground mt-1 max-w-sm">{description}</p>
      )}
    </div>
  );
}

// Pulse Dot (for notifications/activity)
export function PulseDot({ className }: { className?: string }) {
  return (
    <span className={cn("relative flex h-2 w-2", className)}>
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
      <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
    </span>
  );
}

// Counter Badge with animation
interface CounterBadgeProps {
  count: number;
  max?: number;
  className?: string;
}

export function CounterBadge({ count, max = 99, className }: CounterBadgeProps) {
  const displayCount = count > max ? `${max}+` : count;
  
  if (count === 0) return null;
  
  return (
    <span 
      className={cn(
        "inline-flex items-center justify-center min-w-[18px] h-[18px] px-1.5 text-xs font-bold rounded-full bg-danger text-danger-foreground animate-scale-in",
        className
      )}
    >
      {displayCount}
    </span>
  );
}
