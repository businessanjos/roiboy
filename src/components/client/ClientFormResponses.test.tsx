import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

// ===== Mocks =====
vi.mock("@/integrations/supabase/client", () => {
  const FIELD_GOAL = "field-goal";
  const FIELD_CRM = "field-crm";

  const customFields = [
    {
      id: FIELD_GOAL,
      name: "Qual é o principal objetivo do negócio neste momento?",
      field_type: "multi_select",
      options: [
        { value: "opt_1", label: "Aumentar faturamento", color: "#10b981" },
        { value: "opt_2", label: "Reduzir custos", color: "#3b82f6" },
        { value: "opt_1776800409246", label: "Expandir equipe" },
        { value: "opt_1776800415248", label: "Lançar novo produto" },
      ],
    },
    {
      id: FIELD_CRM,
      name: "Você utiliza alguma ferramenta de gestão e controle de leads (CRM)?",
      field_type: "select",
      options: [
        { value: "opt_1", label: "Sim, uso ativamente" },
        { value: "opt_2", label: "Não uso" },
      ],
    },
  ];

  const formResponse = {
    id: "resp-1",
    form_id: "form-1",
    responses: {
      [FIELD_GOAL]: ["opt_1", "opt_2", "opt_1776800409246", "opt_1776800415248"],
      [FIELD_CRM]: "opt_1",
    },
    submitted_at: new Date("2026-04-27T15:00:00Z").toISOString(),
    last_edited_at: null,
    last_edited_by: null,
    forms: { id: "form-1", title: "Formulário Diagnóstico", fields: [] },
  };

  const buildQuery = (table: string) => {
    const data = (() => {
      switch (table) {
        case "clients":
          return { account_id: "acc-1" };
        case "custom_fields":
          return customFields;
        case "form_responses":
          return [formResponse];
        case "client_diagnostics":
          return null;
        default:
          return null;
      }
    })();

    const result = { data, error: null };
    const chain: any = {
      select: () => chain,
      eq: () => chain,
      order: () => Promise.resolve(result),
      maybeSingle: () => Promise.resolve(result),
      then: (onF: any, onR: any) => Promise.resolve(result).then(onF, onR),
    };
    return chain;
  };

  return {
    supabase: {
      from: (table: string) => buildQuery(table),
    },
  };
});

vi.mock("@/hooks/useCurrentUser", () => ({
  useCurrentUser: () => ({ id: "u-1", auth_user_id: "auth-1", account_id: "acc-1" }),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { ClientFormResponses } from "./ClientFormResponses";

describe("ClientFormResponses — multiselect rendering", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("never renders raw option IDs (opt_*) for multiselect fields", async () => {
    const { container } = render(<ClientFormResponses clientId="client-1" />);

    await waitFor(() => {
      expect(screen.getByText(/Formulário Diagnóstico/i)).toBeInTheDocument();
    });

    // Wait for chips to render (auto-expand)
    await waitFor(() => {
      expect(screen.getByText("Aumentar faturamento")).toBeInTheDocument();
    });

    const text = container.textContent || "";
    // No raw IDs should appear anywhere in rendered output
    expect(text).not.toMatch(/\bopt_1\b/);
    expect(text).not.toMatch(/\bopt_2\b/);
    expect(text).not.toMatch(/opt_1776800409246/);
    expect(text).not.toMatch(/opt_1776800415248/);
  });

  it("renders correct labels as chips for each multiselect value", async () => {
    render(<ClientFormResponses clientId="client-1" />);

    await waitFor(() => {
      expect(screen.getByText("Aumentar faturamento")).toBeInTheDocument();
      expect(screen.getByText("Reduzir custos")).toBeInTheDocument();
      expect(screen.getByText("Expandir equipe")).toBeInTheDocument();
      expect(screen.getByText("Lançar novo produto")).toBeInTheDocument();
    });
  });

  it("resolves single-select option IDs to readable labels", async () => {
    render(<ClientFormResponses clientId="client-1" />);

    await waitFor(() => {
      expect(screen.getByText("Sim, uso ativamente")).toBeInTheDocument();
    });
  });

  it("snapshot: chips structure for multiselect with opt_* values", async () => {
    const { container } = render(<ClientFormResponses clientId="client-1" />);

    await waitFor(() => {
      expect(screen.getByText("Aumentar faturamento")).toBeInTheDocument();
    });

    // Snapshot only the chip group to keep it stable & focused
    const chip = screen.getByText("Aumentar faturamento").closest("span");
    expect(chip).toMatchSnapshot();
  });
});
