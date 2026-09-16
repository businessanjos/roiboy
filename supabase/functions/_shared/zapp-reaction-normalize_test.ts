import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  isZappReaction,
  normalizeZappReaction,
} from "./zapp-reaction-normalize.ts";

Deno.test("recognizes a flat UAZAPI reaction", () => {
  const message = {
    messageType: "reaction",
    messageid: "REACTION_EVENT_ID",
    quoted: "TARGET_MESSAGE_ID",
    reaction: "👍",
    sender: "5511999999999@s.whatsapp.net",
  };
  assertEquals(isZappReaction(message), true);
  assertEquals(normalizeZappReaction(message), {
    targetId: "TARGET_MESSAGE_ID",
    emoji: "👍",
    fromMe: false,
    senderJid: "5511999999999@s.whatsapp.net",
    senderName: null,
  });
});

Deno.test("recognizes a nested reaction missed by the old gate", () => {
  const message = {
    text: "[reação]",
    message: {
      reactionMessage: {
        key: { id: "TARGET_MESSAGE_ID", fromMe: true },
        text: "❤️",
      },
    },
  };
  assertEquals(isZappReaction(message), true);
  assertEquals(normalizeZappReaction(message)?.targetId, "TARGET_MESSAGE_ID");
  assertEquals(normalizeZappReaction(message)?.emoji, "❤️");
  assertEquals(normalizeZappReaction(message)?.fromMe, true);
});

Deno.test("keeps an empty reaction as a removal event", () => {
  const message = {
    type: "reaction",
    messageid: "TARGET_MESSAGE_ID",
    reaction: "",
    text: "[reação]",
    fromMe: true,
  };
  assertEquals(isZappReaction(message), true);
  assertEquals(normalizeZappReaction(message)?.targetId, "TARGET_MESSAGE_ID");
  assertEquals(normalizeZappReaction(message)?.emoji, "");
});

Deno.test("does not classify an intentional emoji message as a reaction", () => {
  const message = { messageType: "text", text: "👍" };
  assertEquals(isZappReaction(message), false);
  assertEquals(normalizeZappReaction(message), null);
});