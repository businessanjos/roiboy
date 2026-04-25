import { useEffect, useState } from "react";
import { CheckCircle2, AlertTriangle, Loader2, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  fetchAppVersion,
  getInitialAppVersion,
  hardReloadApp,
} from "@/hooks/useAppVersionCheck";

/**
 * Health-check banner shown on /setores. It surfaces three signals so users
 * (and we) can immediately tell whether the screen is healthy or stuck:
 *  1. Auth/user load
 *  2. Permissions load (PermissionsContext)
 *  3. Sector access load (useSectorAccess)
 *
 * If anything is still loading after a stall threshold, or any error is
 * surfaced, the banner switches to a warning state with the precise error
 * message — instead of leaving the user staring at an empty screen.
 */
export interface SectorsHealthBannerProps {
  userLoading: boolean;
  userError?: unknown;
  permissionsLoading: boolean;
  permissionsCount: number;
  sectorAccessLoading: boolean;
  sectorAccessError?: unknown;
  sectorSettingsError?: unknown;
  visibleSectorCount: number;
  isAdmin: boolean;
}

function describeError(err: unknown): string | null {
  if (!err) return null;
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

export function SectorsHealthBanner(props: SectorsHealthBannerProps) {
  const {
    userLoading,
    userError,
    permissionsLoading,
    permissionsCount,
    sectorAccessLoading,
    sectorAccessError,
    sectorSettingsError,
    visibleSectorCount,
    isAdmin,
  } = props;

  const [stalled, setStalled] = useState(false);
  const [newVersion, setNewVersion] = useState<string | null>(null);

  const stillLoading = userLoading || permissionsLoading || sectorAccessLoading;

  useEffect(() => {
    if (!stillLoading) {
      setStalled(false);
      return;
    }
    const t = window.setTimeout(() => setStalled(true), 8000);
    return () => window.clearTimeout(t);
  }, [stillLoading]);

  // While the page is still loading, probe /version.json so we can offer a
  // one-click hard reload if the production bundle is already behind a newer
  // deployment. This is a no-op in dev (version.json is not shipped).
  useEffect(() => {
    if (!stillLoading) return;
    let cancelled = false;
    const probe = async () => {
      const latest = await fetchAppVersion();
      if (cancelled || !latest) return;
      const initial = getInitialAppVersion();
      if (initial && latest !== initial) {
        setNewVersion(latest);
      }
    };
    probe();
    const t = window.setInterval(probe, 5000);
    return () => {
      cancelled = true;
      window.clearInterval(t);
    };
  }, [stillLoading]);

  const errors: { label: string; message: string }[] = [];
  const userMsg = describeError(userError);
  if (userMsg) errors.push({ label: "Usuário", message: userMsg });
  const sectorMsg = describeError(sectorAccessError);
  if (sectorMsg) errors.push({ label: "Acesso aos setores", message: sectorMsg });
  const settingsMsg = describeError(sectorSettingsError);
  if (settingsMsg) errors.push({ label: "Configuração dos setores", message: settingsMsg });

  const hasError = errors.length > 0;
  const stuckEmpty = !stillLoading && !hasError && visibleSectorCount === 0 && !isAdmin;
  const hasNewVersion = !!newVersion;

  let tone: "ok" | "loading" | "warn" = "ok";
  if (hasError || stalled || stuckEmpty || hasNewVersion) tone = "warn";
  else if (stillLoading) tone = "loading";

  // Healthy + finished loading: keep the UI clean, do not render anything.
  if (tone === "ok") return null;

  const toneClasses = {
    ok: "border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-300",
    loading: "border-muted bg-muted/30 text-muted-foreground",
    warn: "border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-200",
  } as const;

  const Icon = tone === "warn" ? AlertTriangle : tone === "loading" ? Loader2 : CheckCircle2;

  return (
    <div
      role={tone === "warn" ? "alert" : "status"}
      aria-live="polite"
      data-testid="sectors-health-banner"
      data-tone={tone}
      data-has-error={hasError ? "true" : "false"}
      data-stalled={stalled ? "true" : "false"}
      data-stuck-empty={stuckEmpty ? "true" : "false"}
      className={cn(
        "mb-6 rounded-lg border px-4 py-3 text-sm flex gap-3 items-start",
        toneClasses[tone],
      )}
    >
      <Icon
        className={cn(
          "h-4 w-4 mt-0.5 flex-shrink-0",
          tone === "loading" && "animate-spin",
        )}
        aria-hidden
      />
      <div className="flex-1 min-w-0">
        {hasNewVersion && (
          <div className="mb-2">
            <p className="font-medium">
              Há uma nova versão da plataforma publicada.
            </p>
            <button
              type="button"
              onClick={() => hardReloadApp()}
              className={cn(
                "mt-2 inline-flex items-center gap-2 rounded-md bg-primary text-primary-foreground",
                "px-3 py-1.5 text-xs font-medium hover:opacity-90 transition-opacity",
              )}
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden />
              Atualizar versão agora
            </button>
          </div>
        )}
        {tone === "loading" && (
          <p>
            Verificando suas permissões…
            <span className="text-xs opacity-75 ml-1">
              ({userLoading ? "usuário " : ""}
              {permissionsLoading ? "permissões " : ""}
              {sectorAccessLoading ? "setores" : ""})
            </span>
          </p>
        )}
        {tone === "warn" && stalled && !hasError && !hasNewVersion && (
          <p className="font-medium">
            A verificação está demorando mais que o esperado.
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="ml-2 underline underline-offset-2"
            >
              Recarregar
            </button>
          </p>
        )}
        {tone === "warn" && stuckEmpty && (
          <p className="font-medium">
            Nenhum setor liberado para o seu usuário. Peça a um administrador
            para revisar suas permissões em Admin → Permissões.
          </p>
        )}
        {hasError && (
          <div>
            <p className="font-medium">
              Não foi possível carregar todas as permissões. Veja os detalhes
              abaixo e tente recarregar.
            </p>
            <ul className="mt-2 space-y-1 text-xs">
              {errors.map((e) => (
                <li key={e.label}>
                  <span className="font-semibold">{e.label}:</span>{" "}
                  <span className="opacity-90">{e.message}</span>
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-2 text-xs underline underline-offset-2"
            >
              Recarregar página
            </button>
          </div>
        )}
        <p className="mt-2 text-[11px] opacity-70">
          {permissionsCount} permissões · {visibleSectorCount} setores visíveis
          {isAdmin ? " · admin" : ""}
        </p>
      </div>
    </div>
  );
}