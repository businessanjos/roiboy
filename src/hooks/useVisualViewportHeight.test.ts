import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { computeAppHeight, useVisualViewportHeight } from "./useVisualViewportHeight";

class FakeVV extends EventTarget { height = 844; scale = 1; width = 390; offsetTop = 0; }
let vv: FakeVV;
const prop = () => document.documentElement.style.getPropertyValue("--app-vh");

beforeEach(() => {
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => { cb(0); return 1; });
  vv = new FakeVV();
  Object.defineProperty(window, "visualViewport", { value: vv, configurable: true });
  Object.defineProperty(window, "innerHeight", { value: 844, configurable: true });
  Object.defineProperty(window, "innerWidth", { value: 390, configurable: true });
  document.documentElement.style.removeProperty("--app-vh");
});

describe("useVisualViewportHeight", () => {
  it("teclado reduz visualViewport → aplica altura; fechar → volta a 100dvh", () => {
    renderHook(() => useVisualViewportHeight());
    expect(prop()).toBe("");
    vv.height = 500; vv.dispatchEvent(new Event("resize"));
    expect(prop()).toBe("500px");
    vv.height = 844; vv.dispatchEvent(new Event("resize"));
    expect(prop()).toBe("");
  });
  it("zoom (scale≠1) não altera altura nem rola a janela", () => {
    const scrollTo = vi.fn(); window.scrollTo = scrollTo as any;
    renderHook(() => useVisualViewportHeight());
    vv.scale = 2; vv.height = 422; vv.offsetTop = 200; vv.dispatchEvent(new Event("resize"));
    expect(prop()).toBe("");
    expect(scrollTo).not.toHaveBeenCalled();
  });
  it("desktop nunca aplica", () => {
    expect(computeAppHeight({ height: 500, scale: 1 }, 900, 1440)).toBe("clear");
  });
});
