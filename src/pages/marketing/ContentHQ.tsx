import { useMemo, useState } from "react";
import { useTalents, Talent, useAllContentPieces, PLATFORMS, ContentPiece } from "@/hooks/useContentHQ";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Crown, Target, Layers, CalendarRange, FileText, KanbanSquare, Library, BarChart3, LayoutGrid,
  Instagram, Youtube, Music2, MessageSquare, Linkedin, Image as ImageIcon, Headphones, Sparkles,
  Lightbulb, Sun, Bot, Flame, Zap, Wand2, CalendarDays,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ContentProfileProvider } from "@/contexts/ContentProfileContext";
import { ProfileSelector } from "@/components/marketing/ProfileSelector";
import { DailyContentPanel } from "@/components/marketing/DailyContentPanel";
import { ContentHQStrategy } from "@/components/marketing/content-hq/ContentHQStrategy";
import { ContentHQPillars } from "@/components/marketing/content-hq/ContentHQPillars";
import { ContentHQCalendar } from "@/components/marketing/content-hq/ContentHQCalendar";
import { ContentHQBriefings } from "@/components/marketing/content-hq/ContentHQBriefings";
import { ContentHQKanban } from "@/components/marketing/content-hq/ContentHQKanban";
import { ContentHQLibrary } from "@/components/marketing/content-hq/ContentHQLibrary";
import { ContentHQPerformance } from "@/components/marketing/content-hq/ContentHQPerformance";
import { ContentHQPlatformBoard } from "@/components/marketing/content-hq/ContentHQPlatformBoard";
import { ContentHQPieceDrawer } from "@/components/marketing/content-hq/ContentHQPieceDrawer";
import { ContentHQIdeasLab } from "@/components/marketing/content-hq/ContentHQIdeasLab";
import { MarketingPersonaTab } from "@/components/marketing/persona/MarketingPersonaTab";
import { BrandVoiceTab } from "@/components/marketing/brand/BrandVoiceTab";
import { MarketingIdeasTab } from "@/components/marketing/ideas/MarketingIdeasTab";
import { EditorialCalendarTab } from "@/components/marketing/calendar/EditorialCalendarTab";
import { TrendsRadarTab } from "@/components/marketing/trends/TrendsRadarTab";
import { HooksTab } from "@/components/marketing/hooks/HooksTab";
import { CopyStudioTab } from "@/components/marketing/copy/CopyStudioTab";
import { MarketingReferencesTab } from "@/components/marketing/references/MarketingReferencesTab";
import { CopilotTab } from "@/components/marketing/copilot/CopilotTab";

type Section =
  // Hoje
  | "today"
  // Estratégia
  | "persona" | "brand" | "strategy" | "pillars"
  // Ideação
  | "ideas-creation" | "ideas" | "hooks" | "trends" | "copilot"
  // Planejamento
  | "overview" | "calendar" | "editorial" | "briefings"
  // Produção
  | "kanban" | "copy" | "references" | "library"
  // Performance
  | "performance";

type SectionDef = { id: Section; label: string; icon: any; needsTalent?: boolean; hqHeader?: boolean };
type SectionGroup = { group: string; items: SectionDef[] };

const GROUPS: SectionGroup[] = [
  {
    group: "Hoje",
    items: [{ id: "today", label: "O que postar hoje", icon: Sun }],
  },
  {
    group: "Estratégia",
    items: [
      { id: "persona", label: "Persona", icon: Target },
      { id: "brand", label: "Tom de Voz", icon: Wand2 },
      { id: "strategy", label: "Estratégia (HQ)", icon: Target, needsTalent: true, hqHeader: true },
      { id: "pillars", label: "Pilares (HQ)", icon: Layers, needsTalent: true, hqHeader: true },
    ],
  },
  {
    group: "Ideação",
    items: [
      { id: "ideas-creation", label: "Banco de Ideias", icon: Lightbulb },
      { id: "ideas", label: "Ideias por Talento (HQ)", icon: Lightbulb, needsTalent: true, hqHeader: true },
      { id: "hooks", label: "Hooks", icon: Zap },
      { id: "trends", label: "Trends", icon: Flame },
      { id: "copilot", label: "Copilot", icon: Bot },
    ],
  },
  {
    group: "Planejamento",
    items: [
      { id: "overview", label: "Visão por Plataforma", icon: LayoutGrid, hqHeader: true },
      { id: "calendar", label: "Calendário (HQ)", icon: CalendarRange, hqHeader: true },
      { id: "editorial", label: "Editorial", icon: CalendarDays },
      { id: "briefings", label: "Pautas & Briefings", icon: FileText, needsTalent: true, hqHeader: true },
    ],
  },
  {
    group: "Produção",
    items: [
      { id: "kanban", label: "Kanban (HQ)", icon: KanbanSquare, hqHeader: true },
      { id: "copy", label: "Copy IA", icon: Sparkles },
      { id: "references", label: "Referências", icon: ImageIcon },
      { id: "library", label: "Biblioteca (HQ)", icon: Library, needsTalent: true, hqHeader: true },
    ],
  },
  {
    group: "Performance",
    items: [{ id: "performance", label: "Performance (HQ)", icon: BarChart3, needsTalent: true, hqHeader: true }],
  },
];

