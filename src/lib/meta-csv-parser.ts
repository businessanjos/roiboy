/**
 * Meta Business Suite CSV Parser
 * Handles UTF-16 encoded CSVs exported from Meta Business Suite
 */

export interface MetaCSVRow {
  date: Date;
  value: number;
}

export interface ParseResult {
  rows: MetaCSVRow[];
  metricName?: string;
}

/**
 * Parse a Meta Business Suite CSV file content
 */
export function parseMetaCSV(content: string): ParseResult {
  // Clean UTF-16 BOM and null characters
  const cleanContent = content
    .replace(/^\uFEFF/, '') // Remove BOM
    .replace(/\0/g, '') // Remove null chars from UTF-16
    .trim();

  // Detect separator (comma or semicolon)
  const separator = cleanContent.includes(';') ? ';' : ',';

  // Split into lines
  const lines = cleanContent.split(/\r?\n/).filter(l => l.trim());

  if (lines.length < 2) {
    return { rows: [] };
  }

  // Try to detect metric name from header
  const headerLine = lines[0];
  const headers = headerLine.split(separator).map(h => h.replace(/"/g, '').trim());
  
  // Second column usually has the metric name
  const metricName = headers.length > 1 ? headers[1] : undefined;

  // Parse data rows (skip header)
  const rows: MetaCSVRow[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const parts = line.split(separator);
    if (parts.length < 2) continue;

    const dateStr = parts[0].replace(/"/g, '').trim();
    const valueStr = parts[1].replace(/"/g, '').trim();

    // Parse date (expecting YYYY-MM-DD format)
    const dateMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!dateMatch) continue;

    const date = new Date(
      parseInt(dateMatch[1]),
      parseInt(dateMatch[2]) - 1,
      parseInt(dateMatch[3])
    );

    // Parse numeric value (handle different formats)
    const value = parseInt(valueStr.replace(/[.,\s]/g, '')) || 0;

    rows.push({ date, value });
  }

  // Sort by date ascending
  rows.sort((a, b) => a.date.getTime() - b.date.getTime());

  return { rows, metricName };
}

/**
 * Read file as text, handling different encodings
 */
export async function readFileAsText(file: File): Promise<string> {
  // First try UTF-16LE (common for Meta exports)
  try {
    const buffer = await file.arrayBuffer();
    const decoder = new TextDecoder('utf-16le');
    const text = decoder.decode(buffer);
    
    // Check if it looks like valid CSV data
    if (text.includes('Data') || text.match(/\d{4}-\d{2}-\d{2}/)) {
      return text;
    }
  } catch (e) {
    // Ignore and try UTF-8
  }

  // Fallback to UTF-8
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsText(file, 'utf-8');
  });
}

/**
 * Format metric value for display
 */
export function formatMetricValue(value: number): string {
  if (value >= 1000000) {
    return (value / 1000000).toFixed(1).replace('.', ',') + ' mi';
  }
  if (value >= 1000) {
    return (value / 1000).toFixed(1).replace('.', ',') + ' mil';
  }
  return value.toLocaleString('pt-BR');
}

/**
 * Calculate percentage change between two values
 */
export function calculateChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

/**
 * Get metric label in Portuguese
 */
export function getMetricLabel(metricType: string): string {
  const labels: Record<string, string> = {
    views: 'Visualizações',
    reach: 'Alcance',
    interactions: 'Interações',
    link_clicks: 'Cliques no Link',
    visits: 'Visitas ao perfil',
    followers: 'Seguidores',
  };
  return labels[metricType] || metricType;
}

/**
 * Get metric color
 */
export function getMetricColor(metricType: string): string {
  const colors: Record<string, string> = {
    views: '#3b82f6', // blue
    reach: '#8b5cf6', // violet
    interactions: '#f97316', // orange
    link_clicks: '#10b981', // emerald
    visits: '#ec4899', // pink
    followers: '#06b6d4', // cyan
  };
  return colors[metricType] || '#6b7280';
}

/**
 * Detect metric type from filename
 */
export function detectMetricFromFilename(filename: string): string | null {
  const lower = filename.toLowerCase();
  
  if (lower.includes('visualiza')) return 'views';
  if (lower.includes('alcance')) return 'reach';
  if (lower.includes('intera')) return 'interactions';
  if (lower.includes('clique') || lower.includes('link')) return 'link_clicks';
  if (lower.includes('visita')) return 'visits';
  if (lower.includes('seguidor')) return 'followers';
  
  return null;
}
