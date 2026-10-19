import type { ZappView } from "@/lib/royZappRoutes";

/** A section change owns only `view`; sector, connection and deep-link context survive. */
export function zappSectionSearch(search: URLSearchParams, view: ZappView): URLSearchParams {
  const next = new URLSearchParams(search);
  next.set("view", view);
  return next;
}