const ALL_SECTIONS: SectionDef[] = GROUPS.flatMap((g) => g.items);

const PLATFORM_ICONS: Record<string, any> = {
  instagram: Instagram, youtube: Youtube, tiktok: Music2, threads: MessageSquare,
  linkedin: Linkedin, pinterest: ImageIcon, spotify: Headphones,
};

export default function ContentHQ() {
  const { data: talents = [], isLoading } = useTalents();
  const [section, setSection] = useState<Section>("today");
  const [talentId, setTalentId] = useState<string | "all">("all");
  const [platformFilter, setPlatformFilter] = useState<string | "all">("all");
  const [drawerPiece, setDrawerPiece] = useState<{ piece: ContentPiece; talent: Talent } | null>(null);

  const currentSection = ALL_SECTIONS.find((s) => s.id === section)!;
  const showHqHeader = !!currentSection.hqHeader;
  const currentTalent = talents.find((t) => t.id === talentId);
  const effPlatform = platformFilter === "all" ? undefined : platformFilter;

  // KPIs across selected talents
  const { data: allPiecesRaw = [] } = useAllContentPieces();
  const allPieces = useMemo(
    () => allPiecesRaw.filter(p =>
      (talentId === "all" || p.talent_id === talentId) &&
      (!effPlatform || p.platform === effPlatform)
    ),
    [allPiecesRaw, talentId, effPlatform]
  );
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
  const piecesThisMonth = allPieces.filter(p => p.scheduled_date && p.scheduled_date >= monthStart && p.scheduled_date <= monthEnd);
  const publishedThisMonth = piecesThisMonth.filter(p => p.status === "published").length;
  const scheduledThisMonth = piecesThisMonth.filter(p => p.status === "scheduled").length;
  const inProduction = allPieces.filter(p => ["script", "shooting", "editing", "approval"].includes(p.status)).length;

  const platformCounts: Record<string, number> = {};
  for (const p of allPiecesRaw.filter(x => talentId === "all" || x.talent_id === talentId)) {
    platformCounts[p.platform] = (platformCounts[p.platform] || 0) + 1;
  }

  return (
    <ContentProfileProvider>
      <div className="container mx-auto py-6">
        {/* Page header */}
        <div className="flex items-start justify-between gap-4 flex-wrap mb-5">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-lg bg-amber-500/10 flex items-center justify-center">
              <Crown className="h-6 w-6 text-amber-500" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Conteúdo</h1>
              <p className="text-sm text-muted-foreground">
                Comando central de conteúdo: persona, estratégia, produção e performance.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Perfil de marca:</span>
            <ProfileSelector />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-6">
          {/* Vertical sidebar */}
          <aside className="space-y-5">
            {GROUPS.map((g) => (
              <div key={g.group}>
                <div className="px-2 mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {g.group}
                </div>
                <nav className="space-y-0.5">
                  {g.items.map((s) => {
                    const Icon = s.icon;
                    const active = section === s.id;
                    return (
                      <button
                        key={s.id}
                        onClick={() => setSection(s.id)}
                        className={cn(
                          "w-full text-left text-sm rounded-md px-2.5 py-1.5 flex items-center gap-2 transition-colors",
                          active
                            ? "bg-primary/10 text-primary font-medium"
                            : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                        )}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        <span className="truncate">{s.label}</span>
                      </button>
                    );
                  })}
                </nav>
              </div>
            ))}
          </aside>

          {/* Content area */}
          <div className="space-y-5 min-w-0">
            {showHqHeader && (
              <div className="rounded-xl border bg-gradient-to-br from-amber-500/5 via-background to-primary/5 p-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                  <KpiPill label="Publicados (mês)" value={publishedThisMonth} tone="emerald" />
                  <KpiPill label="Agendados (mês)" value={scheduledThisMonth} tone="cyan" />
                  <KpiPill label="Em produção" value={inProduction} tone="purple" />
                  <KpiPill label="Total ativo" value={allPieces.length} tone="amber" />
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-3 border-t">
                  <span className="text-xs uppercase tracking-wider text-muted-foreground mr-1">Talento</span>
                  <TalentChip active={talentId === "all"} onClick={() => setTalentId("all")} label="Ambos" />
                  {talents.map((t) => (
                    <TalentChip
                      key={t.id}
                      active={talentId === t.id}
                      onClick={() => setTalentId(t.id)}
                      label={t.name}
                      avatar={t.avatar_url}
                    />
                  ))}
                </div>

                <div className="flex flex-wrap items-center gap-2 mt-3">
                  <span className="text-xs uppercase tracking-wider text-muted-foreground mr-1">Plataforma</span>
                  <PlatformChip active={platformFilter === "all"} onClick={() => setPlatformFilter("all")} label="Todas" icon={Sparkles} count={Object.values(platformCounts).reduce((a, b) => a + b, 0)} />
                  {PLATFORMS.map((p) => {
                    const Icon = PLATFORM_ICONS[p.id] || Sparkles;
                    return (
                      <PlatformChip
                        key={p.id}
                        active={platformFilter === p.id}
                        onClick={() => setPlatformFilter(p.id)}
                        label={p.label}
                        icon={Icon}
                        count={platformCounts[p.id] || 0}
                        color={p.color}
                      />
                    );
                  })}
                </div>
              </div>
            )}

            <div>
              {isLoading && currentSection.needsTalent ? (
                <Card className="p-8 text-center text-muted-foreground">Carregando talentos...</Card>
              ) : currentSection.needsTalent && talentId === "all" ? (
                <Card className="p-8 text-center text-muted-foreground">
                  Selecione <strong>Bruna</strong> ou <strong>Everton</strong> para ver esta seção.
                </Card>
              ) : (
                <>
                  {section === "today" && <DailyContentPanel />}
                  {section === "persona" && <MarketingPersonaTab />}
                  {section === "brand" && <BrandVoiceTab />}
                  {section === "ideas-creation" && <MarketingIdeasTab />}
                  {section === "hooks" && <HooksTab />}
                  {section === "trends" && <TrendsRadarTab />}
                  {section === "copilot" && <CopilotTab />}
                  {section === "editorial" && <EditorialCalendarTab />}
                  {section === "copy" && <CopyStudioTab />}
                  {section === "references" && <MarketingReferencesTab />}

                  {section === "overview" && (
                    <ContentHQPlatformBoard
                      talents={talents}
                      selectedTalentId={talentId === "all" ? undefined : talentId}
                      platformFilter={effPlatform}
                      onSelectPiece={(piece, talent) => setDrawerPiece({ piece, talent })}
                    />
                  )}
                  {section === "calendar" && (
                    <ContentHQCalendar
                      talents={talents}
                      selectedTalentId={talentId === "all" ? undefined : talentId}
                      platformFilter={effPlatform}
                    />
                  )}
                  {section === "kanban" && (
                    <ContentHQKanban
                      talents={talents}
                      selectedTalentId={talentId === "all" ? undefined : talentId}
                      platformFilter={effPlatform}
                    />
                  )}
                  {section === "ideas" && currentTalent && <ContentHQIdeasLab talent={currentTalent} />}
                  {section === "strategy" && currentTalent && <ContentHQStrategy talent={currentTalent} />}
                  {section === "pillars" && currentTalent && <ContentHQPillars talent={currentTalent} />}
                  {section === "briefings" && currentTalent && <ContentHQBriefings talent={currentTalent} />}
                  {section === "library" && currentTalent && <ContentHQLibrary talent={currentTalent} />}
                  {section === "performance" && currentTalent && <ContentHQPerformance talent={currentTalent} />}
                </>
              )}
            </div>
          </div>
        </div>

        <ContentHQPieceDrawer
          piece={drawerPiece?.piece || null}
          talent={drawerPiece?.talent || null}
          open={!!drawerPiece}
          onOpenChange={(v) => !v && setDrawerPiece(null)}
        />
      </div>
    </ContentProfileProvider>
  );
}

