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

  it("monta cláusulas de user_name/user_email com o termo escapado e entre aspas", () => {
    const filter = buildAuditSearchFilter("joão");
    expect(filter).toContain('user_name.ilike."%joão%"');
    expect(filter).toContain('user_email.ilike."%joão%"');
  });

  it("escapa % e , do termo de busca", () => {
    const filter = buildAuditSearchFilter("100%,ok");
    expect(filter).not.toBeNull();
    expect(filter).toContain('user_name.ilike."%100ok%"');
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

  it("delimita entre aspas um termo com parênteses e ponto (ex.: 'Depto. (ID)') sem quebrar o filtro", () => {
    const filter = buildAuditSearchFilter("Depto. (ID)");
    expect(filter).not.toBeNull();
    // o valor inteiro entre aspas, sem parênteses/pontos soltos fora delas
    expect(filter).toContain('user_name.ilike."%Depto. (ID)%"');
    expect(filter).toContain('user_email.ilike."%Depto. (ID)%"');
    // deve casar com o rótulo correspondente (hr_department_id => "Depto. (ID)")
    expect(filter).toContain("changed_fields->hr_department_id.eq.true");
    // cada cláusula de ilike deve ter o valor todo entre aspas duplas balanceadas
    const quoted = filter!.match(/ilike\."([^"]|\\")*"/g) || [];
    expect(quoted.length).toBe(2);
  });

  it("gera mais de 20 cláusulas de changed_fields quando o termo é muito genérico, e o mesmo filtro serve tanto para a busca paginada quanto para o count", () => {
    // termo curto o bastante para casar com muitos rótulos de FIELD_LABELS
    const filter = buildAuditSearchFilter("a");
    expect(filter).not.toBeNull();
    const fieldClauses = filter!.split(",").filter((c) => c.includes("changed_fields->"));
    expect(fieldClauses.length).toBeGreaterThan(20);
    // o mesmo filtro, chamado novamente com o mesmo termo (ex.: para count e para dados),
    // deve ser idêntico — determinístico e reutilizável em ambas as consultas.
    const filterAgain = buildAuditSearchFilter("a");
    expect(filterAgain).toBe(filter);
  });
});
