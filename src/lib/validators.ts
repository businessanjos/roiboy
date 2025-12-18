// CPF Validation
export function validateCPF(cpf: string): boolean {
  const cleanCPF = cpf.replace(/\D/g, '');
  
  if (cleanCPF.length !== 11) return false;
  
  // Check for known invalid patterns
  if (/^(\d)\1{10}$/.test(cleanCPF)) return false;
  
  // Validate first digit
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cleanCPF.charAt(i)) * (10 - i);
  }
  let remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cleanCPF.charAt(9))) return false;
  
  // Validate second digit
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(cleanCPF.charAt(i)) * (11 - i);
  }
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cleanCPF.charAt(10))) return false;
  
  return true;
}

// CNPJ Validation
export function validateCNPJ(cnpj: string): boolean {
  const cleanCNPJ = cnpj.replace(/\D/g, '');
  
  if (cleanCNPJ.length !== 14) return false;
  
  // Check for known invalid patterns
  if (/^(\d)\1{13}$/.test(cleanCNPJ)) return false;
  
  // Validate first digit
  const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(cleanCNPJ.charAt(i)) * weights1[i];
  }
  let remainder = sum % 11;
  const digit1 = remainder < 2 ? 0 : 11 - remainder;
  if (digit1 !== parseInt(cleanCNPJ.charAt(12))) return false;
  
  // Validate second digit
  const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  sum = 0;
  for (let i = 0; i < 13; i++) {
    sum += parseInt(cleanCNPJ.charAt(i)) * weights2[i];
  }
  remainder = sum % 11;
  const digit2 = remainder < 2 ? 0 : 11 - remainder;
  if (digit2 !== parseInt(cleanCNPJ.charAt(13))) return false;
  
  return true;
}

// Format CPF: 000.000.000-00
export function formatCPF(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

// Format CNPJ: 00.000.000/0000-00
export function formatCNPJ(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 14);
  if (digits.length <= 2) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
  if (digits.length <= 12) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
}

