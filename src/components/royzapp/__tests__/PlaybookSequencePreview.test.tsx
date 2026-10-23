import { describe, it, expect, beforeAll } from "vitest";
import { render, screen } from "@testing-library/react";
import { PlaybookSequencePreview } from "../PlaybookSequencePreview";
import type { PlaybookItem } from "@/hooks/usePlaybook";

beforeAll(() => {
  (globalThis as any).ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

const makeItem = (id: string, name: string, text: string): PlaybookItem =>
  ({
    id,
    account_id: "acc",
    folder_id: null,
    name,
    content_type: "text",
    text_content: text,
    media_url: null,
    media_filename: null,
    media_size: null,
    media_duration: null,
    media_caption: null,
    list_items: null,
    link_url: null,
    link_title: null,
    link_description: null,
    template_header: null,
    template_body: null,
    template_footer: null,
    template_buttons: null,
    position: 0,
    is_favorite: false,
    usage_count: 0,
    last_used_at: null,
    visibility: "sector",
    created_by: null,
    created_at: "",
    updated_at: "",
  }) as PlaybookItem;

const items = [makeItem("a", "Apresentação", "Olá {{nome}}!"), makeItem("b", "Follow", "Passando para saber")];

describe("PlaybookSequencePreview", () => {
  it("mostra as mensagens selecionadas na ordem de envio", () => {
    render(
      <PlaybookSequencePreview
        steps={[
          { playbook_item_id: "b", delay_seconds: 5 },
          { playbook_item_id: "a", delay_seconds: 10 },
        ]}
        items={items}
      />
    );
    const text = screen.getByTestId("sequence-preview").textContent || "";
    expect(text.indexOf("Passando para saber")).toBeGreaterThan(-1);
    expect(text.indexOf("Passando para saber")).toBeLessThan(text.indexOf("Olá {{nome}}!"));
  });

  it("mostra a espera configurada na própria mensagem entre as bolhas", () => {
    render(
      <PlaybookSequencePreview
        steps={[
          { playbook_item_id: "a", delay_seconds: 42 },
          { playbook_item_id: "b", delay_seconds: 7 },
        ]}
        items={items}
      />
    );
    expect(screen.getByText(/aguarda 7s/)).toBeInTheDocument();
    expect(screen.queryByText(/aguarda 42s/)).not.toBeInTheDocument();
  });

  it("ignora etapas sem mensagem selecionada", () => {
    render(
      <PlaybookSequencePreview
        steps={[
          { playbook_item_id: "", delay_seconds: 5 },
          { playbook_item_id: "a", delay_seconds: 5 },
        ]}
        items={items}
      />
    );
    expect(screen.getByText(/Olá/)).toBeInTheDocument();
    expect(screen.queryByText(/aguarda/)).not.toBeInTheDocument();
  });

  it("aplica as variáveis da conversa no texto", () => {
    render(
      <PlaybookSequencePreview
        steps={[{ playbook_item_id: "a", delay_seconds: 5 }]}
        items={items}
        variables={{ nome: "Lucas" }}
        replaceVariables={(t, vars) => t.replace("{{nome}}", vars.nome)}
      />
    );
    expect(screen.getByText(/Olá Lucas!/)).toBeInTheDocument();
  });
});
