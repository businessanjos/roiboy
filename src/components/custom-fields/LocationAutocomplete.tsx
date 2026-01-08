import { useState, useEffect, useRef, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { MapPin, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface LocationValue {
  formatted_address: string;
  latitude?: number;
  longitude?: number;
  place_id?: string;
}

interface NominatimAddress {
  road?: string;
  neighbourhood?: string;
  suburb?: string;
  city?: string;
  city_district?: string;
  municipality?: string;
  state?: string;
  country?: string;
}

interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  address?: NominatimAddress;
}

const formatSimpleAddress = (result: NominatimResult): string => {
  if (!result.address) return result.display_name;
  
  const { road, neighbourhood, suburb, city, city_district, municipality, state, country } = result.address;
  
  const parts: string[] = [];
  
  // Localização específica (rua ou bairro)
  if (road) parts.push(road);
  else if (neighbourhood) parts.push(neighbourhood);
  else if (suburb) parts.push(suburb);
  
  // Cidade
  const cityName = city || city_district || municipality;
  if (cityName && !parts.includes(cityName)) parts.push(cityName);
  
  // Estado
  if (state && !parts.includes(state)) parts.push(state);
  
  // País
  if (country && !parts.includes(country)) parts.push(country);
  
  return parts.length > 0 ? parts.join(", ") : result.display_name;
};

interface LocationAutocompleteProps {
  value?: LocationValue | null;
  onChange: (value: LocationValue | null) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function LocationAutocomplete({
  value,
  onChange,
  disabled = false,
  placeholder = "Pesquisar endereço...",
}: LocationAutocompleteProps) {
  const [query, setQuery] = useState(value?.formatted_address || "");
  const [suggestions, setSuggestions] = useState<NominatimResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState<"bottom" | "top">("bottom");
  const debounceRef = useRef<NodeJS.Timeout>();
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Calculate if dropdown should open up or down based on available space
  const calculateDropdownPosition = useCallback(() => {
    if (!inputRef.current) return;
    
    const inputRect = inputRef.current.getBoundingClientRect();
    const dropdownHeight = 240; // max-h-60 = 15rem = 240px
    const viewportHeight = window.innerHeight;
    const spaceBelow = viewportHeight - inputRect.bottom;
    const spaceAbove = inputRect.top;
    
    if (spaceBelow < dropdownHeight && spaceAbove > spaceBelow) {
      setDropdownPosition("top");
    } else {
      setDropdownPosition("bottom");
    }
  }, []);

  // Recalculate position when suggestions appear
  useEffect(() => {
    if (showSuggestions && suggestions.length > 0) {
      calculateDropdownPosition();
    }
  }, [showSuggestions, suggestions.length, calculateDropdownPosition]);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Search with debounce
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (query.length < 3) {
      setSuggestions([]);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&addressdetails=1&limit=5&countrycodes=br`,
          {
            headers: {
              "Accept-Language": "pt-BR",
            },
          }
        );
        const data: NominatimResult[] = await response.json();
        setSuggestions(data);
        setShowSuggestions(true);
      } catch (error) {
        console.error("Error searching address:", error);
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [query]);

  const handleSelect = (suggestion: NominatimResult) => {
    const simpleAddress = formatSimpleAddress(suggestion);
    const locationValue: LocationValue = {
      formatted_address: simpleAddress,
      latitude: parseFloat(suggestion.lat),
      longitude: parseFloat(suggestion.lon),
      place_id: suggestion.place_id.toString(),
    };
    setQuery(simpleAddress);
    onChange(locationValue);
    setShowSuggestions(false);
    setSuggestions([]);
  };

  const handleClear = () => {
    setQuery("");
    onChange(null);
    setSuggestions([]);
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => {
            if (suggestions.length > 0) {
              setShowSuggestions(true);
              calculateDropdownPosition();
            }
          }}
          placeholder={placeholder}
          disabled={disabled}
          className="pl-9 pr-8"
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground animate-spin" />
        )}
        {!loading && query && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          >
            ×
          </button>
        )}
      </div>

      {showSuggestions && suggestions.length > 0 && (
        <div 
          className={cn(
            "absolute z-50 w-full bg-popover border rounded-md shadow-md max-h-60 overflow-auto",
            dropdownPosition === "bottom" ? "top-full mt-1" : "bottom-full mb-1"
          )}
        >
          {suggestions.map((suggestion) => (
            <button
              key={suggestion.place_id}
              type="button"
              onClick={() => handleSelect(suggestion)}
              className={cn(
                "w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors",
                "flex items-start gap-2 border-b last:border-b-0"
              )}
            >
              <MapPin className="h-4 w-4 mt-0.5 text-cyan-500 flex-shrink-0" />
              <span className="line-clamp-2">{formatSimpleAddress(suggestion)}</span>
            </button>
          ))}
        </div>
      )}

      {showSuggestions && query.length >= 3 && !loading && suggestions.length === 0 && (
        <div 
          className={cn(
            "absolute z-50 w-full bg-popover border rounded-md shadow-md p-3 text-sm text-muted-foreground text-center",
            dropdownPosition === "bottom" ? "top-full mt-1" : "bottom-full mb-1"
          )}
        >
          Nenhum endereço encontrado
        </div>
      )}
    </div>
  );
}
