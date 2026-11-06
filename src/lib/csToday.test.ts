import { describe, it, expect } from "vitest";
import { eventTasks, monthlyTasks, contactTasks, bucketTasks } from "@/lib/csToday";
import { resolveProcessLink } from "@/lib/csClientLinks";

describe("tela Hoje", () => {
  it("Encontro Online gera lembretes 15, 10, 3, 1 dia antes, no dia e no dia seguinte", () => {
    const t = eventTasks([{ id: "e", title: "Encontro Online Eternum", modality: "online", scheduled_at: "2026-11-20T17:00:00Z" }]);
    expect(t.map((x) => x.due)).toEqual(["2026-11-05", "2026-11-10", "2026-11-17", "2026-11-19", "2026-11-20", "2026-11-21"]);
  });
  it("Encontro Presencial gera PDF 60 dias antes, NPS no dia seguinte e gravação em 7 dias", () => {
    const t = eventTasks([{ id: "e", title: "Eternum Club - PRESENCIAL", modality: "presencial", scheduled_at: "2026-12-10T13:00:00Z" }]);
    expect(t.map((x) => x.due)).toEqual(["2026-10-11", "2026-12-11", "2026-12-17"]);
  });
  it("contato quinzenal só entra com 15 dias ou mais sem falar", () => {
    const t = contactTasks("2026-11-20", [
      { client_id: "a", full_name: "Ana", last_at: "2026-11-06T15:00:00Z" },
      { client_id: "b", full_name: "Bia", last_at: "2026-11-04T15:00:00Z" },
    ]);
    expect(t.map((x) => x.title)).toEqual(["Contato com Bia — 16 dias sem falar"]);
  });
  it("ciclo mensal: Wars no dia 1 e engajamento na última semana", () => {
    const t = monthlyTasks("2026-11-20", []);
    expect(t.some((x) => x.key.endsWith(":wars") || x.key.endsWith(":meta"))).toBe(false);
    expect(t.find((x) => x.key === "m:2026-11:engage")?.due).toBe("2026-11-24");
  });
  it("concluídas somem e adiadas mudam de dia", () => {
    const t = contactTasks("2026-11-20", [{ client_id: "b", full_name: "Bia", last_at: null }]);
    expect(bucketTasks(t, [], "2026-11-20").today.length).toBe(1);
    expect(bucketTasks(t, [{ task_key: t[0].key, status: "done", snooze_until: null }], "2026-11-20").today.length).toBe(0);
    expect(bucketTasks(t, [{ task_key: t[0].key, status: "snoozed", snooze_until: "2026-11-23" }], "2026-11-20").next.length).toBe(1);
  });
});

describe("links da cliente", () => {
  const c = { id: "11111111-2222-3333-4444-555555555555", full_name: "Ana Souza", instagram: "@ana.estetica" };
  it("monta cadastro, ficha e Instagram com os dados da cliente", () => {
    expect(resolveProcessLink("https://iamroy.app/f/f53653f9-85b3-4f42-8b86-57cecb553330?clientId=1d0fe50c-5b69-4f7e-bf32-7229bdcd2ab5", c)).toMatchObject({ url: `https://iamroy.app/f/f53653f9-85b3-4f42-8b86-57cecb553330?clientId=${c.id}` });
    expect(resolveProcessLink("https://iamroy.app/clients/1d0fe50c-5b69-4f7e-bf32-7229bdcd2ab5?tab=fichas", c)).toMatchObject({ url: `https://iamroy.app/clients/${c.id}?tab=fichas`, label: "Abrir ficha da Ana no Roy" });
    expect(resolveProcessLink("https://www.instagram.com/", c)).toMatchObject({ url: "https://www.instagram.com/ana.estetica" });
  });
  it("sem link da Ryka o botão avisa o que falta", () => {
    expect(resolveProcessLink("https://ryka.app/dashboard", c)).toMatchObject({ kind: "missing", field: "ryka_url" });
  });
});
