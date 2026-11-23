import { describe, it, expect } from "vitest";
import { withTvToken } from "../../../../supabase/functions/_shared/tvToken";
import { toAnnualUrl } from "../../../../supabase/functions/_shared/tvMonthStart";
const ins = "https://iamroy.app/insights/05fe3fc0-139f-4de2-b46c-da526bcd022a?periodo=este_mes&setor=vendas";
describe("chave de TV no link entregue", () => {
  it("acrescenta tv_token em painel de Insights do Roy", () => { expect(new URL(withTvToken(ins, "abc")!).searchParams.get("tv_token")).toBe("abc"); });
  it("mantém o token ao trocar para a visão anual", () => {
    const u = new URL(withTvToken(toAnnualUrl(ins)!, "abc")!);
    expect(u.searchParams.get("periodo")).toBe("este_ano"); expect(u.searchParams.get("tv_token")).toBe("abc");
  });
  it("sem chave, link igual", () => { expect(withTvToken(ins, null)).toBe(ins); });
  it("YouTube e Central de Tráfego saem como estão", () => {
    for (const x of ["https://www.youtube.com/playlist?list=1", "https://eternum-luxe-hub.lovable.app/tv?periodo=mes"]) expect(withTvToken(x, "abc")).toBe(x);
  });
});
