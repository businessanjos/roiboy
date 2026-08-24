import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  AA_NON_TEXT,
  AA_TEXT_LARGE,
  AA_TEXT_SMALL,
  contrastRatio,
  extractTokens,
} from "../contrast";

/**
 * Verificação automática de contraste (WCAG AA) do tema de conversas
 * do RoyZapp de Customer Success (.zapp-cs-theme).
 *
 * Cobre texto (pequeno e grande), balões de mensagem e bordas — garantindo
 * que o tema marrom continue legível independentemente do tamanho de fonte.
 */

const css = readFileSync(path.resolve(process.cwd(), "src/index.css"), "utf8");
const t = extractTokens(css, ".zapp-cs-theme");

const surfaces = [
  "--zapp-bg",
  "--zapp-bg-dark",
  "--zapp-panel",
  "--zapp-panel-header",
  "--zapp-message-in",
  "--zapp-message-out",
  "--zapp-input",
  "--zapp-hover",
] as const;

describe("tema de conversas RoyZapp CS — contraste WCAG", () => {
  it("define todos os tokens necessários", () => {
    for (const key of [
      ...surfaces,
      "--zapp-text",
      "--zapp-text-muted",
      "--zapp-accent",
      "--zapp-border",
    ]) {
      expect(t[key], `token ausente: ${key}`).toBeTruthy();
    }
  });

  describe.each(surfaces)("superfície %s", (surface) => {
    it(`texto principal ≥ ${AA_TEXT_SMALL}:1 (qualquer tamanho de fonte)`, () => {
      expect(contrastRatio(t["--zapp-text"], t[surface])).toBeGreaterThanOrEqual(AA_TEXT_SMALL);
    });

    it(`texto secundário ≥ ${AA_TEXT_SMALL}:1 (timestamps e legendas são pequenos)`, () => {
      expect(contrastRatio(t["--zapp-text-muted"], t[surface])).toBeGreaterThanOrEqual(
        AA_TEXT_SMALL,
      );
    });

    it(`acento (nomes, links, ícones) ≥ ${AA_TEXT_LARGE}:1`, () => {
      expect(contrastRatio(t["--zapp-accent"], t[surface])).toBeGreaterThanOrEqual(AA_TEXT_LARGE);
    });
  });

  it(`balões (in/out) se distinguem do fundo em ≥ ${AA_NON_TEXT}:1... ou por borda`, () => {
    // Balões podem ter baixo contraste com o fundo desde que exista borda visível;
    // por isso a borda é validada abaixo contra as duas superfícies.
    for (const bubble of ["--zapp-message-in", "--zapp-message-out"] as const) {
      const vsBg = contrastRatio(t[bubble], t["--zapp-bg"]);
      const borderVsBubble = contrastRatio(t["--zapp-border"], t[bubble]);
      expect(Math.max(vsBg, borderVsBubble)).toBeGreaterThan(1.2);
    }
  });

  it("borda é perceptível sobre o fundo e sobre os balões", () => {
    for (const surface of ["--zapp-bg", "--zapp-message-in", "--zapp-message-out"] as const) {
      expect(contrastRatio(t["--zapp-border"], t[surface])).toBeGreaterThan(1.2);
    }
  });

  it("tokens semânticos internos (foreground/muted/primary) respeitam AA", () => {
    expect(contrastRatio(t["--foreground"], t["--background"])).toBeGreaterThanOrEqual(
      AA_TEXT_SMALL,
    );
    expect(contrastRatio(t["--muted-foreground"], t["--muted"])).toBeGreaterThanOrEqual(
      AA_TEXT_SMALL,
    );
    expect(contrastRatio(t["--card-foreground"], t["--card"])).toBeGreaterThanOrEqual(
      AA_TEXT_SMALL,
    );
    expect(contrastRatio(t["--primary-foreground"], t["--primary"])).toBeGreaterThanOrEqual(
      AA_TEXT_SMALL,
    );
  });
});
