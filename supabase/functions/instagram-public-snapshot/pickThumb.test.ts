import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { pickThumb } from "./pickThumb.ts";

// ---------- Fixtures (formato HikerAPI / Instagram private API) ----------

// Post simples (foto): apenas image_versions2.candidates
const fixturePhotoSimple = {
  id: "111_222",
  pk: "111",
  code: "ABC123",
  media_type: 1,
  image_versions2: {
    candidates: [
      { url: "https://cdn.example.com/photo-1080.jpg", width: 1080 },
      { url: "https://cdn.example.com/photo-640.jpg", width: 640 },
    ],
  },
};

// Reel / vídeo: tem video_versions + image_versions2 (capa)
const fixtureReel = {
  id: "222_333",
  pk: "222",
  code: "REEL01",
  media_type: 2,
  product_type: "clips",
  video_url: "https://cdn.example.com/reel.mp4",
  video_versions: [{ url: "https://cdn.example.com/reel.mp4" }],
  image_versions2: {
    candidates: [{ url: "https://cdn.example.com/reel-cover.jpg" }],
  },
};

// Reel "antigo": apenas thumbnail_url
const fixtureReelLegacy = {
  id: "222b",
  pk: "222b",
  code: "REELOLD",
  media_type: 2,
  thumbnail_url: "https://cdn.example.com/legacy-thumb.jpg",
};

// Carrossel (album): raiz sem imagem, primeira mídia tem image_versions2
const fixtureCarousel = {
  id: "333_444",
  pk: "333",
  code: "CAR001",
  media_type: 8,
  carousel_media: [
    {
      id: "333_444_1",
      media_type: 1,
      image_versions2: {
        candidates: [{ url: "https://cdn.example.com/carousel-1.jpg" }],
      },
    },
    {
      id: "333_444_2",
      media_type: 1,
      image_versions2: {
        candidates: [{ url: "https://cdn.example.com/carousel-2.jpg" }],
      },
    },
  ],
};

// Carrossel onde a primeira mídia traz thumbnail_url direto
const fixtureCarouselDirect = {
  id: "333b",
  media_type: 8,
  carousel_media: [
    { id: "333b_1", thumbnail_url: "https://cdn.example.com/car-direct.jpg" },
  ],
};

// Formato "resources" (variante antiga do display)
const fixtureResources = {
  id: "444_555",
  code: "RES001",
  media_type: 1,
  resources: [
    {
      thumbnail_src: "https://cdn.example.com/resource-thumb.jpg",
    },
  ],
};

// Formato bem antigo: image_versions.items[0].url
const fixtureLegacyImageVersions = {
  id: "555_666",
  code: "OLD001",
  media_type: 1,
  image_versions: {
    items: [{ url: "https://cdn.example.com/legacy-iv.jpg" }],
  },
};

// Display direto (display_url / display_uri usados por scrapers GraphQL)
const fixtureDisplayUri = {
  id: "666_777",
  code: "DIS001",
  display_uri: "https://cdn.example.com/display-uri.jpg",
};

const fixtureDisplayUrl = {
  id: "777_888",
  code: "DIS002",
  display_url: "https://cdn.example.com/display-url.jpg",
};

// Sem nenhuma imagem aproveitável → null
const fixtureNoImage = {
  id: "999",
  code: "NONE",
  media_type: 1,
};

// ---------- Tests ----------

Deno.test("pickThumb: foto simples usa image_versions2.candidates[0]", () => {
  assertEquals(pickThumb(fixturePhotoSimple), "https://cdn.example.com/photo-1080.jpg");
});

Deno.test("pickThumb: reel novo usa capa image_versions2", () => {
  assertEquals(pickThumb(fixtureReel), "https://cdn.example.com/reel-cover.jpg");
});

Deno.test("pickThumb: reel antigo usa thumbnail_url direto", () => {
  assertEquals(pickThumb(fixtureReelLegacy), "https://cdn.example.com/legacy-thumb.jpg");
});

Deno.test("pickThumb: carrossel pega image_versions2 do primeiro filho", () => {
  assertEquals(pickThumb(fixtureCarousel), "https://cdn.example.com/carousel-1.jpg");
});

Deno.test("pickThumb: carrossel com thumbnail_url direto no filho", () => {
  assertEquals(pickThumb(fixtureCarouselDirect), "https://cdn.example.com/car-direct.jpg");
});

Deno.test("pickThumb: usa resources[0].thumbnail_src quando presente", () => {
  assertEquals(pickThumb(fixtureResources), "https://cdn.example.com/resource-thumb.jpg");
});

Deno.test("pickThumb: cai em image_versions.items legado", () => {
  assertEquals(pickThumb(fixtureLegacyImageVersions), "https://cdn.example.com/legacy-iv.jpg");
});

Deno.test("pickThumb: aceita display_uri", () => {
  assertEquals(pickThumb(fixtureDisplayUri), "https://cdn.example.com/display-uri.jpg");
});

Deno.test("pickThumb: aceita display_url", () => {
  assertEquals(pickThumb(fixtureDisplayUrl), "https://cdn.example.com/display-url.jpg");
});

Deno.test("pickThumb: retorna null quando nada está disponível", () => {
  assertEquals(pickThumb(fixtureNoImage), null);
});

Deno.test("pickThumb: lida com input nulo/inválido sem lançar", () => {
  assertEquals(pickThumb(null), null);
  assertEquals(pickThumb(undefined), null);
  assertEquals(pickThumb("string" as unknown), null);
});

Deno.test("pickThumb: prioridade — thumbnail_url > image_versions2 > carousel", () => {
  const m = {
    thumbnail_url: "https://cdn.example.com/priority-direct.jpg",
    image_versions2: { candidates: [{ url: "https://cdn.example.com/iv2.jpg" }] },
    carousel_media: [{ thumbnail_url: "https://cdn.example.com/child.jpg" }],
  };
  assertEquals(pickThumb(m), "https://cdn.example.com/priority-direct.jpg");
});
