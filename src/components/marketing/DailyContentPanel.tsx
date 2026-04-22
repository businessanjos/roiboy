import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Flame, Lightbulb, Calendar as CalendarIcon, Loader2, Copy, Check, BrainCircuit } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useContentProfile } from '@/contexts/ContentProfileContext';
import { useMarketingWeeklyCalendar } from '@/hooks/useMarketingWeeklyCalendar';
import { useMarketingAiSuggestionReviews } from '@/hooks/useMarketingAiSuggestionReviews';
import { AiSuggestionReviewDialog } from '@/components/marketing/ai/AiSuggestionReviewDialog';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

interface PautaItem {
  titulo: string;
  formato: string;
  hook: string;
  cta: string;
  motivo: string;
}

interface PautaResponse {
  data: string;
  resumo: string;
  pautas: PautaItem[];
}

export function DailyContentPanel() {
  const { currentUser } = useCurrentUser();
  const { selectedProfile } = useContentProfile();
  const { suggestWeeklyCalendar } = useMarketingWeeklyCalendar();
  const { reviews, recordReview } = useMarketingAiSuggestionReviews();
  const [pauta, setPauta] = useState<PautaResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [reviewPautaIdx, setReviewPautaIdx] = useState<number | null>(null);
  const [reviewWeekIdx, setReviewWeekIdx] = useState<number | null>(null);

  // Trends in alta (top 3)
  const { data: trends = [], isLoading: loadingTrends } = useQuery({
    queryKey: ['daily-trends', currentUser?.account_id],
    queryFn: async () => {
      if (!currentUser?.account_id) return [];
      const { data } = await supabase
        .from('marketing_trends' as any)
        .select('id, title, description, trend_score, platform')
        .eq('account_id', currentUser.account_id)
        .order('trend_score', { ascending: false })
        .limit(3);
      return (data ?? []) as any[];
    },
    enabled: !!currentUser?.account_id,
  });

  // Próximos marcos (eventos marketing)
  const { data: marcos = [], isLoading: loadingMarcos } = useQuery({
    queryKey: ['daily-milestones', currentUser?.account_id],
    queryFn: async () => {
      if (!currentUser?.account_id) return [];
      const today = new Date().toISOString().split('T')[0];
      const { data } = await supabase
        .from('marketing_events' as any)
        .select('id, title, description, event_date')
        .eq('account_id', currentUser.account_id)
        .gte('event_date', today)
        .order('event_date', { ascending: true })
        .limit(3);
      return (data ?? []) as any[];
    },
    enabled: !!currentUser?.account_id,
  });

  // Ideias recentes
  const { data: ideias = [], isLoading: loadingIdeias } = useQuery({
    queryKey: ['daily-ideas', currentUser?.account_id],
    queryFn: async () => {
      if (!currentUser?.account_id) return [];
      const { data } = await supabase
        .from('marketing_ideas' as any)
        .select('id, title, description, status')
        .eq('account_id', currentUser.account_id)
        .order('created_at', { ascending: false })
        .limit(3);
      return (data ?? []) as any[];
    },
    enabled: !!currentUser?.account_id,
  });

  const handleGeneratePauta = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-daily-pauta', {
        body: {
          profile: selectedProfile ? {
            id: selectedProfile.id,
            platform: selectedProfile.platform,
            username: selectedProfile.username,
            display_name: selectedProfile.display_name,
          } : null,
          trends: trends.map(t => ({ title: t.title, score: t.trend_score, platform: t.platform })),
          marcos: marcos.map(m => ({ title: m.title, date: m.event_date, description: m.description })),
          ideias: ideias.map(i => ({ title: i.title, description: i.description })),
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setPauta(data as PautaResponse);
      toast.success('Pauta de hoje gerada!');
    } catch (e: any) {
      console.error(e);
      toast.error(e.message ?? 'Falha ao gerar pauta');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (item: PautaItem, idx: number) => {
    const text = `${item.titulo}\n\nFormato: ${item.formato}\n\nHook: ${item.hook}\n\nCTA: ${item.cta}\n\nPor quê: ${item.motivo}`;
    navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  const reviewSummary = {
    accepted: reviews.filter((item) => item.decision === 'accepted').length,
    edited: reviews.filter((item) => item.decision === 'edited').length,
    rejected: reviews.filter((item) => item.decision === 'rejected').length,
  };

  const activePauta = reviewPautaIdx !== null ? pauta?.pautas[reviewPautaIdx] : null;
  const activeWeek = reviewWeekIdx !== null ? suggestWeeklyCalendar.data?.schedule[reviewWeekIdx] : null;

  return (
    <div className="space-y-6">
      {/* CTA principal */}
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
        <CardContent className="py-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              O que postar hoje?
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              {selectedProfile
                ? <>Pauta sob medida para <strong>@{selectedProfile.username}</strong> usando trends, marcos e ideias do momento.</>
                : 'Selecione um perfil acima para personalizar a pauta.'}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR })}
            </p>
          </div>
          <Button onClick={handleGeneratePauta} disabled={loading || !selectedProfile} size="lg">
            {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
            {loading ? 'Gerando...' : 'Gerar pauta de hoje com IA'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="py-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h3 className="text-base font-semibold flex items-center gap-2">
              <CalendarIcon className="h-4 w-4 text-primary" />
              Calendário semanal com IA
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              Monte uma semana de posts e e-mails usando o perfil ativo e o histórico já produzido.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => selectedProfile && suggestWeeklyCalendar.mutate({
              profileId: selectedProfile.id,
              platform: selectedProfile.platform,
              username: selectedProfile.username,
              displayName: selectedProfile.display_name,
            })}
            disabled={!selectedProfile || suggestWeeklyCalendar.isPending}
          >
            {suggestWeeklyCalendar.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
            {suggestWeeklyCalendar.isPending ? 'Montando semana...' : 'Gerar calendário semanal'}
          </Button>
        </CardContent>
        <div className="px-6 pb-5">
          <div className="rounded-md border border-border bg-muted/30 p-3 text-xs text-muted-foreground space-y-2">
            <div className="flex items-center gap-2 text-foreground"><BrainCircuit className="h-4 w-4 text-primary" /><span className="font-medium">Revisões da IA</span></div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">Aceitas: {reviewSummary.accepted}</Badge>
              <Badge variant="outline">Editadas: {reviewSummary.edited}</Badge>
              <Badge variant="outline">Descartadas: {reviewSummary.rejected}</Badge>
            </div>
          </div>
        </div>
      </Card>

      {suggestWeeklyCalendar.data && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{suggestWeeklyCalendar.data.weeklyFocus}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">{suggestWeeklyCalendar.data.summary}</p>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {suggestWeeklyCalendar.data.schedule.map((item, idx) => (
                <Card key={`${item.date}-${idx}`} className="border-primary/10">
                  <CardContent className="p-4 space-y-3 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <Badge variant="outline">{item.dayLabel}</Badge>
                      <Badge variant="secondary">{item.channel === 'email' ? 'E-mail' : item.format}</Badge>
                    </div>
                    <div>
                      <p className="font-medium leading-snug">{item.title}</p>
                      <p className="text-xs text-muted-foreground mt-1">{item.platform} · {item.objective}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase">Hook</p>
                      <p>{item.hook}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase">CTA</p>
                      <p>{item.cta}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase">Por quê</p>
                      <p className="text-muted-foreground">{item.rationale}</p>
                    </div>
                    <Button size="sm" variant="ghost" className="w-full" onClick={() => setReviewWeekIdx(idx)}>Revisar sugestão</Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pautas geradas */}
      {pauta && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{pauta.resumo}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            {pauta.pautas.map((item, idx) => (
              <Card key={idx} className="border-primary/10">
                <CardHeader className="pb-2">
                  <Badge variant="outline" className="w-fit">{item.formato}</Badge>
                  <CardTitle className="text-sm leading-snug">{item.titulo}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase">Hook</p>
                    <p>{item.hook}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase">CTA</p>
                    <p>{item.cta}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase">Por quê</p>
                    <p className="text-muted-foreground">{item.motivo}</p>
                  </div>
                  <Button size="sm" variant="outline" className="w-full mt-2" onClick={() => handleCopy(item, idx)}>
                    {copiedIdx === idx ? <Check className="h-3 w-3 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
                    {copiedIdx === idx ? 'Copiado' : 'Copiar pauta'}
                  </Button>
                  <Button size="sm" variant="ghost" className="w-full" onClick={() => setReviewPautaIdx(idx)}>Revisar pauta</Button>
                </CardContent>
              </Card>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Cards de contexto */}
      <div className="grid gap-4 md:grid-cols-3">
        <ContextCard
          title="🔥 Trends em alta"
          icon={<Flame className="h-4 w-4 text-orange-500" />}
          loading={loadingTrends}
          empty="Nenhuma trend cadastrada"
          items={trends.map(t => ({ id: t.id, title: t.title, sub: `Score ${t.trend_score ?? 0} · ${t.platform ?? 'todos'}` }))}
        />
        <ContextCard
          title="📅 Próximos marcos"
          icon={<CalendarIcon className="h-4 w-4 text-blue-500" />}
          loading={loadingMarcos}
          empty="Nenhum evento próximo"
          items={marcos.map(m => ({
            id: m.id,
            title: m.title,
            sub: format(new Date(m.event_date + 'T00:00:00'), "d 'de' MMM", { locale: ptBR }),
          }))}
        />
        <ContextCard
          title="💡 Ideias recentes"
          icon={<Lightbulb className="h-4 w-4 text-yellow-500" />}
          loading={loadingIdeias}
          empty="Nenhuma ideia cadastrada"
          items={ideias.map(i => ({ id: i.id, title: i.title, sub: i.status ?? '' }))}
        />
      </div>

      <AiSuggestionReviewDialog
        open={reviewPautaIdx !== null}
        onOpenChange={(open) => !open && setReviewPautaIdx(null)}
        title="Revisar pauta do dia"
        fields={[{ key: 'titulo', label: 'Título' }, { key: 'hook', label: 'Hook', multiline: true, rows: 3 }, { key: 'cta', label: 'CTA' }, { key: 'motivo', label: 'Motivo', multiline: true, rows: 4 }]}
        initialValue={{ titulo: activePauta?.titulo || '', hook: activePauta?.hook || '', cta: activePauta?.cta || '', motivo: activePauta?.motivo || '' }}
        onAcceptOriginal={async (notes) => { if (!activePauta) return; await recordReview.mutateAsync({ suggestionType: 'daily-pauta', sourceFunction: 'generate-daily-pauta', sourceItemKey: activePauta.titulo, decision: 'accepted', profilePlatform: selectedProfile?.platform, profileId: selectedProfile?.id, profileUsername: selectedProfile?.username, suggestionPayload: activePauta as any, inputContext: { resumo: pauta?.resumo }, decisionNotes: notes }); setReviewPautaIdx(null); }}
        onSaveEdits={async (value, notes) => { if (!activePauta) return; await recordReview.mutateAsync({ suggestionType: 'daily-pauta', sourceFunction: 'generate-daily-pauta', sourceItemKey: activePauta.titulo, decision: 'edited', profilePlatform: selectedProfile?.platform, profileId: selectedProfile?.id, profileUsername: selectedProfile?.username, suggestionPayload: activePauta as any, editedPayload: value as any, inputContext: { resumo: pauta?.resumo }, decisionNotes: notes }); setPauta((current) => current ? { ...current, pautas: current.pautas.map((item, index) => index === reviewPautaIdx ? { ...item, ...(value as any) } : item) } : current); setReviewPautaIdx(null); }}
        onReject={async (_value, notes) => { if (!activePauta) return; await recordReview.mutateAsync({ suggestionType: 'daily-pauta', sourceFunction: 'generate-daily-pauta', sourceItemKey: activePauta.titulo, decision: 'rejected', profilePlatform: selectedProfile?.platform, profileId: selectedProfile?.id, profileUsername: selectedProfile?.username, suggestionPayload: activePauta as any, inputContext: { resumo: pauta?.resumo }, decisionNotes: notes }); setReviewPautaIdx(null); }}
        isSubmitting={recordReview.isPending}
      />
      <AiSuggestionReviewDialog
        open={reviewWeekIdx !== null}
        onOpenChange={(open) => !open && setReviewWeekIdx(null)}
        title="Revisar sugestão semanal"
        fields={[{ key: 'title', label: 'Título' }, { key: 'hook', label: 'Hook', multiline: true, rows: 3 }, { key: 'cta', label: 'CTA' }, { key: 'rationale', label: 'Justificativa', multiline: true, rows: 4 }]}
        initialValue={{ title: activeWeek?.title || '', hook: activeWeek?.hook || '', cta: activeWeek?.cta || '', rationale: activeWeek?.rationale || '' }}
        onAcceptOriginal={async (notes) => { if (!activeWeek) return; await recordReview.mutateAsync({ suggestionType: 'weekly-calendar', sourceFunction: 'suggest-weekly-marketing-calendar', sourceItemKey: `${activeWeek.date}:${activeWeek.title}`, decision: 'accepted', objective: activeWeek.objective, profilePlatform: selectedProfile?.platform, profileId: selectedProfile?.id, profileUsername: selectedProfile?.username, suggestionPayload: activeWeek as any, inputContext: { summary: suggestWeeklyCalendar.data?.summary }, decisionNotes: notes }); setReviewWeekIdx(null); }}
        onSaveEdits={async (value, notes) => { if (!activeWeek) return; await recordReview.mutateAsync({ suggestionType: 'weekly-calendar', sourceFunction: 'suggest-weekly-marketing-calendar', sourceItemKey: `${activeWeek.date}:${activeWeek.title}`, decision: 'edited', objective: activeWeek.objective, profilePlatform: selectedProfile?.platform, profileId: selectedProfile?.id, profileUsername: selectedProfile?.username, suggestionPayload: activeWeek as any, editedPayload: value as any, inputContext: { summary: suggestWeeklyCalendar.data?.summary }, decisionNotes: notes }); setReviewWeekIdx(null); }}
        onReject={async (_value, notes) => { if (!activeWeek) return; await recordReview.mutateAsync({ suggestionType: 'weekly-calendar', sourceFunction: 'suggest-weekly-marketing-calendar', sourceItemKey: `${activeWeek.date}:${activeWeek.title}`, decision: 'rejected', objective: activeWeek.objective, profilePlatform: selectedProfile?.platform, profileId: selectedProfile?.id, profileUsername: selectedProfile?.username, suggestionPayload: activeWeek as any, inputContext: { summary: suggestWeeklyCalendar.data?.summary }, decisionNotes: notes }); setReviewWeekIdx(null); }}
        isSubmitting={recordReview.isPending}
      />
    </div>
  );
}

function ContextCard({
  title, icon, loading, items, empty,
}: {
  title: string;
  icon: React.ReactNode;
  loading: boolean;
  items: { id: string; title: string; sub: string }[];
  empty: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">{icon}{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {loading ? (
          <>
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </>
        ) : items.length === 0 ? (
          <p className="text-xs text-muted-foreground">{empty}</p>
        ) : (
          items.map(it => (
            <div key={it.id} className="text-sm border-l-2 border-primary/30 pl-2">
              <p className="font-medium leading-tight">{it.title}</p>
              {it.sub && <p className="text-xs text-muted-foreground">{it.sub}</p>}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
