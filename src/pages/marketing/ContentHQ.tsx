import { useMemo, useState } from "react";
import { useTalents, Talent, useAllContentPieces, PLATFORMS, ContentPiece } from "@/hooks/useContentHQ";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Crown, Target, Layers, CalendarRange, FileText, KanbanSquare, Library, BarChart3, LayoutGrid,
  Instagram, Youtube, Music2, MessageSquare, Linkedin, Image as ImageIcon, Headphones, Sparkles,
  Lightbulb,
} from "lucide-react";
import { cn } from "@/lib/utils";
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

type Section = "overview" | "ideas" | "strategy" | "pillars" | "calendar" | "briefings" | "kanban" | "library" | "performance";

const SECTIONS: { id: Section; label: string; icon: any }[] = [
  { id: "overview", label: "Visão por Plataforma", icon: LayoutGrid },
  { id: "ideas", label: "Banco de Ideias (IA)", icon: Lightbulb },
  { id: "calendar", label: "Calendário", icon: CalendarRange },
  { id: "kanban", label: "Produção", icon: KanbanSquare },
  { id: "briefings", label: "Pautas & Briefings", icon: FileText },
  { id: "pillars", label: "Pilares", icon: Layers },
  { id: "strategy", label: "Estratégia", icon: Target },
  { id: "library", label: "Biblioteca", icon: Library },
  { id: "performance", label: "Performance", icon: BarChart3 },
];

const PLATFORM_ICONS: Record<string, any> = {
  instagram: Instagram, youtube: Youtube, tiktok: Music2, threads: MessageSquare,
  linkedin: Linkedin, pinterest: ImageIcon, spotify: Headphones,
};

export default function ContentHQ() {
  const { data: talents = [], isLoading } = useTalents();
  const [section, setSection] = useState<Section>("overview");
  const [talentId, setTalentId] = useState<string | "all">("all");
  const [platformFilter, setPlatformFilter] = useState<string | "all">("all");
  const [drawerPiece, setDrawerPiece] = useState<{ piece: ContentPiece; talent: Talent } | null>(null);

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

  // Platform counts (for chips) - across selected talent, ignoring platform filter
  const platformCounts: Record<string, number> = {};
  for (const p of allPiecesRaw.filter(x => talentId === "all" || x.talent_id === talentId)) {
    platformCounts[p.platform] = (platformCounts[p.platform] || 0) + 1;
  }

  const needsTalent = ["strategy", "pillars", "briefings", "library", "performance"].includes(section);

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Command header */}
      <div className="rounded-xl border bg-gradient-to-br from-amber-500/5 via-background to-primary/5 p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-lg bg-amber-500/10 flex items-center justify-center">
              <Crown className="h-6 w-6 text-amber-500" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Content HQ</h1>
              <p className="text-sm text-muted-foreground">
                Comando central de conteúdo multi-plataforma
              </p>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-3">
            <KpiPill label="Publicados (mês)" value={publishedThisMonth} tone="emerald" />
            <KpiPill label="Agendados (mês)" value={scheduledThisMonth} tone="cyan" />
            <KpiPill label="Em produção" value={inProduction} tone="purple" />
            <KpiPill label="Total ativo" value={allPieces.length} tone="amber" />
          </div>
        </div>

        {/* Talent row */}
        <div className="flex flex-wrap items-center gap-2 mt-5 pt-4 border-t">
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

        {/* Platform filter row */}
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

      {/* Section tabs */}
      <div className="flex flex-wrap gap-1.5 border-b pb-px">
        {SECTIONS.map((s) => {
          const Icon = s.icon;
          const active = section === s.id;
          return (
            <button
              key={s.id}
              onClick={() => setSection(s.id)}
              className={cn(
                "px-3.5 py-2 text-sm font-medium rounded-t-md transition-colors flex items-center gap-2 border-b-2 -mb-px",
                active
                  ? "border-primary text-primary bg-primary/5"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )}
            >
              <Icon className="h-4 w-4" />
              {s.label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div>
        {isLoading ? (
          <Card className="p-8 text-center text-muted-foreground">Carregando talentos...</Card>
        ) : needsTalent && talentId === "all" ? (
          <Card className="p-8 text-center text-muted-foreground">
            Selecione <strong>Bruna</strong> ou <strong>Everton</strong> para ver esta seção.
          </Card>
        ) : (
          <>
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
            {section === "strategy" && currentTalent && <ContentHQStrategy talent={currentTalent} />}
            {section === "pillars" && currentTalent && <ContentHQPillars talent={currentTalent} />}
            {section === "briefings" && currentTalent && <ContentHQBriefings talent={currentTalent} />}
            {section === "library" && currentTalent && <ContentHQLibrary talent={currentTalent} />}
            {section === "performance" && currentTalent && <ContentHQPerformance talent={currentTalent} />}
          </>
        )}
      </div>

      <ContentHQPieceDrawer
        piece={drawerPiece?.piece || null}
        talent={drawerPiece?.talent || null}
        open={!!drawerPiece}
        onOpenChange={(v) => !v && setDrawerPiece(null)}
      />
    </div>
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
    <div className={cn("rounded-lg border px-3 py-2 min-w-[110px]", toneMap[tone])}>
      <div className="text-2xl font-bold leading-none">{value}</div>
      <div className="text-[11px] mt-1 opacity-80">{label}</div>
    </div>
  );
}

function TalentChip({ active, onClick, label, avatar }: { active: boolean; onClick: () => void; label: string; avatar?: string | null }) {
  return (
    <Button
      variant={active ? "default" : "outline"}
      size="sm"
      onClick={onClick}
      className="gap-2 h-8"
    >
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