// Format CEP: 00000-000
export function formatCEP(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

// Format date: DD/MM/AAAA
export function formatDateBR(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

// Parse DD/MM/AAAA to YYYY-MM-DD (ISO format)
export function parseDateBRToISO(dateBR: string): string | null {
  const digits = dateBR.replace(/\D/g, '');
  if (digits.length !== 8) return null;
  
  const day = parseInt(digits.slice(0, 2), 10);
  const month = parseInt(digits.slice(2, 4), 10);
  const year = parseInt(digits.slice(4, 8), 10);
  
  // Basic validation
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > 31) return null;
  if (year < 1900 || year > new Date().getFullYear()) return null;
  
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

// Parse YYYY-MM-DD to DD/MM/AAAA
export function parseISOToDateBR(isoDate: string): string {
  if (!isoDate) return '';
  const [year, month, day] = isoDate.split('-');
  if (!year || !month || !day) return '';
  return `${day}/${month}/${year}`;
}

// Validate birth date and calculate age
export function validateBirthDate(dateBR: string): { isValid: boolean; age: number | null; error?: string } {
  const digits = dateBR.replace(/\D/g, '');
  if (digits.length === 0) return { isValid: true, age: null };
  if (digits.length < 8) return { isValid: false, age: null, error: 'incomplete' };
  
  const day = parseInt(digits.slice(0, 2), 10);
  const month = parseInt(digits.slice(2, 4), 10);
  const year = parseInt(digits.slice(4, 8), 10);
  
  // Validate month
  if (month < 1 || month > 12) {
    return { isValid: false, age: null, error: 'Mês inválido' };
  }
  
  // Validate day based on month
  const daysInMonth = new Date(year, month, 0).getDate();
  if (day < 1 || day > daysInMonth) {
    return { isValid: false, age: null, error: 'Dia inválido' };
  }
  
  // Create date object
  const birthDate = new Date(year, month - 1, day);
  const today = new Date();
  
  // Check if date is in the future
  if (birthDate > today) {
    return { isValid: false, age: null, error: 'Data no futuro' };
  }
  
  // Check if too old (> 120 years)
  const maxAge = 120;
  const minYear = today.getFullYear() - maxAge;
  if (year < minYear) {
    return { isValid: false, age: null, error: 'Data muito antiga' };
  }
  
  // Calculate age
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  
  return { isValid: true, age };
}

// Validate email
export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Valid Brazilian DDDs
const VALID_DDDS = [
  // São Paulo
  '11', '12', '13', '14', '15', '16', '17', '18', '19',
  // Rio de Janeiro / Espírito Santo
  '21', '22', '24', '27', '28',
  // Minas Gerais
  '31', '32', '33', '34', '35', '37', '38',
  // Paraná / Santa Catarina
  '41', '42', '43', '44', '45', '46', '47', '48', '49',
  // Rio Grande do Sul
  '51', '53', '54', '55',
  // Centro-Oeste (DF, GO, TO, MT, MS, RO, AC)
  '61', '62', '63', '64', '65', '66', '67', '68', '69',
  // Bahia / Sergipe
  '71', '73', '74', '75', '77', '79',
  // Nordeste (PE, AL, PB, RN, CE, PI, MA)
  '81', '82', '83', '84', '85', '86', '87', '88', '89',
  // Norte (PA, AP, AM, RR)
  '91', '92', '93', '94', '95', '96', '97', '98', '99'
];

// Validate Brazilian DDD
export function validateBrazilianDDD(ddd: string): boolean {
  return VALID_DDDS.includes(ddd);
}

// Validate Brazilian phone number (expects E.164 format or digits only)
export function validateBrazilianPhone(phone: string): { isValid: boolean; dddValid: boolean; lengthValid: boolean } {
  const digits = phone.replace(/\D/g, '');
  
  // Remove country code if present
  const localDigits = digits.startsWith('55') ? digits.slice(2) : digits;
  
  // Brazilian phones: DDD (2 digits) + number (8 or 9 digits)
  const lengthValid = localDigits.length === 10 || localDigits.length === 11;
  const ddd = localDigits.slice(0, 2);
  const dddValid = validateBrazilianDDD(ddd);
  
  // Mobile numbers (9 digits) should start with 9
  const number = localDigits.slice(2);
  const numberValid = number.length === 8 || (number.length === 9 && number.startsWith('9'));
  
  return {
    isValid: lengthValid && dddValid && numberValid,
    dddValid,
    lengthValid
  };
}

// Format Brazilian phone: +55 11 99999-9999
export function formatBrazilianPhone(value: string): string {
  let digits = value.replace(/\D/g, '');
  
  // Add country code if not present and has enough digits
  if (digits.length > 0 && !digits.startsWith('55') && digits.length <= 11) {
    digits = '55' + digits;
  }
  
  // Limit to max length (55 + 11 digits = 13)
  digits = digits.slice(0, 13);
  
  if (digits.length <= 2) return digits.length > 0 ? `+${digits}` : '';
  if (digits.length <= 4) return `+${digits.slice(0, 2)} ${digits.slice(2)}`;
  if (digits.length <= 9) return `+${digits.slice(0, 2)} ${digits.slice(2, 4)} ${digits.slice(4)}`;
  if (digits.length <= 13) {
    const ddd = digits.slice(2, 4);
    const number = digits.slice(4);
    if (number.length <= 4) {
      return `+${digits.slice(0, 2)} ${ddd} ${number}`;
    } else if (number.length <= 8) {
      return `+${digits.slice(0, 2)} ${ddd} ${number.slice(0, 4)}-${number.slice(4)}`;
    } else {
      return `+${digits.slice(0, 2)} ${ddd} ${number.slice(0, 5)}-${number.slice(5)}`;
    }
  }
  return value;
}
