// Especificações completas por canal para o rebranding Eternum
// Tudo o que precisa ser revisado, dimensões de artes, bio, copy, etc.

export type ChannelSpec = {
  key: string;
  name: string;
  category: "web" | "social" | "identity" | "internal";
  icon: string;
  // Dimensões de artes (px)
  assets?: { label: string; size: string; format?: string; note?: string }[];
  // Conteúdo de bio / perfil
  bio?: { field: string; limit?: string; recommendation: string; example?: string }[];
  // Links que devem aparecer no perfil
  links?: string[];
  // Checklist completo de revisão
  checklist: string[];
  // Itens que NÃO podem passar (referências da marca antiga)
  doNot?: string[];
  // Observações estratégicas
  notes?: string;
};

export const REBRANDING_SPECS: ChannelSpec[] = [
  // ============ WEB ============
  {
    key: "site",
    name: "Site Institucional",
    category: "web",
    icon: "Globe",
    assets: [
      { label: "Logo header", size: "240×60", format: "SVG + PNG", note: "Versão clara e escura" },
      { label: "Favicon", size: "32×32 / 192×192 / 512×512", format: "ICO + PNG" },
      { label: "OG Image (compartilhamento)", size: "1200×630", format: "JPG ≤ 200kb" },
      { label: "Hero principal", size: "1920×1080", format: "JPG/WebP" },
      { label: "Imagens de produto", size: "1200×800", format: "WebP" },
      { label: "Apple touch icon", size: "180×180", format: "PNG" },
    ],
    bio: [
      { field: "Title (SEO)", limit: "≤ 60 chars", recommendation: "Eternum | [Proposta de valor curta]" },
      { field: "Meta description", limit: "≤ 160 chars", recommendation: "Frase única, com keyword principal e CTA" },
    ],
    links: ["Instagram", "LinkedIn Empresa", "YouTube", "Spotify", "Política de Privacidade", "Termos"],
    checklist: [
      "Trocar logo header e footer (light + dark)",
      "Atualizar favicon e apple-touch-icon",
      "Substituir OG Image e meta tags (Twitter Card)",
      "Reescrever copy do hero e CTAs",
      "Atualizar página 'Sobre' com nova narrativa Eternum",
      "Atualizar e-mails de contato (@eternum)",
      "Configurar redirect 301 do domínio antigo (anjosbusiness → eternum)",
      "Atualizar Schema.org JSON-LD (Organization name, logo, url)",
      "Atualizar canonical tags e sitemap.xml",
      "Atualizar robots.txt se necessário",
      "Atualizar Google Analytics / GTM (nome da propriedade)",
      "Atualizar Search Console (adicionar novo domínio, manter antigo 6+ meses)",
      "Verificar todos os links internos quebrados",
      "Revisar páginas legais (Privacidade, Termos, LGPD)",
      "Atualizar formulários: assunto de e-mail, automações conectadas",
    ],
    doNot: [
      "Deixar logo antigo em qualquer página interna",
      "Esquecer screenshots e mockups de produtos antigos",
      "Manter cor primária antiga em botões/CTAs",
    ],
    notes: "Manter domínio antigo redirecionando por no mínimo 12 meses para preservar SEO.",
  },
  {
    key: "ads",
    name: "Anúncios pagos (Meta & Google)",
    category: "web",
    icon: "Megaphone",
    assets: [
      { label: "Meta Feed quadrado", size: "1080×1080", format: "JPG/MP4" },
      { label: "Meta Stories/Reels", size: "1080×1920", format: "MP4 ≤ 30s" },
      { label: "Meta Carrossel", size: "1080×1080", format: "2-10 cards" },
      { label: "Google Display Banner", size: "300×250 / 728×90 / 336×280 / 300×600 / 320×50", format: "JPG/PNG ≤ 150kb" },
      { label: "Google Discovery", size: "1200×628 / 1200×1200 / 960×1200", format: "JPG" },
      { label: "YouTube Ads", size: "1920×1080", format: "MP4 6-30s" },
    ],
    checklist: [
      "Pausar todas as campanhas ativas 24h antes do anúncio",
      "Atualizar nome da conta de anúncios (Meta Business + Google Ads)",
      "Trocar logo e nome em todos os criativos",
      "Atualizar UTMs (utm_source/medium continuam, utm_campaign novo)",
      "Atualizar Pixel name e Conversions API (server-side)",
      "Atualizar audiences salvas (nome de campanha)",
      "Reativar campanhas com creative novo + budget gradual (50% dia 1)",
      "Monitorar CPM/CTR primeiras 72h pós-troca",
    ],
    doNot: ["Reaproveitar criativos com logo Anjos Business", "Mudar pixel ID (perde histórico)"],
  },

  // ============ SOCIAL ============
  {
    key: "instagram-eternum",
    name: "Instagram Eternum",
    category: "social",
    icon: "Instagram",
    assets: [
      { label: "Foto de perfil", size: "320×320 (exibe 110×110)", format: "JPG/PNG", note: "Logo símbolo, não logo deitado" },
      { label: "Capa de destaque (Stories Highlights)", size: "1080×1920", format: "PNG", note: "Conjunto coeso de 5-9 capas" },
      { label: "Feed (quadrado)", size: "1080×1080", format: "JPG" },
      { label: "Feed (retrato)", size: "1080×1350", format: "JPG", note: "Formato que mais engaja" },
      { label: "Reels / Stories", size: "1080×1920", format: "MP4 ≤ 90s para Reels" },
      { label: "Carrossel", size: "1080×1350 (até 10 slides)", format: "JPG" },
    ],
    bio: [
      { field: "Nome de exibição", limit: "30 chars", recommendation: "Eternum • [tag curta]", example: "Eternum • Mentoria" },
      { field: "@username", limit: "30 chars", recommendation: "@eternum (ou @eternum.oficial se indisponível)" },
      { field: "Categoria", recommendation: "Empresa de educação / Consultor de negócios" },
      { field: "Bio", limit: "150 chars", recommendation: "Linha 1: proposta. Linha 2: prova social. Linha 3: CTA + emoji ↓" },
      { field: "Link", recommendation: "Link in bio (Linktree/Beacons) ou site próprio /links" },
    ],
    links: ["Site Eternum", "Próximo evento / lead magnet", "WhatsApp comercial", "YouTube", "Spotify"],
    checklist: [
      "Trocar @username (se disponível) — confirmar redirect/handle reserva",
      "Atualizar foto de perfil com logo símbolo Eternum",
      "Reescrever bio (150 chars) com nova proposta",
      "Atualizar link in bio (todos os destinos com novo domínio)",
      "Refazer capas de Stories Highlights (5-9 com identidade nova)",
      "Pin 3 posts no topo do feed com 'Bem-vindo à Eternum' / Manifesto / Próximo passo",
      "Postar carrossel oficial de anúncio do rebranding",
      "Atualizar templates de Stories (background, fonte)",
      "Atualizar resposta automática do Direct (Meta Business Suite)",
      "Verificar contato comercial (e-mail + telefone) atualizados",
      "Conectar/atualizar shop e catálogo se houver",
    ],
    doNot: [
      "Arquivar posts antigos (mantém histórico — apenas pin os novos no topo)",
      "Deixar capa de Highlight com logo antigo",
    ],
  },
  {
    key: "linkedin-empresa",
    name: "LinkedIn Empresa Eternum",
    category: "social",
    icon: "Linkedin",
    assets: [
      { label: "Logo (quadrado)", size: "400×400 (mín 300×300)", format: "PNG transparente" },
      { label: "Capa empresa", size: "1128×191", format: "JPG/PNG", note: "Atenção: corta nas bordas em mobile, deixar 'safe area' central" },
      { label: "Post imagem", size: "1200×627 (1.91:1) ou 1200×1200 (quadrado)", format: "JPG" },
      { label: "Carrossel (PDF)", size: "1080×1080 ou 1080×1350", format: "PDF ≤ 100MB / 300 páginas" },
      { label: "Vídeo", size: "1920×1080 (16:9) ou 1080×1920", format: "MP4 ≤ 5GB / 10min" },
    ],
    bio: [
      { field: "Nome da página", recommendation: "Eternum" },
      { field: "Tagline", limit: "120 chars", recommendation: "Frase única que resume a proposta" },
      { field: "Sobre", limit: "2000 chars", recommendation: "História, missão, números, prêmios, CTA" },
      { field: "Setor", recommendation: "Serviços profissionais / Educação profissional" },
      { field: "Especialidades", recommendation: "Até 20 keywords separadas por vírgula" },
    ],
    links: ["Website Eternum", "Sites de carreira (se aplicável)"],
    checklist: [
      "Solicitar mudança de nome da página (pode levar 24-72h)",
      "Atualizar logo e cover image (testar em mobile + desktop)",
      "Reescrever tagline e seção 'Sobre'",
      "Atualizar website, telefone, endereço",
      "Atualizar especialidades / keywords",
      "Notificar todos os funcionários para atualizar 'Empresa atual'",
      "Postar update oficial marcando time",
      "Atualizar templates de showcase pages se houver",
      "Verificar se reviews/avaliações migraram",
    ],
    doNot: ["Criar nova página (mata histórico de seguidores) — sempre RENOMEAR"],
    notes: "Mudança de nome preserva 100% dos seguidores e histórico de posts.",
  },
  {
    key: "linkedin-everton",
    name: "LinkedIn Everton Pieri",
    category: "social",
    icon: "Linkedin",
    assets: [
      { label: "Foto de perfil", size: "400×400", format: "JPG", note: "Foto profissional, fundo neutro" },
      { label: "Capa de perfil", size: "1584×396", format: "JPG", note: "Lado direito pode ser coberto pela foto em mobile" },
    ],
    bio: [
      { field: "Headline", limit: "220 chars", recommendation: "Cargo + Empresa + Proposta de valor + keywords | ex: 'Founder @ Eternum | Construindo...'" },
      { field: "Sobre", limit: "2600 chars", recommendation: "1ª pessoa, storytelling, jornada, números, CTA" },
      { field: "Experiência atual", recommendation: "Atualizar Anjos Business → Eternum (manter ambas para preservar histórico, OU renomear)" },
    ],
    checklist: [
      "Atualizar headline com 'Founder @ Eternum'",
      "Refazer capa de perfil com identidade Eternum",
      "Atualizar seção 'Sobre' com nova narrativa",
      "Adicionar/renomear cargo: 'Anjos Business' → 'Eternum' (mesma empresa, mesmo período)",
      "Atualizar 'Em destaque' com 3 posts/links Eternum",
      "Atualizar contatos (e-mail @eternum)",
      "Postar update pessoal contando a história do rebranding",
      "Atualizar URL personalizada se contiver 'anjos'",
      "Atualizar serviços oferecidos",
    ],
    doNot: ["Deletar experiências antigas (perde social proof)"],
  },
  {
    key: "linkedin-bruna",
    name: "LinkedIn Bruna Pieri",
    category: "social",
    icon: "Linkedin",
    assets: [
      { label: "Foto de perfil", size: "400×400", format: "JPG" },
      { label: "Capa de perfil", size: "1584×396", format: "JPG" },
    ],
    bio: [
      { field: "Headline", limit: "220 chars", recommendation: "Cargo + Empresa + Proposta" },
      { field: "Sobre", limit: "2600 chars", recommendation: "1ª pessoa, jornada, valores" },
    ],
    checklist: [
      "Atualizar headline com Eternum",
      "Refazer capa com identidade Eternum",
      "Atualizar 'Sobre'",
      "Renomear/atualizar cargo na empresa",
      "Atualizar 'Em destaque'",
      "Postar update pessoal",
      "Atualizar URL personalizada",
    ],
  },
  {
    key: "threads-everton",
    name: "Threads Everton",
    category: "social",
    icon: "AtSign",
    assets: [
      { label: "Foto de perfil", size: "320×320", format: "Sincroniza com Instagram" },
    ],
    bio: [
      { field: "Bio", limit: "150 chars", recommendation: "Pode ser igual ao Instagram OU mais conversacional. Threads premia texto cru." },
      { field: "Link", limit: "1 link", recommendation: "Link Eternum ou Linktree" },
    ],
    checklist: [
      "Atualizar foto (sincroniza via Instagram)",
      "Reescrever bio (mais informal que LinkedIn)",
      "Atualizar link da bio",
      "Pin 1 thread de boas-vindas Eternum",
    ],
  },
  {
    key: "threads-bruna",
    name: "Threads Bruna",
    category: "social",
    icon: "AtSign",
    assets: [{ label: "Foto de perfil", size: "320×320", format: "Sincroniza com Instagram" }],
    bio: [
      { field: "Bio", limit: "150 chars", recommendation: "Tom pessoal, alinhado com Instagram" },
      { field: "Link", limit: "1 link", recommendation: "Link Eternum" },
    ],
    checklist: [
      "Atualizar foto (sincroniza via Instagram)",
      "Reescrever bio",
      "Atualizar link da bio",
      "Pin 1 thread de boas-vindas",
    ],
  },
  {
    key: "spotify",
    name: "Spotify (Podcast)",
    category: "social",
    icon: "Music",
    assets: [
      { label: "Capa do show", size: "3000×3000 (mín 1400×1400)", format: "JPG/PNG ≤ 500KB", note: "Quadrada, sem texto pequeno" },
      { label: "Capa de episódio", size: "3000×3000", format: "JPG/PNG" },
      { label: "Trailer (áudio)", size: "≤ 60s", format: "MP3 128-320kbps" },
    ],
    bio: [
      { field: "Nome do podcast", limit: "100 chars", recommendation: "Eternum [+ subtítulo se necessário]" },
      { field: "Autor", recommendation: "Eternum" },
      { field: "Descrição", limit: "4000 chars", recommendation: "Proposta + sobre os apresentadores + frequência + CTA" },
      { field: "Categoria principal", recommendation: "Educação / Negócios" },
    ],
    checklist: [
      "Trocar capa do show (Spotify for Podcasters)",
      "Atualizar nome se necessário (pode demorar 24-48h)",
      "Reescrever descrição completa",
      "Atualizar nome do autor",
      "Refazer capas de episódios em destaque (5-10 mais ouvidos)",
      "Gravar trailer novo com 'agora somos Eternum'",
      "Distribuir mudança para Apple Podcasts, Google, Amazon Music (via RSS)",
      "Atualizar links nos shownotes dos próximos episódios",
    ],
    notes: "Mudar nome no RSS feed propaga para TODAS as plataformas automaticamente.",
  },
  {
    key: "youtube",
    name: "YouTube",
    category: "social",
    icon: "Youtube",
    assets: [
      { label: "Foto de perfil (canal)", size: "800×800", format: "PNG ≤ 4MB", note: "Exibe como círculo" },
      { label: "Banner/Arte do canal", size: "2560×1440", format: "JPG ≤ 6MB", note: "Safe area central: 1546×423 (visível em todos devices)" },
      { label: "Marca d'água do vídeo", size: "150×150", format: "PNG transparente" },
      { label: "Thumbnail de vídeo", size: "1280×720 (16:9)", format: "JPG/PNG ≤ 2MB" },
      { label: "Shorts thumbnail", size: "1080×1920", format: "JPG/PNG" },
      { label: "End screen", size: "1280×720", format: "Última 5-20s do vídeo" },
    ],
    bio: [
      { field: "Nome do canal", limit: "100 chars", recommendation: "Eternum" },
      { field: "Handle (@)", limit: "30 chars", recommendation: "@eternum" },
      { field: "Descrição", limit: "1000 chars", recommendation: "Proposta + tipo de conteúdo + frequência + links + e-mail comercial" },
      { field: "Tags do canal", recommendation: "Keywords separadas — não usa mais peso de SEO mas ainda ajuda em sugestões" },
    ],
    links: ["Site", "Instagram", "LinkedIn", "Spotify", "E-mail comercial"],
    checklist: [
      "Trocar foto de perfil do canal",
      "Trocar banner (verificar safe area 1546×423)",
      "Atualizar marca d'água (aparece em todos os vídeos)",
      "Renomear canal e handle (@)",
      "Reescrever descrição completa",
      "Atualizar links (até 5 visíveis no banner)",
      "Refazer thumbnails dos 10 vídeos mais vistos",
      "Atualizar trailer do canal (para não-inscritos)",
      "Atualizar vídeo destaque (para inscritos)",
      "Atualizar playlists (capas + nomes)",
      "Atualizar end screens dos vídeos novos",
      "Atualizar branding em intro/outro dos vídeos",
    ],
    doNot: ["Excluir vídeos antigos com logo Anjos (mata views/SEO)"],
  },
  {
    key: "tiktok",
    name: "TikTok",
    category: "social",
    icon: "Music2",
    assets: [
      { label: "Foto de perfil", size: "200×200 (mín)", format: "JPG/PNG, exibe como círculo" },
      { label: "Vídeo", size: "1080×1920 (9:16)", format: "MP4 ≤ 287MB / 10min" },
    ],
    bio: [
      { field: "Nome", limit: "30 chars", recommendation: "Eternum" },
      { field: "@username", limit: "24 chars", recommendation: "@eternum" },
      { field: "Bio", limit: "80 chars", recommendation: "Frase curta + emoji + CTA" },
      { field: "Link", recommendation: "1 link (a partir de 1k seguidores)" },
    ],
    checklist: [
      "Trocar foto de perfil",
      "Renomear @username (1 mudança a cada 30 dias)",
      "Atualizar bio (80 chars é apertado — ser cirúrgico)",
      "Atualizar link",
      "Pin 3 vídeos no topo do perfil",
      "Atualizar template de capa dos vídeos",
    ],
  },

  // ============ IDENTITY ============
  {
    key: "produtos",
    name: "Identidade Visual dos Produtos",
    category: "identity",
    icon: "Palette",
    assets: [
      { label: "Capa de produto (vertical)", size: "1080×1350", format: "JPG/PNG" },
      { label: "Mockup 3D", size: "2000×2000", format: "PNG transparente" },
      { label: "E-book / PDF capa", size: "1600×2400", format: "PDF + PNG preview" },
      { label: "Certificado", size: "A4 paisagem 297×210mm @300dpi", format: "PDF" },
      { label: "Selo / Badge", size: "500×500", format: "PNG transparente" },
    ],
    checklist: [
      "Listar TODOS os produtos ativos no catálogo",
      "Refazer capa de cada produto",
      "Atualizar mockups usados em site, ads, social",
      "Atualizar capa de PDFs/materiais entregues a alunos",
      "Atualizar template de certificado de conclusão",
      "Atualizar selos de garantia/qualidade",
      "Atualizar área de membros (logo, banner, favicon)",
      "Atualizar e-mails transacionais do produto",
    ],
  },
  {
    key: "logo-marca",
    name: "Logo & Manual de Marca",
    category: "identity",
    icon: "BookOpen",
    assets: [
      { label: "Logo principal (horizontal)", size: "Vetor", format: "SVG + AI + PNG (várias resoluções)" },
      { label: "Logo símbolo (ícone)", size: "Vetor", format: "SVG + PNG" },
      { label: "Logo monocromático", size: "Vetor", format: "Versões preto, branco, 1 cor" },
      { label: "Logo invertido", size: "Vetor", format: "Para fundos escuros" },
    ],
    checklist: [
      "Aprovar logo final (todas as variações)",
      "Definir paleta de cores (HEX, RGB, CMYK, Pantone)",
      "Definir tipografia (display + body + fallback)",
      "Documentar área de respiro (clear space) do logo",
      "Documentar tamanho mínimo de uso",
      "Documentar usos proibidos (não distorcer, não recolorir)",
      "Definir grid e ícones de marca",
      "Definir voz e tom de comunicação",
      "Distribuir manual em PDF para toda equipe + parceiros",
      "Subir assets em pasta compartilhada (Drive/Brand folder)",
    ],
  },
  {
    key: "decks",
    name: "Templates de Apresentação",
    category: "identity",
    icon: "Presentation",
    assets: [
      { label: "Slide widescreen", size: "1920×1080 (16:9)", format: "PPTX + Keynote + Google Slides" },
      { label: "Slide quadrado (social)", size: "1080×1080", format: "PPTX" },
    ],
    checklist: [
      "Capa, divisor de seção, conteúdo, dados, citação, encerramento",
      "Atualizar template de proposta comercial",
      "Atualizar template de pitch deck",
      "Atualizar template de aula/treinamento",
      "Atualizar template de relatório executivo",
      "Substituir em Drive/SharePoint compartilhado",
    ],
  },
  {
    key: "contratos",
    name: "Templates de Contrato",
    category: "identity",
    icon: "FileText",
    checklist: [
      "Atualizar razão social/CNPJ em todos os templates",
      "Atualizar cabeçalho com logo Eternum",
      "Atualizar rodapé com novo site e e-mail",
      "Atualizar nome de produtos referenciados",
      "Revisar com jurídico (mudança de nome fantasia não exige nova assinatura, mas registrar aditivo)",
      "Atualizar templates no sistema interno (CRM)",
      "Comunicar clientes ativos sobre o aditivo de marca",
    ],
  },
  {
    key: "email-signature",
    name: "Assinatura de E-mail",
    category: "identity",
    icon: "Mail",
    assets: [
      { label: "Logo na assinatura", size: "240×60 (exibido 120×30 @2x)", format: "PNG hospedado em URL pública" },
      { label: "Banner/CTA opcional", size: "600×100", format: "PNG" },
    ],
    bio: [
      { field: "Estrutura", recommendation: "Nome | Cargo | Eternum • telefone • e-mail • site • redes (ícones)" },
    ],
    checklist: [
      "Criar template HTML único para toda equipe",
      "Hospedar logo em URL pública (Drive/CDN)",
      "Distribuir para todos via Gmail/Outlook config",
      "Adicionar CTA atualizado (próximo evento/lead magnet)",
      "Testar em Gmail, Outlook, Apple Mail, Mobile",
    ],
  },
  {
    key: "vendas",
    name: "Material de Vendas",
    category: "identity",
    icon: "Briefcase",
    checklist: [
      "Atualizar one-pagers comerciais",
      "Atualizar proposta padrão (Word/PDF)",
      "Atualizar scripts de vendas (mencionar Eternum)",
      "Atualizar materiais de objeção/FAQ",
      "Atualizar cases e portfólio de clientes",
      "Atualizar materiais impressos (cartão de visita, folder)",
      "Atualizar brindes corporativos",
    ],
  },

  // ============ INTERNAL ============
  {
    key: "interno",
    name: "Comunicados internos & equipe",
    category: "internal",
    icon: "Users",
    checklist: [
      "Comunicar equipe 30 dias antes (alinhamento + perguntas)",
      "Reunião de kickoff explicando o porquê do rebranding",
      "Atualizar e-mails @eternum (criar contas, redirect dos antigos)",
      "Atualizar Slack/Discord (logo, nome do workspace)",
      "Atualizar ferramentas internas (Notion, Drive, sistemas)",
      "Atualizar onboarding de novos colaboradores",
      "Distribuir manual de marca para toda equipe",
      "Treinamento rápido: como falar sobre Eternum externamente",
      "Atualizar perfil de cada colaborador no LinkedIn (empresa)",
      "Kit de boas-vindas Eternum (digital) para a equipe",
    ],
  },
];

