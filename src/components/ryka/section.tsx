import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface RykaPageProps extends HTMLAttributes<HTMLDivElement> {}

/** Container padrão de página do sistema Ryka. */
export function RykaPage({ className, ...props }: RykaPageProps) {
  return (
    <div
      className={cn("mx-auto w-full max-w-[1400px] p-3 md:p-6", className)}
      {...props}
    />
  );
}

export interface RykaPageHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}

/** Cabeçalho de página: sobretítulo, título, descrição e ações à direita. */
export function RykaPageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: RykaPageHeaderProps) {
  return (
    <header
      className={cn(
        "flex flex-col gap-3 md:flex-row md:items-end md:justify-between md:gap-6",
        className,
      )}
    >
      <div className="max-w-2xl space-y-1.5">
        {eyebrow ? (
          <p className="text-[10px] font-medium uppercase tracking-[0.05em] text-muted-foreground md:text-[11px]">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="text-[22px] font-semibold tracking-tight md:text-[32px]">{title}</h1>
        {description ? (
          <p className="text-sm text-muted-foreground md:text-base">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

export interface SectionTitleProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}

/** Título de seção com descrição e ações opcionais. */
export function SectionTitle({ title, description, actions, className }: SectionTitleProps) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-3", className)}>
      <div className="min-w-0">
        <h2 className="text-base font-semibold md:text-lg">{title}</h2>
        {description ? (
          <p className="mt-1 text-xs text-muted-foreground md:text-sm">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}
