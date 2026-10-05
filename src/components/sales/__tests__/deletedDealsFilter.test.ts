import { describe, it, expect } from "vitest";
import { buildDeletedDealsOrFilter, escapeIlikeTerm } from "../deletedDealsFilter";

describe("buildDeletedDealsOrFilter", () => {
  it("retorna null quando o termo é vazio (sem filtro de busca)", () => {
    expect(
      buildDeletedDealsOrFilter({ term: "", matchingUserIds: [], matchingAuthIds: [] })
    ).toBeNull();
  });

  it("busca por nome de responsável gera responsible_user_id.in(...) tanto para linhas quanto contagem", () => {
    const filter = buildDeletedDealsOrFilter({
      term: "maria",
      matchingUserIds: ["user-1", "user-2"],
      matchingAuthIds: [],
    });
    expect(filter).toContain("responsible_user_id.in.(user-1,user-2)");
    // continua incluindo os campos textuais padrão
    expect(filter).toContain("title.ilike.%maria%");
  });

  it("busca por nome de quem excluiu gera deleted_by.in(...)", () => {
    const filter = buildDeletedDealsOrFilter({
      term: "joão",
      matchingUserIds: [],
      matchingAuthIds: ["auth-1"],
    });
    expect(filter).toContain("deleted_by.in.(auth-1)");
  });

  it("não inclui in(...) quando nenhum usuário combina com o termo", () => {
    const filter = buildDeletedDealsOrFilter({ term: "xyz", matchingUserIds: [], matchingAuthIds: [] });
    expect(filter).not.toContain(".in.(");
  });

  it("inclui contact_phone.ilike quando o termo tem 4+ dígitos", () => {
    const filter = buildDeletedDealsOrFilter({ term: "11999887766", matchingUserIds: [], matchingAuthIds: [] });
    expect(filter).toContain("contact_phone.ilike.%11999887766%");
  });

  it("escapa caracteres especiais do ILIKE/or()", () => {
    expect(escapeIlikeTerm("50%_off,(promo)")).toBe("50\\%\\_off\\,\\(promo\\)");
  });
});
