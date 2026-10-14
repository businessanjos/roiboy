import { describe, it, expect, vi, beforeAll } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@/hooks/useCurrentUser", () => ({
  useCurrentUser: () => ({ currentUser: { account_id: "acc-1" } }),
}));

// O grupo responde 2 participantes e o clientão casa um deles.
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: {
      invoke: vi.fn(async () => ({
        data: {
          data: {
            participants: [
              { JID: "5541999990000@c.us", DisplayName: "Ana" },
              { JID: "5541988887777@c.us", DisplayName: "Bruno", IsAdmin: true },
            ],
          },
        },
      })),
    },
    from: () => {
      const q: any = {
        select: () => q,
        or: () => q,
        limit: () => Promise.resolve({ data: [{ full_name: "Cliente X", phone_e164: "+5541999990000" }], error: null }),
      };
      return q;
    },
  },
}));

import { ZappChatHeader } from "../ZappChatHeader";
import type { ConversationAssignment, ContactInfo } from "../types";

const assignment = {
  id: "a1",
  conversation_id: null,
  zapp_conversation_id: null,
  agent_id: "agent-1",
  department_id: null,
  status: "active",
  priority: 0,
  assigned_at: null,
  first_response_at: null,
  closed_at: null,
  created_at: "2026-10-14T00:00:00Z",
  updated_at: "2026-10-14T00:00:00Z",
  zapp_conversation: {
    id: "",
    phone_e164: "5541999990000",
    contact_name: null,
    client_id: null,
    is_group: true,
    group_jid: "1203630@g.us",
    sector_id: "sec-1",
    integration_id: "int-1",
    unread_count: 0,
    last_message_at: null,
    last_message_preview: null,
  },
} as unknown as ConversationAssignment;

const contactInfo = {
  name: "Grupo Teste",
  phone: "5541999990000",
  avatar: null,
  clientId: null,
  isClient: false,
  isGroup: true,
  lastMessageAt: "2026-10-14T00:00:00Z",
  lastMessagePreview: "",
  unreadCount: 0,
  isPinned: false,
  isMuted: false,
  isFavorite: false,
  isBlocked: false,
  isArchived: false,
  searchableText: "Grupo Teste",
} as ContactInfo;

function renderHeader() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <ZappChatHeader
        assignment={assignment}
        contactInfo={contactInfo}
        clientProducts={[]}
        currentAgentId="agent-1"
        isGroup
        onBack={() => {}}
        onOpenClientEdit={() => {}}
        onAssignToMe={() => {}}
        onReleaseToQueue={() => {}}
        onUpdateStatus={() => {}}
        onOpenTransfer={() => {}}
        onOpenRoiDialog={() => {}}
        onOpenRiskDialog={() => {}}
        onOpenAddClient={() => {}}
        onOpenEditGroup={() => {}}
      />
    </QueryClientProvider>,
  );
}

describe("Foto do grupo abre os contatos", () => {
  beforeAll(() => {
    if (!window.matchMedia) {
      window.matchMedia = (() => ({
        matches: false,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      })) as unknown as typeof window.matchMedia;
    }
  });

  it("um clique na foto abre a lista de contatos do grupo", async () => {
    renderHeader();
    const photo = screen.getByRole("button", { name: "Ver contatos do grupo" });
    fireEvent.click(photo);
    await waitFor(() => expect(screen.getByText("Contatos do grupo")).toBeInTheDocument(), { timeout: 4000 });
    await waitFor(() => expect(screen.getByText("Cliente X")).toBeInTheDocument(), { timeout: 4000 });
    expect(screen.getByText("Bruno")).toBeInTheDocument();
  });
});
