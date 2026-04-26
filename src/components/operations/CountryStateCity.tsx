import { useState, useEffect, useRef, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MapPin, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { COUNTRIES, BRAZIL_STATES, getCountry } from "@/lib/countries";

export interface LocationFields {
  pais: string; // nome
  pais_codigo: string; // ISO alpha-2
  estado: string; // nome
  estado_uf: string; // UF (Brasil)
  cidade: string;
}

interface NominatimResult {
  place_id: number;
  display_name: string;
  address?: { city?: string; town?: string; village?: string; municipality?: string };
}

interface CountryStateCityProps {
  value: LocationFields;
  onChange: (next: LocationFields) => void;
  onCountryChange?: (countryCode: string) => void;
  disabled?: boolean;
}

export function CountryStateCity({ value, onChange, onCountryChange, disabled }: CountryStateCityProps) {
  const isBrazil = (value.pais_codigo || "").toUpperCase() === "BR";

  const handleCountry = (code: string) => {
    const c = getCountry(code);
    onChange({
      ...value,
      pais: c?.name || "",
      pais_codigo: code,
      estado: code === "BR" ? value.estado : "",
      estado_uf: code === "BR" ? value.estado_uf : "",
      cidade: "",
    });
    onCountryChange?.(code);
  };

  const handleStateBR = (uf: string) => {
    const st = BRAZIL_STATES.find((s) => s.uf === uf);
    onChange({ ...value, estado_uf: uf, estado: st?.name || uf });
  };

  return (
    <>
      <div className="space-y-1.5">
        <Label className="text-xs">País *</Label>
        <Select value={value.pais_codigo || ""} onValueChange={handleCountry} disabled={disabled}>
          <SelectTrigger><SelectValue placeholder="Selecione o país" /></SelectTrigger>
          <SelectContent className="max-h-72">
            {COUNTRIES.map((c) => (
              <SelectItem key={c.code} value={c.code}>
                <span className="flex items-center gap-2">
                  <span className="text-base leading-none">{c.flag}</span>
                  <span>{c.name}</span>
                  <span className="text-xs text-muted-foreground">({c.currency})</span>
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isBrazil ? (
        <div className="space-y-1.5">
          <Label className="text-xs">Estado *</Label>
          <Select value={value.estado_uf || ""} onValueChange={handleStateBR} disabled={disabled}>
            <SelectTrigger><SelectValue placeholder="Selecione o estado" /></SelectTrigger>
            <SelectContent className="max-h-72">
              {BRAZIL_STATES.map((s) => (
                <SelectItem key={s.uf} value={s.uf}>{s.name} ({s.uf})</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : (
        <div className="space-y-1.5">
          <Label className="text-xs">Estado / Província</Label>
          <Input
            value={value.estado}
            onChange={(e) => onChange({ ...value, estado: e.target.value, estado_uf: "" })}
            placeholder="ex.: California"
            disabled={disabled}
          />
        </div>
      )}

      <div className="sm:col-span-2">
        <CityAutocomplete
          countryCode={value.pais_codigo}
          value={value.cidade}
          onChange={(city) => onChange({ ...value, cidade: city })}
          disabled={disabled || !value.pais_codigo}
        />
      </div>
    </>
  );
}

function CityAutocomplete({
  countryCode,
  value,
  onChange,
  disabled,
}: {
  countryCode: string;
  value: string;
  onChange: (city: string) => void;
  disabled?: boolean;
}) {
  const [query, setQuery] = useState(value || "");
  const [suggestions, setSuggestions] = useState<NominatimResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setQuery(value || ""); }, [value]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const search = useCallback(async (q: string, country: string) => {
    if (!q || q.length < 2) { setSuggestions([]); return; }
    setLoading(true);
    try {
      const params = new URLSearchParams({
        q,
        format: "json",
        addressdetails: "1",
        limit: "6",
        featuretype: "city",
      });
      if (country) params.set("countrycodes", country.toLowerCase());
      const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
        headers: { "Accept-Language": "pt-BR" },
      });
      const data: NominatimResult[] = await res.json();
      // Dedup por nome de cidade
      const seen = new Set<string>();
      const unique = data.filter((r) => {
        const c = r.address?.city || r.address?.town || r.address?.village || r.address?.municipality;
        if (!c) return false;
        const key = c.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      setSuggestions(unique);
      setOpen(true);
    } catch (err) {
      console.error("Erro ao buscar cidades:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleInput = (val: string) => {
    setQuery(val);
    onChange(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(val, countryCode), 350);
  };

  const handleSelect = (r: NominatimResult) => {
    const city = r.address?.city || r.address?.town || r.address?.village || r.address?.municipality || r.display_name.split(",")[0];
    setQuery(city);
    onChange(city);
    setOpen(false);
  };

  return (
    <div ref={containerRef} className="space-y-1.5 relative">
      <Label className="text-xs">Cidade *</Label>
      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => handleInput(e.target.value)}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          placeholder={disabled ? "Selecione o país primeiro" : "Digite a cidade"}
          disabled={disabled}
          className="pl-9 pr-8"
        />
        {loading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />}
      </div>
      {open && suggestions.length > 0 && (
        <div className={cn("absolute z-50 w-full top-full mt-1 bg-popover border rounded-md shadow-md max-h-60 overflow-auto")}>
          {suggestions.map((s) => {
            const city = s.address?.city || s.address?.town || s.address?.village || s.address?.municipality || s.display_name;
            return (
              <button
                key={s.place_id}
                type="button"
                onClick={() => handleSelect(s)}
                className="w-full text-left px-3 py-2 text-sm hover:bg-muted flex items-start gap-2 border-b last:border-b-0"
              >
                <MapPin className="h-4 w-4 mt-0.5 text-primary flex-shrink-0" />
                <div>
                  <div className="font-medium">{city}</div>
                  <div className="text-[11px] text-muted-foreground line-clamp-1">{s.display_name}</div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