export const BRAND_KIT = {
  voice: {
    title: "Voz da marca Eternum",
    pillars: [
      { label: "Próxima", description: "Falamos como mentor que conhece o jogo — não como guru distante." },
      { label: "Direta", description: "Frases curtas. Verbos fortes. Sem rodeio corporativo." },
      { label: "Estratégica", description: "Cada palavra defende um ponto. Não enchemos linguiça." },
      { label: "Humana", description: "Histórias reais > dados frios. Mostramos o caminho, não só o resultado." },
    ],
  },
  tone: {
    title: "Tom por canal",
    matrix: [
      { canal: "LinkedIn", tom: "Estratégico, com prova social. 1 insight forte por post." },
      { canal: "Instagram", tom: "Visual + storytelling. Carrosséis com narrativa, Reels com hook nos 3s." },
      { canal: "Threads / Twitter", tom: "Mais cru, opinativo, conversacional. Pode provocar." },
      { canal: "YouTube", tom: "Aprofundado, didático. 'Vou te mostrar como'." },
      { canal: "E-mail", tom: "1:1, como se escrevesse pra uma pessoa específica." },
      { canal: "Ads", tom: "Urgência sem clickbait. Promessa específica + prova." },
    ],
  },
  doDont: {
    do: [
      "Usar 'Eternum' como substantivo (não 'a Eternum' em todo lugar)",
      "Manter logo símbolo limpo, sem efeitos",
      "Respeitar área de respiro mínima (altura do símbolo) ao redor do logo",
      "Usar fonte display apenas em títulos e destaque",
      "Sempre verificar contraste de acessibilidade WCAG AA (4.5:1)",
    ],
    dont: [
      "NUNCA mencionar 'Anjos Business' em peças novas (exceto contexto histórico)",
      "Não distorcer, inclinar ou recolorir o logo",
      "Não usar logo sobre fundos com pouco contraste",
      "Não combinar mais de 2 fontes na mesma peça",
      "Não usar emojis no logotipo ou em peças institucionais formais",
      "Não criar variações de cor sem aprovação do brand",
    ],
  },
  rolloutChecklist: [
    "D-30: Aprovação final de logo, paleta, manual",
    "D-21: Produção de todos os assets (artes, vídeos, templates)",
    "D-14: Atualizar materiais internos + comunicar equipe",
    "D-7: Preparar comunicação para clientes ativos",
    "D-3: Agendar posts coordenados em todos os canais",
    "D-1: Pausar ads, ensaio final",
    "D-Day: Troca simultânea de avatares/capas/bios + post oficial + vídeo Everton & Bruna",
    "D+1 a D+7: Monitorar menções, responder dúvidas, postar bastidores",
    "D+30: Retro do rebranding, métricas, ajustes",
  ],
};
