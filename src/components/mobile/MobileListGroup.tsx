/**
 * Lista agrupada estilo iOS/Contatos para telas mobile.
 * Adaptado da linguagem de "Item / Item Group" do shadcn (21st.dev/@shadcn/components/item, MIT).
 * Uma superfície clara, divisórias suaves recuadas e linhas confortáveis (>=72px).
 */
import * as React from "react";
import { cn } from "@/lib/utils";

export function MobileListGroup({ className, ...props }: React.HTMLAttributes<HTMLUListElement>) {
  return (
    <ul
      role="list"
      className={cn(
        "overflow-hidden rounded-[20px] bg-card shadow-ios",
        "[&>li+li]:border-t [&>li+li]:border-border/60",
        className,
      )}
      {...props}
    />
  );
}

export function MobileListRow({ className, ...props }: React.LiHTMLAttributes<HTMLLIElement>) {
  return <li className={cn("relative flex min-h-[76px] items-center", className)} {...props} />;
}

/** Barra de ação 44px usada no topo de listas mobile. */
export function MobileIconButtonClass(active = false) {
  return cn(
    "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-foreground",
    "transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
    "disabled:opacity-40 touch-press",
    active && "bg-muted",
  );
}
