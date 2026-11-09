export const parseManualMetricNumber = (value: string) => {
  const parsed = Number(String(value).replace(/\./g, '').replace(/,/g, '.').trim());
  return Number.isFinite(parsed) ? Math.round(parsed) : 0;
};

export const formatManualMetricNumber = (value: string | number | null | undefined) => {
  if (value === null || value === undefined || String(value).trim() === '') return '';
  return parseManualMetricNumber(String(value)).toLocaleString('pt-BR');
};

export const unformatManualMetricNumber = (value: string) => value.replace(/\./g, '');
