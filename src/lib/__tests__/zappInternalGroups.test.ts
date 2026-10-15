import { describe, it, expect } from "vitest";
import { isInternalGroup, showsWaitIndicator } from "@/lib/zappInternalGroups";

const ourGroup = (name: string) => isInternalGroup(name, true, false);

describe("regra de espera vale só para os nossos grupos", () => {
  it("reconhece os grupos internos citados", () => {
    expect(ourGroup("EC | Eternum Club")).toBe(true);
    expect(ourGroup("EM | Eternum Mentoring")).toBe(true);
    expect(ourGroup("EP club")).toBe(true);
    expect(ourGroup("Financeiro | Eternum Club")).toBe(true);
    expect(ourGroup("bugs roy")).toBe(true);
    expect(ourGroup("Tech Suport - Eternum")).toBe(true);
    expect(ourGroup("Cancelamentos - Eternum Club")).toBe(true);
    expect(ourGroup("Congelamentos - Eternum Club")).toBe(true);
  });

  it("não trata como interno conversa individual nem grupo de cliente", () => {
    expect(isInternalGroup("Eclair Estética Avançada", false, false)).toBe(false);
    expect(isInternalGroup("Eclair Estética Avançada", false, true)).toBe(false);
    expect(isInternalGroup("Marcelo Araújo & Drª Natália - ECLAIR", true, false)).toBe(false);
  });

  it("nos nossos grupos o laranja só aparece com mensagem não lida", () => {
    expect(showsWaitIndicator({ internal: true, status: "pending", unreadCount: 3 })).toBe(true);
    expect(showsWaitIndicator({ internal: true, status: "pending", unreadCount: 0 })).toBe(false);
    expect(showsWaitIndicator({ internal: true, status: "waiting", unreadCount: 0 })).toBe(false);
  });

  it("em conversa de cliente a régua continua igual: espera mesmo sem não lida", () => {
    expect(showsWaitIndicator({ internal: false, status: "pending", unreadCount: 0 })).toBe(true);
    expect(showsWaitIndicator({ internal: false, status: "waiting", unreadCount: 0 })).toBe(false);
    expect(showsWaitIndicator({ internal: false, status: "active", unreadCount: 4 })).toBe(false);
  });
});
