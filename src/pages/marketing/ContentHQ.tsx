import { useState } from "react";
import { useTalents, Talent } from "@/hooks/useContentHQ";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Crown, Target, Layers, CalendarRange, FileText, KanbanSquare, Library, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";
import { ContentHQStrategy } from "@/components/marketing/content-hq/ContentHQStrategy";
import { ContentHQPillars } from "@/components/marketing/content-hq/ContentHQPillars";
import { ContentHQCalendar } from "@/components/marketing/content-hq/ContentHQCalendar";
import { ContentHQBriefings } from "@/components/marketing/content-hq/ContentHQBriefings";
import { ContentHQKanban } from "@/components/marketing/content-hq/ContentHQKanban";
import { ContentHQLibrary } from "@/components/marketing/content-hq/ContentHQLibrary";
import { ContentHQPerformance } from "@/components/marketing/content-hq/ContentHQPerformance";

type Section = "strategy" | "pillars" | "calendar" | "briefings" | "kanban" | "library" | "performance";

const SECTIONS: { id: Section; label: string; icon: any; desc: string }[] = [
  { id: "strategy", label: "Estratégia", icon: Target, desc: "Por que fazer" },
  { id: "pillars", label: "Pilares", icon: Layers, desc: "O que fazer" },
  { id: "calendar", label: "Calendário", icon: CalendarRange, desc: "Quando fazer" },
  { id: "briefings", label: "Pautas & Briefings", icon: FileText, desc: "Como fazer" },
  { id: "kanban", label: "Produção", icon: KanbanSquare, desc: "Executar" },
  { id: "library", label: "Biblioteca", icon: Library, desc: "Hooks, CTAs, refs" },
  { id: "performance", label: "Performance", icon: BarChart3, desc: "Métricas" },
];

export default function ContentHQ() {
  const { data: talents = [], isLoading } = useTalents();
  const [section, setSection] = useState<Section>("strategy");
  const [talentId, setTalentId] = useState<string | "all">("all");

  const currentTalent = talents.find((t) => t.id === talentId);

  return (
    <div className="container mx-auto py-6">
      <div className="flex items-center gap-3 mb-6">
        <Crown className="h-7 w-7 text-amber-500" />
        <div>
          <h1 className="text-2xl font-bold">Content HQ</h1>
          <p className="text-sm text-muted-foreground">
            Estratégia, tático e operacional de conteúdo multi-plataforma — nicho estética
          </p>
        </div>
      </div>

      {/* Seletor de talento */}
      <div className="flex gap-2 mb-6 flex-wrap">
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

      <div className="grid grid-cols-12 gap-6">
        {/* Sidebar vertical */}
        <Card className="col-span-12 md:col-span-3 p-2 h-fit sticky top-4">
          <nav className="flex flex-col gap-1">
            {SECTIONS.map((s) => {
              const Icon = s.icon;
              const active = section === s.id;
              return (
                <button
                  key={s.id}
                  onClick={() => setSection(s.id)}
                  className={cn(
                    "flex items-start gap-3 px-3 py-2.5 rounded-md text-left transition-colors",
                    active ? "bg-primary/10 text-primary" : "hover:bg-muted text-foreground"
                  )}
                >
                  <Icon className="h-4 w-4 mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <div className="text-sm font-medium">{s.label}</div>
                    <div className="text-xs text-muted-foreground truncate">{s.desc}</div>
                  </div>
                </button>
              );
            })}
          </nav>
        </Card>

        {/* Conteúdo */}
        <div className="col-span-12 md:col-span-9">
          {isLoading ? (
            <Card className="p-8 text-center text-muted-foreground">Carregando talentos...</Card>
          ) : talentId === "all" && section !== "calendar" && section !== "kanban" ? (
            <Card className="p-8 text-center text-muted-foreground">
              Selecione <strong>Bruna</strong> ou <strong>Everton</strong> para ver esta seção.
            </Card>
          ) : (
            <>
              {section === "strategy" && currentTalent && <ContentHQStrategy talent={currentTalent} />}
              {section === "pillars" && currentTalent && <ContentHQPillars talent={currentTalent} />}
              {section === "calendar" && <ContentHQCalendar talents={talents} selectedTalentId={talentId === "all" ? undefined : talentId} />}
              {section === "briefings" && currentTalent && <ContentHQBriefings talent={currentTalent} />}
              {section === "kanban" && <ContentHQKanban talents={talents} selectedTalentId={talentId === "all" ? undefined : talentId} />}
              {section === "library" && currentTalent && <ContentHQLibrary talent={currentTalent} />}
              {section === "performance" && currentTalent && <ContentHQPerformance talent={currentTalent} />}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function TalentChip({ active, onClick, label, avatar }: { active: boolean; onClick: () => void; label: string; avatar?: string | null }) {
  return (
    <Button
      variant={active ? "default" : "outline"}
      size="sm"
      onClick={onClick}
      className="gap-2"
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
