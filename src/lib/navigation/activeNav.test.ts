import { describe, it, expect } from "vitest";
import { pickActiveNavIndex } from "./activeNav";

describe("pickActiveNavIndex", () => {
  const items = ["/roy-zapp?sector=vendas&view=inbox", "/roy-zapp?sector=vendas&view=analytics", "/pipeline", "/pipeline/settings"];

  it("diferencia abas pela query", () => {
    expect(pickActiveNavIndex(items, "/roy-zapp", "?sector=vendas&view=analytics")).toBe(1);
    expect(pickActiveNavIndex(items, "/roy-zapp", "?view=inbox&sector=vendas&chat=1")).toBe(0);
  });
  it("prefere o caminho mais específico", () => {
    expect(pickActiveNavIndex(items, "/pipeline/settings", "")).toBe(3);
    expect(pickActiveNavIndex(items, "/pipeline/123", "")).toBe(2);
  });
  it("retorna -1 sem correspondência", () => {
    expect(pickActiveNavIndex(items, "/leads", "")).toBe(-1);
    expect(pickActiveNavIndex(["/pipe"], "/pipeline", "")).toBe(-1);
  });
});

import { resolveActiveTarget } from "./activeNav";
describe("resolveActiveTarget", () => {
  const all = ["/clients", "/clients/medicos", "/clients/checkpoints", "/marketing/content-hq", "/marketing/content-hq?tab=redes", "/rh", "/rh/benefits"];
  it("filho mais específico vence o pai", () => {
    expect(resolveActiveTarget(all, "/clients/medicos", "")).toBe("/clients/medicos");
    expect(resolveActiveTarget(all, "/rh/benefits", "")).toBe("/rh/benefits");
    expect(resolveActiveTarget(all, "/clients/123", "")).toBe("/clients");
  });
  it("query decide entre irmãos", () => {
    expect(resolveActiveTarget(all, "/marketing/content-hq", "")).toBe("/marketing/content-hq");
    expect(resolveActiveTarget(all, "/marketing/content-hq", "?tab=redes&x=1")).toBe("/marketing/content-hq?tab=redes");
  });
});
