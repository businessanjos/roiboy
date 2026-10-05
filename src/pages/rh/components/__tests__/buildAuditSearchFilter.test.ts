import { describe, it, expect } from "vitest";
import { buildAuditSearchFilter } from "../CollaboratorAuditLog";

describe("buildAuditSearchFilter", () => {
  it("retorna null para busca vazia ou só espaços", () => {
    expect(buildAuditSearchFilter("")).toBeNull();
    expect(buildAuditSearchFilter("   ")).toBeNull();
  });

  it("retorna null quando a busca só contém caracteres removidos (% ou ,)", () => {
    expect(buildAuditSearchFilter("%,")).toBeNull();
  });

  it("monta cláusulas de user_name/user_email com o termo escapado", () => {
    const filter = buildAuditSearchFilter("joão");
    expect(filter).toContain("user_name.ilike.%joão%");
    expect(filter).toContain("user_email.ilike.%joão%");
  });

  it("escapa % e , do termo de busca", () => {
    const filter = buildAuditSearchFilter("100%,ok");
    expect(filter).not.toBeNull();
    expect(filter).toContain("user_name.ilike.%100ok%");
    expect(filter!).not.toMatch(/100%,ok/);
  });

  it("inclui changed_fields para rótulos de campo correspondentes (ex.: salário)", () => {
    const filter = buildAuditSearchFilter("salário");
    expect(filter).toContain("changed_fields->salary.eq.true");
  });

  it("não inclui cláusulas de changed_fields quando nenhum rótulo bate", () => {
    const filter = buildAuditSearchFilter("xyzxyz");
    expect(filter).not.toContain("changed_fields->");
  });

  it("junta as cláusulas com vírgula, pronto para .or()", () => {
    const filter = buildAuditSearchFilter("email");
    expect(filter!.split(",").length).toBeGreaterThanOrEqual(2);
  });
});
