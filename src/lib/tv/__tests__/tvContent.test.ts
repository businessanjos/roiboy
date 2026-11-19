import { describe, it, expect } from "vitest";
import { isYoutubePlaylist, tvContentKind, tvCapabilities } from "../tvUrl";

describe("tipo de conteúdo da TV", () => {
  it("link do YouTube com list= é Playlist", () => {
    expect(tvContentKind("https://www.youtube.com/playlist?list=PLZwqV1vZDYViNXeNDGtpAzoTB0fsNIcbe")).toBe("playlist");
  });
  it("YouTube sem list= não é Playlist", () => {
    expect(isYoutubePlaylist("https://www.youtube.com/watch?v=abc")).toBe(false);
  });
  it("dashboard do Insights é Dashboard", () => {
    expect(tvContentKind("https://iamroy.app/insights/77cb0a0e-dcc9-4e2c-a284-2d012b4c20d1?tv=1")).toBe("dashboard");
  });
  it("TV-9 não tem captura nem aviso; TV-1 tem", () => {
    expect(tvCapabilities(9)).toEqual({ screenshot: false, toast: false, exactVolume: false, screenOff: false });
    expect(tvCapabilities(1).screenshot).toBe(true);
  });
});
