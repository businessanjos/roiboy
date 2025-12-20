import { z } from "zod";

// Email validation with stricter rules
export const emailSchema = z
  .string()
  .trim()
  .email({ message: "Email inválido" })
  .max(255, { message: "Email muito longo (máx. 255 caracteres)" })
  .refine(
    (email) => !email.includes("..") && !email.startsWith(".") && !email.endsWith("."),
    { message: "Email com formato inválido" }
  );

// Password validation with strength requirements
export const passwordSchema = z
  .string()
  .min(8, { message: "Senha deve ter no mínimo 8 caracteres" })
  .max(128, { message: "Senha muito longa (máx. 128 caracteres)" })
  .refine(
    (password) => /[a-z]/.test(password),
    { message: "Senha deve conter pelo menos uma letra minúscula" }
  )
  .refine(
    (password) => /[A-Z]/.test(password),
    { message: "Senha deve conter pelo menos uma letra maiúscula" }
  )
  .refine(
    (password) => /[0-9]/.test(password),
    { message: "Senha deve conter pelo menos um número" }
  );

// Name validation
export const nameSchema = z
  .string()
  .trim()
  .min(2, { message: "Nome deve ter no mínimo 2 caracteres" })
  .max(200, { message: "Nome muito longo (máx. 200 caracteres)" })
  .refine(
    (name) => !/[<>'"&\\]/.test(name),
    { message: "Nome contém caracteres inválidos" }
  );

// Brazilian phone validation
export const phoneSchema = z
  .string()
  .trim()
  .min(10, { message: "Telefone deve ter no mínimo 10 dígitos" })
  .max(20, { message: "Telefone muito longo" })
  .refine(
    (phone) => {
      const digits = phone.replace(/\D/g, "");
      return digits.length >= 10 && digits.length <= 15;
    },
    { message: "Telefone inválido" }
  );

// CPF validation (Brazilian tax ID for individuals)
export const cpfSchema = z
  .string()
  .trim()
  .refine(
    (cpf) => {
      const digits = cpf.replace(/\D/g, "");
      if (digits.length !== 11) return false;
      
      // Check for known invalid sequences
      if (/^(\d)\1{10}$/.test(digits)) return false;
      
      // Validate check digits
      let sum = 0;
      for (let i = 0; i < 9; i++) {
        sum += parseInt(digits[i]) * (10 - i);
      }
      let remainder = sum % 11;
      const firstCheck = remainder < 2 ? 0 : 11 - remainder;
      if (parseInt(digits[9]) !== firstCheck) return false;
      
      sum = 0;
      for (let i = 0; i < 10; i++) {
        sum += parseInt(digits[i]) * (11 - i);
      }
      remainder = sum % 11;
      const secondCheck = remainder < 2 ? 0 : 11 - remainder;
      if (parseInt(digits[10]) !== secondCheck) return false;
      
      return true;
    },
    { message: "CPF inválido" }
  );

// CNPJ validation (Brazilian tax ID for companies)
export const cnpjSchema = z
  .string()
  .trim()
  .refine(
    (cnpj) => {
      const digits = cnpj.replace(/\D/g, "");
      if (digits.length !== 14) return false;
      
      // Check for known invalid sequences
      if (/^(\d)\1{13}$/.test(digits)) return false;
      
      // Validate check digits
      const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
      const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
      
      let sum = 0;
      for (let i = 0; i < 12; i++) {
        sum += parseInt(digits[i]) * weights1[i];
      }
      let remainder = sum % 11;
      const firstCheck = remainder < 2 ? 0 : 11 - remainder;
      if (parseInt(digits[12]) !== firstCheck) return false;
      
      sum = 0;
      for (let i = 0; i < 13; i++) {
        sum += parseInt(digits[i]) * weights2[i];
      }
      remainder = sum % 11;
      const secondCheck = remainder < 2 ? 0 : 11 - remainder;
      if (parseInt(digits[13]) !== secondCheck) return false;
      
      return true;
    },
    { message: "CNPJ inválido" }
  );

// Login form schema
export const loginFormSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, { message: "Senha é obrigatória" }),
});

// Signup form schema
export const signupFormSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  phone: phoneSchema,
  password: passwordSchema,
});

// Client form schema (for creating/editing clients)
export const clientFormSchema = z.object({
  full_name: nameSchema,
  phone_e164: phoneSchema,
  cpf: cpfSchema.optional().or(z.literal("")),
  cnpj: cnpjSchema.optional().or(z.literal("")),
  email: emailSchema.optional().or(z.literal("")),
  birth_date: z.string().optional(),
  notes: z.string().max(5000, { message: "Notas muito longas (máx. 5000 caracteres)" }).optional(),
});

// Sanitize string input (remove potential XSS)
export function sanitizeString(input: string): string {
  if (!input) return input;
  return input
    .replace(/[<>]/g, "")
    .trim();
}

// Sanitize object values recursively
export function sanitizeObject<T extends Record<string, unknown>>(obj: T): T {
  const result = { ...obj };
  for (const key of Object.keys(result)) {
    const value = result[key];
    if (typeof value === "string") {
      (result as Record<string, unknown>)[key] = sanitizeString(value);
    } else if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      (result as Record<string, unknown>)[key] = sanitizeObject(value as Record<string, unknown>);
    }
  }
  return result;
}

// Type exports
export type LoginFormData = z.infer<typeof loginFormSchema>;
export type SignupFormData = z.infer<typeof signupFormSchema>;
export type ClientFormData = z.infer<typeof clientFormSchema>;