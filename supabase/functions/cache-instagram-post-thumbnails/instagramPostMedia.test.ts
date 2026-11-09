import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { instagramPostCode, instagramPostMediaUrl } from "./instagramPostMedia.ts";

Deno.test("extrai o código de posts, reels e links com parâmetros", () => {
  assertEquals(instagramPostCode("https://www.instagram.com/p/DfcIgAjRsZ_/"), "DfcIgAjRsZ_");
  assertEquals(instagramPostCode("https://www.instagram.com/reel/ABC-123_?igsh=xyz"), "ABC-123_");
  assertEquals(instagramPostCode("https://www.instagram.com/reels/XYZ789/"), "XYZ789");
});

Deno.test("monta o endereço público da imagem sem depender de token", () => {
  assertEquals(
    instagramPostMediaUrl("https://www.instagram.com/p/DfcIgAjRsZ_/"),
    "https://www.instagram.com/p/DfcIgAjRsZ_/media/?size=l",
  );
  assertEquals(instagramPostMediaUrl("https://example.com/post"), null);
});
