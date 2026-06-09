import { useEffect, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Loader2, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';

interface NominatimResult {
  display_name: string;
  address?: {
    country_code?: string;
    country?: string;
    city?: string;
    town?: string;
    village?: string;
    state?: string;
  };
  lat: string;
  lon: string;
}

interface Suggestion {
  label: string;       // short label, e.g. "Paris, France"
  flag: string;        // emoji flag or ''
  countryCode: string; // ISO2 lowercase
  isInternational: boolean;
}

function isoToFlag(code?: string): string {
  if (!code || code.length !== 2) return '';
  const cc = code.toUpperCase();
  return String.fromCodePoint(...cc.split('').map(c => 127397 + c.charCodeAt(0)));
}

function buildLabel(r: NominatimResult): string {
  const a = r.address || {};
  const city = a.city || a.town || a.village || a.state || '';
  const country = a.country || '';
  if (city && country) return `${city}, ${country}`;
  return r.display_name.split(',').slice(0, 2).join(',').trim();
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  id?: string;
}

export function DestinationAutocomplete({ value, onChange, placeholder, id }: Props) {
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const userTypingRef = useRef(false);

  useEffect(() => {
    setQuery(value);
    userTypingRef.current = false;
  }, [value]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (!userTypingRef.current) return; // skip search when value came from props/select
    const stripped = query.replace(/^\p{Extended_Pictographic}\s*/u, '').trim();
    if (!stripped || stripped.length < 2) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setLoading(true);
      try {
        const url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=6&accept-language=pt-BR&q=${encodeURIComponent(stripped)}`;
        const res = await fetch(url, {
          signal: ctrl.signal,
          headers: { 'Accept': 'application/json' },
        });
        const data: NominatimResult[] = await res.json();
        const mapped = data.map<Suggestion>((r) => {
          const cc = (r.address?.country_code || '').toLowerCase();
          const isInternational = cc && cc !== 'br';
          return {
            label: buildLabel(r),
            flag: isInternational ? isoToFlag(cc) : '',
            countryCode: cc,
            isInternational: !!isInternational,
          };
        });
        // dedupe by label
        const seen = new Set<string>();
        const deduped = mapped.filter(s => {
          if (seen.has(s.label)) return false;
          seen.add(s.label);
          return true;
        });
        setResults(deduped);
        setHighlight(0);
        setOpen(true);
      } catch (err: any) {
        if (err?.name !== 'AbortError') {
          setResults([]);
        }
      } finally {
        setLoading(false);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [query]);

  const pick = (s: Suggestion) => {
    const final = s.flag ? `${s.flag} ${s.label}` : s.label;
    setQuery(final);
    onChange(final);
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open || results.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight(h => Math.min(h + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight(h => Math.max(h - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      pick(results[highlight]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div ref={wrapperRef} className="relative">
      <Input
        id={id}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          onChange(e.target.value);
        }}
        onFocus={() => { if (results.length) setOpen(true); }}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        autoComplete="off"
      />
      {loading && (
        <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
      )}
      {open && results.length > 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md max-h-64 overflow-y-auto">
          {results.map((s, i) => (
            <button
              key={`${s.label}-${i}`}
              type="button"
              onClick={() => pick(s)}
              onMouseEnter={() => setHighlight(i)}
              className={cn(
                'w-full text-left px-3 py-2 text-sm flex items-center gap-2 transition-colors',
                i === highlight ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50'
              )}
            >
              {s.flag ? (
                <span className="text-base leading-none">{s.flag}</span>
              ) : (
                <MapPin className="h-4 w-4 text-muted-foreground" />
              )}
              <span className="flex-1 truncate">{s.label}</span>
              {s.isInternational && (
                <span className="text-[10px] uppercase text-muted-foreground">Intl</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
