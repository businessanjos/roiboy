/**
 * Utilitário de segurança para URLs
 * Garante que todas as URLs externas usem HTTPS
 */

/**
 * Garante que uma URL use HTTPS
 * @param url URL a ser validada
 * @param allowLocalhost Se true, permite localhost com HTTP
 */
export function ensureHttps(url: string, allowLocalhost = false): string {
  if (!url) return url;
  
  const trimmedUrl = url.trim();
  
  // Permitir localhost em desenvolvimento
  if (allowLocalhost && (
    trimmedUrl.includes('localhost') || 
    trimmedUrl.includes('127.0.0.1')
  )) {
    return trimmedUrl;
  }
  
  // Se já é HTTPS, retornar
  if (trimmedUrl.startsWith('https://')) {
    return trimmedUrl;
  }
  
  // Converter HTTP para HTTPS
  if (trimmedUrl.startsWith('http://')) {
    console.warn(`[URL Security] Converting insecure URL: ${trimmedUrl}`);
    return trimmedUrl.replace('http://', 'https://');
  }
  
  // Se não tem protocolo, adicionar HTTPS
  if (!trimmedUrl.includes('://')) {
    return `https://${trimmedUrl}`;
  }
  
  return trimmedUrl;
}

/**
 * Valida se uma URL é segura para redirecionamento
 */
export function isSafeRedirectUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    
    // Não permitir javascript: ou data:
    if (['javascript:', 'data:', 'vbscript:'].includes(parsed.protocol)) {
      return false;
    }
    
    // Exigir HTTPS para URLs externas
    if (!parsed.hostname.includes('localhost') && 
        !parsed.hostname.includes('127.0.0.1')) {
      return parsed.protocol === 'https:';
    }
    
    return true;
  } catch {
    return false;
  }
}

/**
 * Formata link de rede social com HTTPS
 */
export function formatSocialLink(
  value: string, 
  platform: 'instagram' | 'linkedin' | 'twitter' | 'website'
): string {
  if (!value) return '';
  
  const trimmed = value.trim();
  
  // Se já é uma URL completa, garantir HTTPS
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return ensureHttps(trimmed);
  }
  
  // Construir URL baseada na plataforma
  const baseUrls: Record<string, string> = {
    instagram: 'https://instagram.com/',
    linkedin: 'https://linkedin.com/in/',
    twitter: 'https://twitter.com/',
    website: 'https://',
  };
  
  // Remover @ se presente
  const cleanValue = trimmed.replace(/^@/, '');
  
  return `${baseUrls[platform] || 'https://'}${cleanValue}`;
}
