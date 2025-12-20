import React, { useEffect, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "./dialog";

interface Shortcut {
  key: string;
  description: string;
  action: () => void;
  meta?: boolean;
  shift?: boolean;
  alt?: boolean;
}

export function useKeyboardShortcuts(searchOpen?: () => void) {
  const navigate = useNavigate();
  const location = useLocation();
  const [helpOpen, setHelpOpen] = React.useState(false);

  const shortcuts: Shortcut[] = [
    { key: "g", description: "Ir para Dashboard", action: () => navigate("/dashboard"), alt: true },
    { key: "c", description: "Ir para Clientes", action: () => navigate("/clients"), alt: true },
    { key: "e", description: "Ir para Eventos", action: () => navigate("/events"), alt: true },
    { key: "t", description: "Ir para Tarefas", action: () => navigate("/tasks"), alt: true },
    { key: "n", description: "Novo Cliente", action: () => navigate("/clients/new"), meta: true },
    { key: "?", description: "Mostrar atalhos", action: () => setHelpOpen(true), shift: true },
  ];

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Skip if user is typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }

      // Check each shortcut
      for (const shortcut of shortcuts) {
        const metaMatch = shortcut.meta ? (e.metaKey || e.ctrlKey) : !(e.metaKey || e.ctrlKey);
        const shiftMatch = shortcut.shift ? e.shiftKey : !e.shiftKey;
        const altMatch = shortcut.alt ? e.altKey : !e.altKey;

        if (e.key.toLowerCase() === shortcut.key.toLowerCase() && metaMatch && shiftMatch && altMatch) {
          e.preventDefault();
          shortcut.action();
          return;
        }
      }
    },
    [navigate, shortcuts]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return { helpOpen, setHelpOpen, shortcuts };
}

interface KeyboardShortcutsHelpProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function KeyboardShortcutsHelp({ open, onOpenChange }: KeyboardShortcutsHelpProps) {
  const shortcuts = [
    { category: "Navegação", items: [
      { keys: ["⌘", "K"], description: "Busca global" },
      { keys: ["Alt", "G"], description: "Ir para Dashboard" },
      { keys: ["Alt", "C"], description: "Ir para Clientes" },
      { keys: ["Alt", "E"], description: "Ir para Eventos" },
      { keys: ["Alt", "T"], description: "Ir para Tarefas" },
    ]},
    { category: "Ações", items: [
      { keys: ["⌘", "N"], description: "Novo Cliente" },
      { keys: ["Shift", "?"], description: "Mostrar atalhos" },
      { keys: ["Esc"], description: "Fechar modal" },
    ]},
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Atalhos de Teclado</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-4">
          {shortcuts.map((group) => (
            <div key={group.category}>
              <h4 className="text-sm font-medium text-muted-foreground mb-2">
                {group.category}
              </h4>
              <div className="space-y-2">
                {group.items.map((shortcut) => (
                  <div
                    key={shortcut.description}
                    className="flex items-center justify-between py-1.5"
                  >
                    <span className="text-sm text-foreground">{shortcut.description}</span>
                    <div className="flex items-center gap-1">
                      {shortcut.keys.map((key, i) => (
                        <React.Fragment key={key}>
                          <kbd className="px-2 py-1 text-xs font-medium bg-muted border rounded">
                            {key}
                          </kbd>
                          {i < shortcut.keys.length - 1 && (
                            <span className="text-muted-foreground text-xs">+</span>
                          )}
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
