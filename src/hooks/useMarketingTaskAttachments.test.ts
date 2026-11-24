import { describe, expect, it, vi } from "vitest";
const signing = vi.hoisted(() => vi.fn());
vi.mock("@/hooks/useCurrentUser", () => ({ useCurrentUser: () => ({ currentUser: null }) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { storage: { from: (bucket: string) => ({ createSignedUrl: (path: string, seconds: number) => signing(bucket, path, seconds) }) } } }));
const { taskAttachmentUrl } = await import("./useMarketingTaskAttachments");
const base = { name: "Briefing.pdf", size: 10, type: "file" as const, uploaded_at: "2026-11-24", url: "" };
describe("Abertura segura de anexos", () => {
  it("pede endereço temporário do anexo privado usando o acesso atual", async () => {
    signing.mockResolvedValue({ data: { signedUrl: "https://example.test/signed" }, error: null });
    expect(await taskAttachmentUrl({ ...base, bucket: "marketing-task-files", path: "account/brief.pdf" })).toBe("https://example.test/signed");
    expect(signing).toHaveBeenCalledWith("marketing-task-files", "account/brief.pdf", 1800);
  });
  it("não transforma recusa de acesso em endereço público", async () => {
    signing.mockResolvedValue({ data: null, error: new Error("denied") });
    await expect(taskAttachmentUrl({ ...base, path: "other/brief.pdf" })).rejects.toThrow("Não foi possível abrir");
  });
  it("mantém anexos antigos https e rejeita endereços executáveis", async () => {
    expect(await taskAttachmentUrl({ ...base, url: "https://example.test/legacy.pdf" })).toBe("https://example.test/legacy.pdf");
    await expect(taskAttachmentUrl({ ...base, url: "javascript:alert(1)" })).rejects.toThrow("inválido");
  });
});