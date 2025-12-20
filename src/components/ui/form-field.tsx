import React, { forwardRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Input } from "./input";
import { Label } from "./label";
import { AlertCircle, Check, Eye, EyeOff, Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "./tooltip";

// Enhanced Form Field with validation states
interface FormFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: string;
  success?: boolean;
  optional?: boolean;
}

export const FormField = forwardRef<HTMLInputElement, FormFieldProps>(
  ({ label, error, hint, success, optional, className, id, ...props }, ref) => {
    const fieldId = id || label.toLowerCase().replace(/\s/g, "-");
    
    return (
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label 
            htmlFor={fieldId}
            className={cn(
              "text-sm font-medium",
              error && "text-danger"
            )}
          >
            {label}
            {optional && (
              <span className="text-muted-foreground font-normal ml-1">(opcional)</span>
            )}
          </Label>
          {hint && !error && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs">{hint}</p>
              </TooltipContent>
            </Tooltip>
          )}
        </div>
        
        <div className="relative">
          <Input
            ref={ref}
            id={fieldId}
            className={cn(
              "pr-10 transition-all",
              error && "border-danger focus-visible:ring-danger/30",
              success && "border-success focus-visible:ring-success/30",
              className
            )}
            aria-invalid={!!error}
            aria-describedby={error ? `${fieldId}-error` : undefined}
            {...props}
          />
          
          {/* Status icon */}
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            {error && <AlertCircle className="h-4 w-4 text-danger animate-fade-in" />}
            {success && !error && <Check className="h-4 w-4 text-success animate-fade-in" />}
          </div>
        </div>
        
        {/* Error message */}
        {error && (
          <p 
            id={`${fieldId}-error`}
            className="text-xs text-danger flex items-center gap-1 animate-fade-in"
            role="alert"
          >
            {error}
          </p>
        )}
      </div>
    );
  }
);

FormField.displayName = "FormField";

// Password Field with toggle visibility
interface PasswordFieldProps extends Omit<FormFieldProps, "type"> {}

export const PasswordField = forwardRef<HTMLInputElement, PasswordFieldProps>(
  ({ className, ...props }, ref) => {
    const [showPassword, setShowPassword] = useState(false);
    
    return (
      <div className="relative">
        <FormField
          ref={ref}
          type={showPassword ? "text" : "password"}
          className={cn("pr-16", className)}
          {...props}
        />
        <button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          className="absolute right-10 top-[38px] -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
        >
          {showPassword ? (
            <EyeOff className="h-4 w-4" />
          ) : (
            <Eye className="h-4 w-4" />
          )}
        </button>
      </div>
    );
  }
);

PasswordField.displayName = "PasswordField";

// Phone Input with mask
interface PhoneFieldProps extends Omit<FormFieldProps, "onChange"> {
  value?: string;
  onChange?: (value: string) => void;
}

export const PhoneField = forwardRef<HTMLInputElement, PhoneFieldProps>(
  ({ value, onChange, ...props }, ref) => {
    const formatPhone = (input: string) => {
      // Remove all non-digits
      const digits = input.replace(/\D/g, "");
      
      // Format based on length
      if (digits.length <= 2) {
        return digits;
      } else if (digits.length <= 7) {
        return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
      } else if (digits.length <= 11) {
        return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
      }
      return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
    };
    
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const formatted = formatPhone(e.target.value);
      onChange?.(formatted);
    };
    
    return (
      <FormField
        ref={ref}
        value={value}
        onChange={handleChange as any}
        placeholder="(00) 00000-0000"
        maxLength={15}
        {...props}
      />
    );
  }
);

PhoneField.displayName = "PhoneField";

// CPF/CNPJ Input with mask
interface DocumentFieldProps extends Omit<FormFieldProps, "onChange"> {
  value?: string;
  onChange?: (value: string) => void;
  type?: "cpf" | "cnpj" | "auto";
}

export const DocumentField = forwardRef<HTMLInputElement, DocumentFieldProps>(
  ({ value, onChange, type = "auto", ...props }, ref) => {
    const formatDocument = (input: string) => {
      const digits = input.replace(/\D/g, "");
      
      // Auto-detect type based on length
      const isCNPJ = type === "cnpj" || (type === "auto" && digits.length > 11);
      
      if (isCNPJ) {
        // CNPJ: 00.000.000/0000-00
        if (digits.length <= 2) return digits;
        if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
        if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
        if (digits.length <= 12) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
        return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12, 14)}`;
      } else {
        // CPF: 000.000.000-00
        if (digits.length <= 3) return digits;
        if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
        if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
        return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`;
      }
    };
    
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const formatted = formatDocument(e.target.value);
      onChange?.(formatted);
    };
    
    return (
      <FormField
        ref={ref}
        value={value}
        onChange={handleChange as any}
        placeholder={type === "cnpj" ? "00.000.000/0000-00" : "000.000.000-00"}
        maxLength={type === "cnpj" ? 18 : 14}
        {...props}
      />
    );
  }
);

DocumentField.displayName = "DocumentField";

// CEP Input with mask
interface CEPFieldProps extends Omit<FormFieldProps, "onChange"> {
  value?: string;
  onChange?: (value: string) => void;
  onCEPFetch?: (cep: string) => void;
}

export const CEPField = forwardRef<HTMLInputElement, CEPFieldProps>(
  ({ value, onChange, onCEPFetch, ...props }, ref) => {
    const formatCEP = (input: string) => {
      const digits = input.replace(/\D/g, "");
      
      if (digits.length <= 5) return digits;
      return `${digits.slice(0, 5)}-${digits.slice(5, 8)}`;
    };
    
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const formatted = formatCEP(e.target.value);
      onChange?.(formatted);
      
      // Auto-fetch when CEP is complete
      const digits = formatted.replace(/\D/g, "");
      if (digits.length === 8 && onCEPFetch) {
        onCEPFetch(digits);
      }
    };
    
    return (
      <FormField
        ref={ref}
        value={value}
        onChange={handleChange as any}
        placeholder="00000-000"
        maxLength={9}
        {...props}
      />
    );
  }
);

CEPField.displayName = "CEPField";

// Currency Input with mask
interface CurrencyFieldProps extends Omit<FormFieldProps, "onChange" | "value"> {
  value?: number;
  onChange?: (value: number) => void;
  currency?: string;
}

export const CurrencyField = forwardRef<HTMLInputElement, CurrencyFieldProps>(
  ({ value, onChange, currency = "BRL", ...props }, ref) => {
    const formatCurrency = (num: number) => {
      return new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency,
      }).format(num / 100);
    };
    
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const digits = e.target.value.replace(/\D/g, "");
      const numValue = parseInt(digits) || 0;
      onChange?.(numValue);
    };
    
    return (
      <FormField
        ref={ref}
        value={value ? formatCurrency(value) : ""}
        onChange={handleChange as any}
        placeholder="R$ 0,00"
        inputMode="numeric"
        {...props}
      />
    );
  }
);

CurrencyField.displayName = "CurrencyField";
