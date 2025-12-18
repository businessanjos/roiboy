import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  TrendingUp,
  DollarSign,
  Clock,
  Settings,
  Lightbulb,
  Heart,
  Shield,
  Star,
  Zap,
  Sparkles,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface ROIEvent {
  id: string;
  client_id: string;
  client_name: string;
  category: string;
  roi_type: "tangible" | "intangible";
  impact: "low" | "medium" | "high";
  evidence_snippet: string | null;
  happened_at: string;
  created_at: string;
}

const CATEGORY_CONFIG: Record<string, { icon: any; label: string; color: string }> = {
  revenue: { icon: DollarSign, label: "Receita", color: "text-green-500" },
  cost: { icon: TrendingUp, label: "Custo", color: "text-blue-500" },
  time: { icon: Clock, label: "Tempo", color: "text-orange-500" },
  process: { icon: Settings, label: "Processo", color: "text-purple-500" },
  clarity: { icon: Lightbulb, label: "Clareza", color: "text-yellow-500" },
  confidence: { icon: Shield, label: "Confiança", color: "text-cyan-500" },
  tranquility: { icon: Heart, label: "Tranquilidade", color: "text-pink-500" },
  status_direction: { icon: Star, label: "Status/Direção", color: "text-amber-500" },
};

const IMPACT_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
  high: { label: "Alto", variant: "default" },
  medium: { label: "Médio", variant: "secondary" },
  low: { label: "Baixo", variant: "outline" },
};

export function ROIEventsFeed() {
  const [events, setEvents] = useState<ROIEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchEvents = async () => {
    try {
      const { data, error } = await supabase
        .from("roi_events")
        .select("*, clients!inner(full_name)")
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;

      const formattedEvents = (data || []).map((event: any) => ({
        ...event,
        client_name: event.clients?.full_name || "Cliente",
      }));

      setEvents(formattedEvents);
    } catch (error) {
      console.error("Error fetching ROI events:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();

    // Subscribe to real-time updates
    const channel = supabase
      .channel("roi-events-feed")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "roi_events",
        },
        async (payload) => {
          // Fetch client name for the new event
          const { data: clientData } = await supabase
            .from("clients")
            .select("full_name")
            .eq("id", payload.new.client_id)
            .single();

          const newEvent: ROIEvent = {
            ...payload.new as any,
            client_name: clientData?.full_name || "Cliente",
          };

          setEvents((prev) => [newEvent, ...prev].slice(0, 50));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  if (loading) {
    return (
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            Feed de ROI em Tempo Real
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <div className="h-10 w-10 rounded-full bg-muted" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-muted rounded w-3/4" />
                  <div className="h-3 bg-muted rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-card">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="relative">
              <Zap className="h-5 w-5 text-primary" />
              <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-green-500 animate-pulse" />
            </div>
            <CardTitle className="text-base">Feed de ROI em Tempo Real</CardTitle>
          </div>
          <Badge variant="outline" className="gap-1">
            <Sparkles className="h-3 w-3" />
            {events.length} eventos
          </Badge>
        </div>
        <CardDescription>Percepções de ROI detectadas pela IA aparecem aqui instantaneamente</CardDescription>
      </CardHeader>
      <CardContent>
        {events.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Zap className="h-12 w-12 mx-auto mb-3 opacity-20" />
            <p className="text-sm">Nenhum evento de ROI ainda.</p>
            <p className="text-xs">Os eventos aparecerão aqui conforme forem detectados.</p>
          </div>
        ) : (
          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-3">
              {events.map((event, index) => {
                const categoryConfig = CATEGORY_CONFIG[event.category] || { 
                  icon: Star, 
                  label: event.category, 
                  color: "text-muted-foreground" 
                };
                const Icon = categoryConfig.icon;
                const impactConfig = IMPACT_CONFIG[event.impact] || IMPACT_CONFIG.medium;
                const isNew = index === 0;

                return (
                  <Link
                    key={event.id}
                    to={`/clients/${event.client_id}`}
                    className={cn(
                      "block p-3 rounded-lg border transition-all hover:bg-muted/50 hover:border-primary/30",
                      isNew && "ring-2 ring-primary/20 bg-primary/5 animate-in fade-in slide-in-from-top-2 duration-300"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div className={cn("p-2 rounded-lg bg-muted", categoryConfig.color)}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm">{event.client_name}</span>
                          <Badge variant={event.roi_type === "tangible" ? "default" : "secondary"} className="text-xs">
                            {event.roi_type === "tangible" ? "Tangível" : "Intangível"}
                          </Badge>
                          <Badge variant={impactConfig.variant} className="text-xs">
                            {impactConfig.label}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {categoryConfig.label}
                        </p>
                        {event.evidence_snippet && (
                          <p className="text-sm text-foreground/80 mt-2 line-clamp-2 italic">
                            "{event.evidence_snippet}"
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground mt-2">
                          {format(new Date(event.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        </p>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
