import { useState, useRef, useEffect } from "react";
import { brazilianBanks, BrazilianBank } from "@/data/brazilian-banks";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface BankComboboxProps {
  value: string;
  onChange: (bank: BrazilianBank) => void;
}

export function BankCombobox({ value, onChange }: BankComboboxProps) {
  const [search, setSearch] = useState(value || "");
  const [open, setOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSearch(value || "");
  }, [value]);

  const filtered = brazilianBanks.filter((b) => {
    const q = search.toLowerCase();
    return (
      b.name.toLowerCase().includes(q) ||
      b.fullName.toLowerCase().includes(q) ||
      b.code.includes(q)
    );
  });

  useEffect(() => {
    setHighlightIndex(0);
  }, [search]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectBank = (bank: BrazilianBank) => {
    setSearch(bank.name);
    setOpen(false);
    onChange(bank);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && filtered[highlightIndex]) {
      e.preventDefault();
      selectBank(filtered[highlightIndex]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <Input
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder="Digite o nome ou código do banco"
        autoComplete="off"
      />
      {open && filtered.length > 0 && (
        <div
          ref={listRef}
          className="absolute z-50 mt-1 w-full max-h-60 overflow-y-auto rounded-md border bg-popover shadow-lg"
        >
          {filtered.map((bank, idx) => (
            <button
              key={bank.code}
              type="button"
              className={cn(
                "flex w-full items-center gap-2 px-3 py-2 text-sm text-left hover:bg-accent transition-colors",
                idx === highlightIndex && "bg-accent"
              )}
              onMouseEnter={() => setHighlightIndex(idx)}
              onClick={() => selectBank(bank)}
            >
              {bank.logo && (
                <img
                  src={bank.logo}
                  alt=""
                  className="h-5 w-5 rounded object-contain flex-shrink-0"
                  onError={(e) => (e.currentTarget.style.display = "none")}
                />
              )}
              <span className="text-muted-foreground font-mono text-xs w-8">{bank.code}</span>
              <span className="truncate">{bank.name}</span>
            </button>
          ))}
        </div>
      )}
      {open && filtered.length === 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover p-3 text-sm text-muted-foreground shadow-lg">
          Nenhum banco encontrado
        </div>
      )}
    </div>
  );
}
