import { describe, expect, it } from "vitest";
import { hideInternalTrialNotice } from "./subscriptionPresentation";

describe("internal trial notice", () => {
  it("does not present Arthur's internal access as a trial", () => {
    expect(hideInternalTrialNotice("arthur.mudri@hotmail.com")).toBe(true);
  });
  it("does not present Carmen (RH) internal access as a trial", () => {
    expect(hideInternalTrialNotice("rh2@eternumoficial.com")).toBe(true);
    expect(hideInternalTrialNotice("RH2@EternumOficial.com")).toBe(true);
  });
  it("does not present Jessica Campos (Marketing) internal access as a trial", () => {
    expect(hideInternalTrialNotice("jessicacampos@anjosbususiness.com.br")).toBe(true);
    expect(hideInternalTrialNotice("JessicaCampos@AnjosBususiness.com.br")).toBe(true);
  });
  it("preserves existing corporate exceptions", () => {
    expect(hideInternalTrialNotice("lucasdossantos@anjosbusiness.com")).toBe(true);
    expect(hideInternalTrialNotice("equipe@anjosbusiness.com.br")).toBe(true);
    expect(hideInternalTrialNotice("m.quintana@me.com")).toBe(true);
    expect(hideInternalTrialNotice("coachevertonsantos@gmail.com")).toBe(true);
  });
  it("does not hide trial notices for unrelated or missing identities", () => {
    expect(hideInternalTrialNotice("cliente@hotmail.com")).toBe(false);
    expect(hideInternalTrialNotice(null)).toBe(false);
  });
});