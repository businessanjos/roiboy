import { expect, it } from "vitest";
import { zappMentionName } from "../zappMentionName";

it("preserves Bruno Suporte for the specific support number", () => {
  expect(zappMentionName("Eternum Suporte", "+5551995471095")).toBe("Bruno Suporte");
  expect(zappMentionName("Eternum Suporte", "51995471095@s.whatsapp.net")).toBe("Bruno Suporte");
});

it("keeps only the first name for other people", () => {
  expect(zappMentionName("Lucas Gabriel dos Santos", "5511999990001")).toBe("Lucas");
});
import { zappMentionName as zmn } from "../zappMentionName";
import { it as it2, expect as ex2 } from "vitest";
it2("remove prefixo Interno:", () => {
  ex2(zmn("Interno: Lucas – Tec Eternum")).toBe("Lucas");
  ex2(zmn("Interno:")).toBe("");
});
