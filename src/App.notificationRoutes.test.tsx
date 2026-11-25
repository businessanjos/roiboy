import type { PropsWithChildren } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { Outlet, useLocation } from "react-router-dom";

const { passThrough } = vi.hoisted(() => ({
  passThrough: ({ children }: PropsWithChildren) => children,
}));

vi.mock("@/hooks/useAuth", () => ({ AuthProvider: passThrough }));
vi.mock("@/hooks/useCurrentUser", () => ({ CurrentUserProvider: passThrough }));
vi.mock("@/hooks/usePermissions", () => ({ PermissionsProvider: passThrough }));
vi.mock("@/hooks/useImpersonation", () => ({ ImpersonationProvider: passThrough }));
vi.mock("@/contexts/SectorContext", () => ({ SectorProvider: passThrough }));
vi.mock("@/contexts/CompanyContext", () => ({ CompanyProvider: passThrough }));
vi.mock("@/components/admin/ImpersonationBanner", () => ({ ImpersonationBanner: () => null }));
vi.mock("@/components/system/NewVersionDialog", () => ({ NewVersionDialog: () => null }));
vi.mock("@/components/ui/toaster", () => ({ Toaster: () => null }));
vi.mock("@/components/ui/sonner", () => ({ Toaster: () => null }));
vi.mock("@/components/layout/AppLayout", () => ({ AppLayout: () => <Outlet /> }));
vi.mock("@/components/ryka/SalesThemeLayout", () => ({ default: () => <Outlet /> }));
vi.mock("@/components/royzapp/ZappErrorBoundary", () => ({ ZappErrorBoundary: passThrough }));
vi.mock("./pages/Auth", () => ({ default: () => null }));
vi.mock("./pages/OAuthConsent", () => ({ default: () => null }));
vi.mock("./pages/Sectors", () => ({ default: () => null }));
vi.mock("./pages/SalesTeam", () => ({ default: () => null }));
vi.mock("./pages/NotFound", () => ({ default: () => <span>Missing route</span> }));
vi.mock("./pages/RoyZapp", () => ({ default: function Destination() {
  const location = useLocation();
  return <output data-testid="destination">{location.pathname}{location.search}</output>;
} }));

import App from "./App";

afterEach(cleanup);

describe("Legacy transfer notification routing in App", () => {
  it("opens the canonical sales RoyZapp route for accepted or rejected transfer links", async () => {
    window.history.replaceState({}, "", "/royzapp");
    render(<App />);
    await waitFor(() => expect(screen.getByTestId("destination")).toHaveTextContent("/roy-zapp?sector=vendas"));
    expect(screen.queryByText("Missing route")).not.toBeInTheDocument();
  });

  it("preserves conversation and integration parameters from legacy links", async () => {
    window.history.replaceState({}, "", "/royzapp?conversation=qa-chat&integrationId=qa-instance");
    render(<App />);
    await screen.findByTestId("destination");
    expect(window.location.pathname).toBe("/roy-zapp");
    const params = new URLSearchParams(window.location.search);
    expect(params.get("conversation")).toBe("qa-chat");
    expect(params.get("integrationId")).toBe("qa-instance");
    expect(params.get("sector")).toBe("vendas");
  });

  it("leaves current canonical notification links unchanged", async () => {
    window.history.replaceState({}, "", "/roy-zapp?sector=cs&conversation=qa-current");
    render(<App />);
    await screen.findByTestId("destination");
    expect(window.location.pathname + window.location.search).toBe("/roy-zapp?sector=cs&conversation=qa-current");
  });
});