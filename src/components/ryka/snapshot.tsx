import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

export type RykaTone = "success" | "warning" | "info" | "danger" | "neutral" | "primary";

const toneIcon: Record<RykaTone, string> = {
  success: "bg-success-soft text-success-foreground",
  warning: "bg-warning-soft text-warning-foreground",
  info: "bg-info-soft text-info-foreground",
  danger: "bg-danger-soft text-danger-foreground",
  neutral: "bg-muted text-muted-foreground",
  primary: "bg-primary text-primary-foreground",
};

export interface SnapshotProps extends HTMLAttributes<HTMLDivElement> {
  tiles: ReactNode;
  detail: ReactNode;
}

/** Layout de duas colunas: tiles de métricas selecionáveis + painel de detalhe. */
export function Snapshot({ tiles, detail, className, ...props }: SnapshotProps) {
  return (
    <div
      className={cn("grid gap-3 md:gap-4 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]", className)}
      {...props}
    >
      <div className="min-w-0">{tiles}</div>
      <div className="min-w-0">{detail}</div>
    </div>
  );
}

export interface SnapshotGridProps extends HTMLAttributes<HTMLDivElement> {
  columns?: 1 | 2;
}

export function SnapshotGrid({ columns = 2, className, ...props }: SnapshotGridProps) {
  return (
    <div
      role="tablist"
      aria-orientation="vertical"
      className={cn("grid gap-3", columns === 2 ? "grid-cols-2" : "grid-cols-1", className)}
      {...props}
    />
  );
}

export interface SnapshotTileProps
  extends Omit<HTMLAttributes<HTMLButtonElement>, "onSelect" | "value"> {
  label: string;
  value: ReactNode;
  hint?: string;
  icon?: LucideIcon;
  /** Ícone já renderizado (alternativa a `icon`). */
  iconNode?: ReactNode;
  tone?: RykaTone;
  selected?: boolean;
  panelId?: string;
  loading?: boolean;
  onSelect?: () => void;
}

/** Tile de métrica: ao clicar, abre o detalhe correspondente no painel. */
export function SnapshotTile({
  label,
  value,
  hint,
  icon: Icon,
  tone = "neutral",
  selected = false,
  panelId,
  loading = false,
  onSelect,
  className,
  ...props
}: SnapshotTileProps) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      aria-controls={panelId}
      onClick={onSelect}
      className={cn(
        "group relative min-h-[88px] w-full rounded-lg bg-card p-4 text-left",
        "ring-1 ring-hairline shadow-soft",
        "transition-[box-shadow,background-color] duration-200 hover:shadow-lift",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        selected && "ring-2 ring-primary",
        className,
      )}
      {...props}
    >
      {selected ? (
        <motion.span
          layoutId="snapshot-tile-marker"
          aria-hidden="true"
          className="absolute bottom-4 left-[-1px] top-4 w-[3px] rounded-full bg-primary"
        />
      ) : null}
      <span className="flex items-start justify-between gap-2">
        <span className="text-[11px] font-medium uppercase tracking-[0.05em] text-muted-foreground">
          {label}
        </span>
        {Icon ? (
          <span
            aria-hidden="true"
            className={cn(
              "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
              toneIcon[tone],
            )}
          >
            <Icon className="h-4 w-4" />
          </span>
        ) : null}
      </span>
      {loading ? (
        <span className="mt-2 block h-6 w-24 animate-pulse rounded bg-muted" />
      ) : (
        <span className="num mt-2 block truncate text-[18px] font-semibold md:text-[22px]">
          {value}
        </span>
      )}
      {hint ? (
        <span className="mt-1 block truncate text-[11px] text-muted-foreground">{hint}</span>
      ) : null}
    </button>
  );
}

export interface SnapshotStat {
  label: string;
  value: ReactNode;
}

export interface SnapshotDetailProps extends HTMLAttributes<HTMLDivElement> {
  detailKey: string;
  title: string;
  description?: string;
  stats?: SnapshotStat[];
  footer?: ReactNode;
  panelId?: string;
  children?: ReactNode;
}

/** Superfície de detalhe do tile selecionado: cabeçalho, corpo e rodapé. */
export function SnapshotDetail({
  detailKey,
  title,
  description,
  stats,
  footer,
  panelId,
  children,
  className,
  ...props
}: SnapshotDetailProps) {
  const reduced = useReducedMotion();

  return (
    <div
      id={panelId}
      role="tabpanel"
      className={cn(
        "flex h-full flex-col rounded-lg bg-card shadow-soft ring-1 ring-hairline",
        className,
      )}
      {...props}
    >
      <div className="hairline-b flex flex-wrap items-end justify-between gap-4 p-4 md:p-6">
        <div className="min-w-0">
          <h3 className="text-base font-semibold md:text-lg">{title}</h3>
          {description ? (
            <p className="mt-1 text-xs text-muted-foreground md:text-sm">{description}</p>
          ) : null}
        </div>
        {stats?.length ? (
          <dl className="flex items-end gap-5">
            {stats.map((stat) => (
              <div key={stat.label} className="text-right">
                <dt className="text-[11px] text-muted-foreground">{stat.label}</dt>
                <dd className="num mt-1 text-sm font-semibold md:text-base">{stat.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={detailKey}
          initial={reduced ? { opacity: 0 } : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduced ? { opacity: 0 } : { opacity: 0, y: -8 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          className="min-w-0 flex-1 p-4 md:p-6"
        >
          {children}
        </motion.div>
      </AnimatePresence>

      {footer ? (
        <div className="hairline-t flex flex-wrap items-center justify-between gap-3 px-4 py-3 md:px-6">
          {footer}
        </div>
      ) : null}
    </div>
  );
}

export interface SnapshotInsightProps extends HTMLAttributes<HTMLDivElement> {
  icon?: LucideIcon;
  children: ReactNode;
}

/** Bloco suave de leitura ("o que isso significa") dentro do detalhe. */
export function SnapshotInsight({ icon: Icon, children, className, ...props }: SnapshotInsightProps) {
  return (
    <div
      className={cn("flex gap-3 rounded-md bg-muted p-3 text-sm text-muted-foreground", className)}
      {...props}
    >
      {Icon ? <Icon aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" /> : null}
      <p className="min-w-0">{children}</p>
    </div>
  );
}