function KpiPill({ label, value, tone }: { label: string; value: number; tone: "emerald" | "cyan" | "purple" | "amber" }) {
  const toneMap = {
    emerald: "text-emerald-700 bg-emerald-500/10 border-emerald-500/20",
    cyan: "text-cyan-700 bg-cyan-500/10 border-cyan-500/20",
    purple: "text-purple-700 bg-purple-500/10 border-purple-500/20",
    amber: "text-amber-700 bg-amber-500/10 border-amber-500/20",
  };
  return (
    <div className={cn("rounded-lg border px-3 py-2", toneMap[tone])}>
      <div className="text-2xl font-bold leading-none">{value}</div>
      <div className="text-[11px] mt-1 opacity-80">{label}</div>
    </div>
  );
}

function TalentChip({ active, onClick, label, avatar }: { active: boolean; onClick: () => void; label: string; avatar?: string | null }) {
  return (
    <Button variant={active ? "default" : "outline"} size="sm" onClick={onClick} className="gap-2 h-8">
      {avatar !== undefined && (
        <Avatar className="h-5 w-5">
          {avatar && <AvatarImage src={avatar} />}
          <AvatarFallback className="text-[10px]">{label[0]}</AvatarFallback>
        </Avatar>
      )}
      {label}
    </Button>
  );
}

function PlatformChip({ active, onClick, label, icon: Icon, count, color }: { active: boolean; onClick: () => void; label: string; icon: any; count: number; color?: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "h-8 px-3 rounded-full border text-xs font-medium flex items-center gap-1.5 transition-colors",
        active
          ? "bg-foreground text-background border-foreground"
          : color
            ? `${color} hover:opacity-80`
            : "bg-muted/50 hover:bg-muted"
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
      <Badge variant="outline" className={cn("ml-1 h-4 px-1 text-[10px]", active ? "bg-background/20 text-background border-background/30" : "bg-background/60")}>
        {count}
      </Badge>
    </button>
  );
}
