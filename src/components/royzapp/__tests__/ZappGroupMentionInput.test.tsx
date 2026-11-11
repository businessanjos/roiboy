import { useState } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ZappGroupMentionInput } from "../ZappGroupMentionInput";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  functions: { invoke: vi.fn(async () => ({ data: { participants: [
    { PhoneNumber: "5511999990001", DisplayName: "Ana Clara" },
    { PhoneNumber: "5511999990002", DisplayName: "Anabela Silva" },
    { PhoneNumber: "5551995471095", DisplayName: "Eternum Suporte" },
  ] }, error: null })) },
  from: () => {
    const chain = {
      select: () => chain, eq: () => chain, or: () => chain,
      limit: async () => ({ data: [], error: null }),
    };
    return chain;
  },
} }));

afterEach(cleanup);

it("keeps the support identity in Bruno's mention even with the old WhatsApp name", async () => {
  const { onMentionInsert } = await composer();
  fireEvent.click(screen.getByRole("button", { name: /Bruno Suporte/ }));
  expect(onMentionInsert).toHaveBeenCalledExactlyOnceWith({
    phone: "5551995471095", jid: "5551995471095@s.whatsapp.net",
    name: "Bruno Suporte", is_lid: false,
  });
});

async function composer() {
  const onMentionInsert = vi.fn();
  function Composer() {
    const [value, setValue] = useState("");
    return <ZappGroupMentionInput value={value} onChange={setValue}
      onMentionInsert={onMentionInsert} groupJid="qa@g.us" />;
  }
  render(<Composer />);
  const input = screen.getByRole("textbox");
  fireEvent.change(input, { target: { value: "@" } });
  await screen.findByRole("button", { name: /Ana Clara/ });
  return { input, onMentionInsert };
}

it("does not tag Ana Clara while typing @Ana on the way to @Anabela", async () => {
  const { input, onMentionInsert } = await composer();
  for (const value of ["@A", "@An", "@Ana", "@Anab", "@Anabela"]) {
    fireEvent.change(input, { target: { value } });
    expect(onMentionInsert).not.toHaveBeenCalled();
  }
  fireEvent.click(screen.getByRole("button", { name: /Anabela Silva/ }));
  // A menção inserida usa só o primeiro nome, nunca o nome completo
  expect(onMentionInsert).toHaveBeenCalledExactlyOnceWith({
    phone: "5511999990002", jid: "5511999990002@s.whatsapp.net",
    name: "Anabela", is_lid: false,
  });
});

it("still resolves a pasted @Ana to its unique participant", async () => {
  const { input, onMentionInsert } = await composer();
  fireEvent.paste(input, { clipboardData: { getData: () => "@Ana" } });
  fireEvent.change(input, { target: { value: "@Ana" } });
  await waitFor(() => expect(onMentionInsert).toHaveBeenCalledExactlyOnceWith({
    phone: "5511999990001", jid: "5511999990001@s.whatsapp.net",
    name: "Ana", is_lid: false,
  }));
});

it("does not resolve an independently typed name when another mention is pasted", async () => {
  const { input, onMentionInsert } = await composer();
  fireEvent.change(input, { target: { value: "@Ana " } });
  fireEvent.paste(input, { clipboardData: { getData: () => "@Anabela" } });
  fireEvent.change(input, { target: { value: "@Ana @Anabela" } });
  await waitFor(() => expect(onMentionInsert).toHaveBeenCalledExactlyOnceWith({
    phone: "5511999990002", jid: "5511999990002@s.whatsapp.net",
    name: "Anabela", is_lid: false,
  }));
});