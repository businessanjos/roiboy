import { format, isValid, parse } from 'date-fns';

export function parseTypedFilterDate(value: string): Date | undefined {
  if (!/^\d{2}\/\d{2}\/\d{4}$/.test(value)) return undefined;
  const date = parse(value, 'dd/MM/yyyy', new Date());
  return isValid(date) && format(date, 'dd/MM/yyyy') === value ? date : undefined;
}