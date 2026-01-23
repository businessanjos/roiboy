import { evaluate, parse } from 'mathjs';

/**
 * Validates a custom formula string for syntax errors
 * @param formula Formula with {{value}} placeholders
 * @returns Validation result with error message if invalid
 */
export function validateFormula(formula: string): { valid: boolean; error?: string } {
  if (!formula || formula.trim() === '') {
    return { valid: true };
  }

  try {
    // Replace placeholders with test values for syntax validation
    const testFormula = formula.replace(/\{\{(\w+)\}\}/g, '1');
    parse(testFormula);
    return { valid: true };
  } catch (e) {
    return { valid: false, error: (e as Error).message };
  }
}

/**
 * Evaluates a formula with the given variables
 * @param formula Formula string with {{variable}} placeholders
 * @param variables Object with variable values (e.g., { value: 1000 })
 * @returns Evaluated result or 0 on error
 */
export function evaluateFormula(
  formula: string,
  variables: Record<string, number>
): number {
  if (!formula || formula.trim() === '') {
    return variables.value ?? 0;
  }

  try {
    // Replace {{variable}} with just variable for mathjs
    const cleanFormula = formula.replace(/\{\{(\w+)\}\}/g, '$1');
    const result = evaluate(cleanFormula, variables);
    return typeof result === 'number' && isFinite(result) ? result : 0;
  } catch {
    return variables.value ?? 0; // Fallback to original value on error
  }
}

/**
 * Formats a number according to the specified format type
 * @param value Number to format
 * @param formatType 'currency' | 'percentage' | 'decimal'
 * @param decimals Number of decimal places
 * @returns Formatted string
 */
export function formatValue(
  value: number,
  formatType: 'currency' | 'percentage' | 'decimal',
  decimals: number = 2
): string {
  if (value === null || value === undefined || !isFinite(value)) {
    return '-';
  }

  switch (formatType) {
    case 'currency':
      return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      }).format(value);

    case 'percentage':
      return `${value.toFixed(decimals)}%`;

    case 'decimal':
      return new Intl.NumberFormat('pt-BR', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      }).format(value);

    default:
      return String(value);
  }
}

/**
 * Formats a value in a compact way for axis labels
 * @param value Number to format
 * @param formatType Format type
 * @returns Compact formatted string (e.g., "R$1,2M", "45%")
 */
export function formatValueCompact(
  value: number,
  formatType: 'currency' | 'percentage' | 'decimal'
): string {
  if (value === null || value === undefined || !isFinite(value)) {
    return '-';
  }

  if (formatType === 'percentage') {
    return `${Math.round(value)}%`;
  }

  const prefix = formatType === 'currency' ? 'R$' : '';

  if (Math.abs(value) >= 1_000_000) {
    return `${prefix}${(value / 1_000_000).toFixed(1)}M`;
  }
  if (Math.abs(value) >= 1_000) {
    return `${prefix}${(value / 1_000).toFixed(0)}K`;
  }
  return `${prefix}${Math.round(value)}`;
}

// Alias for backward compatibility
export const formatValueDisplay = formatValue;
