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
    expect(filter).toContain('title.ilike."%maria%"');
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

  it("escape do ILIKE trata só curingas e barra (gramática fica para as aspas)", () => {
    expect(escapeIlikeTerm("50%_off,(promo)")).toBe("50\\%\\_off,(promo)");
  });
});

/**
 * Parser representativo da gramática de lógica do PostgREST
 * (`or=(cond,cond,...)`): separa condições por vírgula de nível superior,
 * respeita parênteses e valores entre aspas duplas (com `\\` escapando o
 * próximo caractere) e rejeita reservados fora de aspas — como o PostgREST,
 * que responde PGRST100 nesse caso.
 */
function parsePostgrestOr(input: string): Array<{ column: string; op: string; value: string }> {
  const parts: string[] = [];
  let cur = "";
  let depth = 0;
  let inQuote = false;
  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    if (inQuote) {
      cur += c;
      if (c === "\\") cur += input[++i];
      else if (c === '"') inQuote = false;
      continue;
    }
    if (c === '"') inQuote = true;
    else if (c === "(") depth++;
    else if (c === ")") {
      depth--;
      if (depth < 0) throw new Error("PGRST100: parêntese inesperado");
    } else if (c === "," && depth === 0) {
      parts.push(cur);
      cur = "";
      continue;
    }
    cur += c;
  }
  if (inQuote || depth !== 0) throw new Error("PGRST100: aspas/parênteses não fechados");
  parts.push(cur);
  return parts.map((p) => {
    const m = p.match(/^([a-z_]+)\.([a-z]+)\.(.*)$/s);
    if (!m) throw new Error(`PGRST100: condição inválida ${p}`);
    let value = m[3];
    if (m[2] === "in") return { column: m[1], op: m[2], value };
    if (value.startsWith('"')) {
      if (!value.endsWith('"')) throw new Error("PGRST100");
      value = value.slice(1, -1).replace(/\\(.)/g, "$1");
    } else if (/[,()"]/.test(value)) {
      throw new Error(`PGRST100: reservado sem aspas em ${p}`);
    }
    return { column: m[1], op: m[2], value };
  });
}

describe("buildDeletedDealsOrFilter — gramática do PostgREST", () => {
  const cases = ["Empresa (SP)", "Silva, João", 'Clínica "Sorriso"', "barra \\ final", "50% off_x"];
  for (const term of cases) {
    it(`"${term}" gera condições válidas com o valor literal preservado`, () => {
      const filter = buildDeletedDealsOrFilter({
        term,
        matchingUserIds: ["u-1"],
        matchingAuthIds: ["a-1"],
      })!;
      const conds = parsePostgrestOr(filter);
      expect(conds.map((c) => c.column)).toEqual([
        "title",
        "contact_name",
        "contact_email",
        "responsible_user_id",
        "deleted_by",
      ]);
      const expected = `%${escapeIlikeTerm(term)}%`;
      for (const c of conds.slice(0, 3)) {
        expect(c.op).toBe("ilike");
        expect(c.value).toBe(expected);
      }
      expect(conds[3].value).toBe("(u-1)");
      expect(conds[4].value).toBe("(a-1)");
    });
  }

  it("o formato antigo (sem aspas) seria rejeitado pelo parser", () => {
    expect(() => parsePostgrestOr("title.ilike.%Empresa (SP)%,contact_name.ilike.%x%")).toThrow(/PGRST100/);
  });
});
