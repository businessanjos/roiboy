import { describe, expect, it } from "vitest";
import {
  classifyGatewayStatus,
  buildSalesCallAuditPrompt,
  SALES_CALL_SYSTEM_PROMPT,
  SalesCallAnalysisError,
} from "../../../supabase/functions/_shared/salesCallAnalysis";

describe("análise automática de calls do Meet", () => {
  it("pausa a fila quando a IA está sem créditos ou sem acesso", () => {
    expect(classifyGatewayStatus(402)).toBe("pause");
    expect(classifyGatewayStatus(403)).toBe("pause");
  });

  it("tenta de novo na próxima rodada quando a falha é temporária", () => {
    expect(classifyGatewayStatus(429)).toBe("retry");
    expect(classifyGatewayStatus(500)).toBe("retry");
    expect(classifyGatewayStatus(503)).toBe("retry");
  });

  it("não repete uma chamada rejeitada pelo próprio pedido", () => {
    expect(classifyGatewayStatus(400)).toBe("fail");
    expect(classifyGatewayStatus(404)).toBe("fail");
    expect(classifyGatewayStatus(200)).toBe("ok");
  });

  it("guarda o motivo e a decisão no erro da análise", () => {
    const err = new SalesCallAnalysisError("sem créditos", 402);
    expect(err.status).toBe(402);
    expect(err.outcome).toBe("pause");
    expect(err.message).toBe("sem créditos");
  });

  it("só cobra auditoria do manual quando a empresa tem base de conhecimento", () => {
    const semManual = buildSalesCallAuditPrompt("");
    expect(semManual).toBe(SALES_CALL_SYSTEM_PROMPT);
    expect(semManual).not.toContain("AUDITORIA OBRIGATÓRIA");

    const comManual = buildSalesCallAuditPrompt("\n\n=== MANUAL OFICIAL DE VENDAS DA EMPRESA ===");
    expect(comManual).toContain("MANUAL OFICIAL DE VENDAS DA EMPRESA");
    expect(comManual).toContain("AUDITORIA OBRIGATÓRIA");
  });
});
