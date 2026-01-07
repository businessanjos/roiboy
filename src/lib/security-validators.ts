import { z } from "zod";

// =============================================================================
// CONSTANTES DE SEGURANÇA
// =============================================================================

export const SECURITY_LIMITS = {
  EMAIL_MAX: 255,
  PASSWORD_MIN: 8,
  PASSWORD_MAX: 128,
  NAME_MAX: 200,
  PHONE_MAX: 20,
  MESSAGE_MAX: 10000,
  TEXT_DEFAULT_MAX: 500,
  NOTES_MAX: 5000,
  MEDIA_CAPTION_MAX: 1000,
} as const;

// =============================================================================
// FUNÇÕES DE SANITIZAÇÃO
// =============================================================================

/**
 * Sanitiza string removendo caracteres potencialmente perigosos
 * @param input - String a ser sanitizada
 * @returns String sanitizada
 */
export function sanitizeString(input: string): string {
  if (!input) return input;
  return input
    .replace(/[<>'"]/g, "") // Remove caracteres perigosos
    .replace(/javascript:/gi, "") // Remove URLs JavaScript
    .replace(/data:/gi, "") // Remove data URIs
    .replace(/on\w+\s*=/gi, "") // Remove event handlers
    .replace(/vbscript:/gi, "") // Remove VBScript
    .replace(/expression\s*\(/gi, "") // Remove CSS expressions
    .trim();
}

/**
 * Sanitiza objeto recursivamente
 * @param obj - Objeto a ser sanitizado
 * @returns Objeto com todas as strings sanitizadas
 */
export function sanitizeObject<T extends Record<string, unknown>>(obj: T): T {
  const result = { ...obj };
  for (const key of Object.keys(result)) {
    const value = result[key];
    if (typeof value === "string") {
      (result as Record<string, unknown>)[key] = sanitizeString(value);
    } else if (Array.isArray(value)) {
      (result as Record<string, unknown>)[key] = value.map((item) =>
        typeof item === "string"
          ? sanitizeString(item)
          : typeof item === "object" && item !== null
          ? sanitizeObject(item as Record<string, unknown>)
          : item
      );
    } else if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      (result as Record<string, unknown>)[key] = sanitizeObject(value as Record<string, unknown>);
    }
  }
  return result;
}

// =============================================================================
// SCHEMAS DE VALIDAÇÃO - CAMPOS BÁSICOS
// =============================================================================

// Email validation with stricter rules
export const emailSchema = z
  .string()
  .trim()
  .email({ message: "Email inválido" })
  .max(SECURITY_LIMITS.EMAIL_MAX, { message: `Email muito longo (máx. ${SECURITY_LIMITS.EMAIL_MAX} caracteres)` })
  .refine(
    (email) => !email.includes("..") && !email.startsWith(".") && !email.endsWith("."),
    { message: "Email com formato inválido" }
  )
  .refine(
    (email) => !/[<>'"&\\]/.test(email),
    { message: "Email contém caracteres inválidos" }
  );

// Password validation with strength requirements
export const passwordSchema = z
  .string()
  .min(SECURITY_LIMITS.PASSWORD_MIN, { message: `Senha deve ter no mínimo ${SECURITY_LIMITS.PASSWORD_MIN} caracteres` })
  .max(SECURITY_LIMITS.PASSWORD_MAX, { message: `Senha muito longa (máx. ${SECURITY_LIMITS.PASSWORD_MAX} caracteres)` })
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
  .max(SECURITY_LIMITS.NAME_MAX, { message: `Nome muito longo (máx. ${SECURITY_LIMITS.NAME_MAX} caracteres)` })
  .refine(
    (name) => !/[<>'"&\\]/.test(name),
    { message: "Nome contém caracteres inválidos" }
  )
  .transform(sanitizeString);

// Brazilian phone validation
export const phoneSchema = z
  .string()
  .trim()
  .min(10, { message: "Telefone deve ter no mínimo 10 dígitos" })
  .max(SECURITY_LIMITS.PHONE_MAX, { message: "Telefone muito longo" })
  .refine(
    (phone) => {
      const digits = phone.replace(/\D/g, "");
      return digits.length >= 10 && digits.length <= 15;
    },
    { message: "Telefone inválido" }
  );

// =============================================================================
// SCHEMAS DE VALIDAÇÃO - DOCUMENTOS BRASILEIROS
// =============================================================================

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

// =============================================================================
// SCHEMAS DE VALIDAÇÃO - CAMPOS DE TEXTO
// =============================================================================

// Generic text field with configurable max length
export const textFieldSchema = (maxLength = SECURITY_LIMITS.TEXT_DEFAULT_MAX) =>
  z
    .string()
    .trim()
    .max(maxLength, { message: `Texto muito longo (máx. ${maxLength} caracteres)` })
    .refine(
      (text) => !/[<>]/.test(text),
      { message: "Texto contém caracteres inválidos" }
    )
    .transform(sanitizeString);

// Message field with larger limit
export const messageSchema = z
  .string()
  .max(SECURITY_LIMITS.MESSAGE_MAX, { message: `Mensagem muito longa (máx. ${SECURITY_LIMITS.MESSAGE_MAX} caracteres)` })
  .transform(sanitizeString);

// Notes field
export const notesSchema = z
  .string()
  .max(SECURITY_LIMITS.NOTES_MAX, { message: `Notas muito longas (máx. ${SECURITY_LIMITS.NOTES_MAX} caracteres)` })
  .transform(sanitizeString)
  .optional();

// =============================================================================
// SCHEMAS DE VALIDAÇÃO - VALORES ESPECIAIS
// =============================================================================

// Currency value validation
export const currencySchema = z
  .string()
  .refine(
    (val) => {
      const cleaned = val.replace(/[R$\s.]/g, "").replace(",", ".");
      return !isNaN(parseFloat(cleaned)) && parseFloat(cleaned) >= 0;
    },
    { message: "Valor monetário inválido" }
  );

// Date validation (YYYY-MM-DD format)
export const dateSchema = z
  .string()
  .refine(
    (val) => !val || /^\d{4}-\d{2}-\d{2}$/.test(val),
    { message: "Data inválida (formato: AAAA-MM-DD)" }
  );

// UUID validation
export const uuidSchema = z
  .string()
  .uuid({ message: "ID inválido" });

// =============================================================================
// SCHEMAS DE FORMULÁRIOS
// =============================================================================

// Login form schema
export const loginFormSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, { message: "Senha é obrigatória" }).max(SECURITY_LIMITS.PASSWORD_MAX),
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
  birth_date: dateSchema.optional(),
  notes: notesSchema,
});

// Lead form schema
export const leadFormSchema = z.object({
  full_name: nameSchema,
  phone_e164: phoneSchema,
  email: emailSchema.optional().or(z.literal("")),
  cpf: cpfSchema.optional().or(z.literal("")),
  cnpj: cnpjSchema.optional().or(z.literal("")),
  notes: notesSchema,
  source: z.enum(["whatsapp", "instagram", "website", "referral", "other"]).optional(),
});

// Profile form schema
export const profileFormSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  phone: phoneSchema.optional().or(z.literal("")),
  avatar_url: z.string().url().optional().or(z.literal("")),
});

// Message input schema
export const messageInputSchema = z.object({
  content: messageSchema,
});

// =============================================================================
// TYPE EXPORTS
// =============================================================================

export type LoginFormData = z.infer<typeof loginFormSchema>;
export type SignupFormData = z.infer<typeof signupFormSchema>;
export type ClientFormData = z.infer<typeof clientFormSchema>;
export type LeadFormData = z.infer<typeof leadFormSchema>;
export type ProfileFormData = z.infer<typeof profileFormSchema>;
export type MessageInputData = z.infer<typeof messageInputSchema>;