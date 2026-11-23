import { describe, it, expect } from "vitest";
import { proxiedUrl, readTvToken } from "../tvTokenBoot";
const B = import.meta.env.VITE_SUPABASE_URL as string;
describe("chave de TV no navegador", () => {
  it("leituras do banco vão para o tv-proxy", () => {
    expect(proxiedUrl(`${B}/rest/v1/deals?select=id`)).toBe(`${B}/functions/v1/tv-proxy/rest/v1/deals?select=id`);
  });
  it("endereços de fora não passam pelo proxy", () => { expect(proxiedUrl("https://youtube.com/x")).toBeNull(); });
  it("chave só vale em painel de Insights", () => {
    expect(readTvToken("/insights/05fe3fc0-139f-4de2-b46c-da526bcd022a", "?tv_token=abc")).toBe("abc");
    expect(readTvToken("/clients", "?tv_token=abc")).toBeNull();
  });
});
