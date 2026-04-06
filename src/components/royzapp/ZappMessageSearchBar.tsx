import { useState, useRef, useEffect } from "react";
import { Search, X, ChevronUp, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ZappMessageSearchBarProps {
  onSearch: (query: string) => void;
  onNavigate: (direction: "prev" | "next") => void;
  onClose: () => void;
  currentMatch: number;
  totalMatches: number;
}

export function ZappMessageSearchBar({
  onSearch,
  onNavigate,
  onClose,
  currentMatch,
  totalMatches,
}: ZappMessageSearchBarProps) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleChange = (value: string) => {
    setQuery(value);
    onSearch(value);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      onNavigate(e.shiftKey ? "prev" : "next");
    }
    if (e.key === "Escape") {
      onClose();
    }
  };

  return (
    <div className="bg-zapp-panel-header border-b border-zapp-border px-3 py-2 flex items-center gap-2 animate-in slide-in-from-top-2 duration-200">
      <Search className="h-4 w-4 text-zapp-text-muted flex-shrink-0" />
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => handleChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Buscar na conversa..."
        className="flex-1 bg-transparent text-zapp-text text-sm placeholder:text-zapp-text-muted outline-none"
      />
      {query && totalMatches > 0 && (
        <span className="text-xs text-zapp-text-muted whitespace-nowrap">
          {currentMatch}/{totalMatches}
        </span>
      )}
      {query && totalMatches === 0 && (
        <span className="text-xs text-zapp-text-muted whitespace-nowrap">
          Nenhum resultado
        </span>
      )}
      <div className="flex items-center gap-0.5">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-zapp-text-muted hover:bg-zapp-hover"
          onClick={() => onNavigate("prev")}
          disabled={totalMatches === 0}
        >
          <ChevronUp className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-zapp-text-muted hover:bg-zapp-hover"
          onClick={() => onNavigate("next")}
          disabled={totalMatches === 0}
        >
          <ChevronDown className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-zapp-text-muted hover:bg-zapp-hover"
          onClick={onClose}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
