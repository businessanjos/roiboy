import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { MessageSquareText, Plus, Search, Copy, Edit2, Trash2, DollarSign, Clock, Users, ShieldQuestion, Heart, HelpCircle, ArrowRight, Target, Handshake, Trophy, Loader2, Package, Sparkles, BookOpen, FileText, Star, StarOff, Phone, MessageCircle, Presentation, CheckCircle2, AlertCircle, Upload, Download, Mic, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';
import MarkdownRenderer from '@/components/sales/MarkdownRenderer';
import CommissionCalculator from '@/components/sales/CommissionCalculator';
import { exportSalesCallToPDF } from '@/lib/exportSalesCallPDF';
import { exportPlaybookToPDF } from '@/lib/exportPlaybookPDF';

const OBJECTION_TYPES = [
  { value: 'price', label: 'Preço', icon: DollarSign, color: 'text-red-500', bgColor: 'bg-red-500/10' },
  { value: 'time', label: 'Tempo', icon: Clock, color: 'text-amber-500', bgColor: 'bg-amber-500/10' },
  { value: 'competition', label: 'Concorrência', icon: Users, color: 'text-blue-500', bgColor: 'bg-blue-500/10' },
  { value: 'need', label: 'Necessidade', icon: ShieldQuestion, color: 'text-purple-500', bgColor: 'bg-purple-500/10' },
  { value: 'trust', label: 'Confiança', icon: Heart, color: 'text-pink-500', bgColor: 'bg-pink-500/10' },
  { value: 'other', label: 'Outros', icon: HelpCircle, color: 'text-muted-foreground', bgColor: 'bg-muted' },
];

const FUNNEL_STAGES = [
  { value: 'prospecting', label: 'Prospecção', icon: Target, color: 'text-cyan-500', bgColor: 'bg-cyan-500/10' },
  { value: 'qualification', label: 'Qualificação', icon: ArrowRight, color: 'text-indigo-500', bgColor: 'bg-indigo-500/10' },
  { value: 'negotiation', label: 'Negociação', icon: Handshake, color: 'text-orange-500', bgColor: 'bg-orange-500/10' },
  { value: 'closing', label: 'Fechamento', icon: Trophy, color: 'text-green-500', bgColor: 'bg-green-500/10' },
];

const MATERIAL_TYPES = [
  { value: 'product', label: 'Produto/Serviço', icon: Package, description: 'Descrição do que você vende' },
  { value: 'pricing', label: 'Preço e Condições', icon: DollarSign, description: 'Tabela de preços' },
  { value: 'icp', label: 'ICP (Cliente Ideal)', icon: Target, description: 'Perfil do cliente ideal' },
  { value: 'differentials', label: 'Diferenciais', icon: Star, description: 'O que te diferencia' },
  { value: 'objections', label: 'Objeções Comuns', icon: ShieldQuestion, description: 'Objeções e rebatimentos' },
  { value: 'process', label: 'Processo de Vendas', icon: ArrowRight, description: 'Etapas do funil' },
];

const SCRIPT_TYPES = [
  { value: 'cold_call', label: 'Prospecção / Cold Call', icon: Phone, description: 'Primeiro contato' },
  { value: 'sdr', label: 'Processo SDR', icon: Users, description: 'Fluxo completo de SDR' },
  { value: 'qualification', label: 'Qualificação (SPIN/BANT)', icon: Target, description: 'Perguntas para qualificar' },
  { value: 'presentation', label: 'Apresentação Comercial', icon: Presentation, description: 'Pitch de vendas' },
  { value: 'objection_handling', label: 'Tratamento de Objeções', icon: ShieldQuestion, description: 'Rebatimentos' },
  { value: 'follow_up', label: 'Follow-up', icon: MessageCircle, description: 'Acompanhamento' },
  { value: 'closing', label: 'Fechamento', icon: Trophy, description: 'Scripts de fechamento' },
  { value: 'whatsapp', label: 'WhatsApp/Mensagem', icon: MessageCircle, description: 'Scripts de texto' },
];

interface SalesScript { id: string; title: string; content: string; objection_type: string | null; funnel_stage: string | null; tags: string[] | null; is_active: boolean; created_by: string; created_at: string; }
interface SalesMaterial { id: string; account_id: string; material_type: string; title: string; content: string; is_active: boolean; created_at: string; file_url: string | null; file_name: string | null; file_size: number | null; }
interface SalesPlaybook { id: string; account_id: string; title: string; content: string; script_type: string; is_favorite: boolean; generated_from: any; created_at: string; }

export default function SalesScripts() {
  const { currentUser } = useCurrentUser();
  const queryClient = useQueryClient();
  const accountId = currentUser?.account_id;
  const isAdmin = currentUser?.role === 'admin' || currentUser?.is_also_admin || currentUser?.team_role_name === 'Admin';
  const isSalesRep = (() => {
    const role = currentUser?.team_role_name;
    return !!role && ['SDR', 'Closer', 'Vendas', 'Vendedor'].includes(role) && !isAdmin;
  })();

  const [activeTab, setActiveTab] = useState(isSalesRep ? 'playbooks' : 'materials');
  const [materialDialogOpen, setMaterialDialogOpen] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<SalesMaterial | null>(null);
  const [materialForm, setMaterialForm] = useState({ title: '', content: '', material_type: '' });
  const [materialFile, setMaterialFile] = useState<File | null>(null);
  const [deleteMaterialDialog, setDeleteMaterialDialog] = useState<SalesMaterial | null>(null);

  const [generateDialogOpen, setGenerateDialogOpen] = useState(false);
  const [selectedScriptType, setSelectedScriptType] = useState('');
  const [meetingType, setMeetingType] = useState<'scheduled' | 'cold'>('scheduled');
  const [customPrompt, setCustomPrompt] = useState('');
  const [viewingPlaybook, setViewingPlaybook] = useState<SalesPlaybook | null>(null);
  const [deletePlaybookDialog, setDeletePlaybookDialog] = useState<SalesPlaybook | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [filterObjection, setFilterObjection] = useState('all');
  const [filterFunnel, setFilterFunnel] = useState('all');
  const [scriptDialogOpen, setScriptDialogOpen] = useState(false);
  const [editingScript, setEditingScript] = useState<SalesScript | null>(null);
  const [deleteScriptDialog, setDeleteScriptDialog] = useState<SalesScript | null>(null);
  const [scriptForm, setScriptForm] = useState({ title: '', content: '', objection_type: '', funnel_stage: '', tags: '' });

  const [transcriptText, setTranscriptText] = useState('');
  const [transcriptFile, setTranscriptFile] = useState<File | null>(null);
  const [transcriptAnalysis, setTranscriptAnalysis] = useState<string | null>(null);
  const [selectedDealId, setSelectedDealId] = useState<string | null>(null);
  const [viewingAnalysis, setViewingAnalysis] = useState<{ id: string; analysis: string; created_at: string; deal_id?: string | null; deal_name?: string | null } | null>(null);
  const [deleteAnalysisDialog, setDeleteAnalysisDialog] = useState<{ id: string; created_at: string } | null>(null);

  // Queries
  const { data: materials = [], isLoading: loadingMaterials } = useQuery({
    queryKey: ['sales-materials', accountId],
    queryFn: async () => {
      const { data, error } = await supabase.from('sales_materials').select('*').eq('account_id', accountId!).eq('is_active', true).order('material_type');
      if (error) throw error;
      return data as SalesMaterial[];
    },
    enabled: !!accountId,
  });

  const { data: playbooks = [], isLoading: loadingPlaybooks } = useQuery({
    queryKey: ['sales-playbooks', accountId],
    queryFn: async () => {
      const { data, error } = await supabase.from('sales_playbooks').select('*').eq('account_id', accountId!).order('created_at', { ascending: false });
      if (error) throw error;
      return data as SalesPlaybook[];
    },
    enabled: !!accountId,
  });

  const { data: savedAnalyses = [], isLoading: loadingAnalyses } = useQuery({
    queryKey: ['sales-call-analyses', accountId],
    queryFn: async () => {
      const { data, error } = await supabase.from('sales_call_analyses').select('*, deal:deals!sales_call_analyses_deal_id_fkey(id, title)').eq('account_id', accountId!).order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []).map((a: any) => ({ ...a, deal_name: a.deal?.title || null }));
    },
    enabled: !!accountId,
  });

  const { data: deals = [] } = useQuery({
    queryKey: ['deals-for-analysis', accountId],
    queryFn: async () => {
      const { data, error } = await supabase.from('deals').select('id, title, lead:leads!deals_lead_id_fkey(full_name)').eq('account_id', accountId!).order('created_at', { ascending: false }).limit(200);
      if (error) throw error;
      return data as any[];
    },
    enabled: !!accountId,
  });

  const { data: scripts = [], isLoading: loadingScripts } = useQuery({
    queryKey: ['sales-scripts', accountId],
    queryFn: async () => {
      const { data, error } = await supabase.from('sales_scripts').select('*').eq('account_id', accountId!).order('created_at', { ascending: false });
      if (error) throw error;
      return data as SalesScript[];
    },
    enabled: !!accountId,
  });

  // Mutations
  const saveMaterialMutation = useMutation({
    mutationFn: async (form: typeof materialForm) => {
      const payload: any = { account_id: accountId!, material_type: form.material_type, title: form.title, content: form.content || '', is_active: true };
      if (editingMaterial) {
        const { error } = await supabase.from('sales_materials').update(payload).eq('id', editingMaterial.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('sales_materials').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['sales-materials'] }); toast.success(editingMaterial ? 'Material atualizado!' : 'Material adicionado!'); setMaterialDialogOpen(false); setEditingMaterial(null); setMaterialForm({ title: '', content: '', material_type: '' }); },
    onError: (e: any) => toast.error(`Erro: ${e?.message || 'desconhecido'}`),
  });

  const deleteMaterialMutation = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from('sales_materials').delete().eq('id', id); if (error) throw error; },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['sales-materials'] }); toast.success('Material excluído!'); setDeleteMaterialDialog(null); },
  });

  const generateScriptMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('generate-sales-script', { body: { accountId, scriptType: selectedScriptType, meetingType, customPrompt: customPrompt || undefined } });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => { queryClient.invalidateQueries({ queryKey: ['sales-playbooks'] }); toast.success('Script gerado!'); setGenerateDialogOpen(false); setSelectedScriptType(''); setCustomPrompt(''); if (data) { setViewingPlaybook(data); setActiveTab('playbooks'); } },
    onError: (e: any) => toast.error(e?.message || 'Erro ao gerar script'),
  });

  const toggleFavoriteMutation = useMutation({
    mutationFn: async ({ id, isFavorite }: { id: string; isFavorite: boolean }) => { const { error } = await supabase.from('sales_playbooks').update({ is_favorite: !isFavorite }).eq('id', id); if (error) throw error; },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sales-playbooks'] }),
  });

  const deletePlaybookMutation = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from('sales_playbooks').delete().eq('id', id); if (error) throw error; },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['sales-playbooks'] }); toast.success('Playbook excluído!'); setDeletePlaybookDialog(null); },
  });

  const saveScriptMutation = useMutation({
    mutationFn: async (data: typeof scriptForm) => {
      const payload = { account_id: accountId!, title: data.title, content: data.content, objection_type: data.objection_type || null, funnel_stage: data.funnel_stage || null, tags: data.tags ? data.tags.split(',').map(t => t.trim()).filter(Boolean) : null, is_active: true, created_by: currentUser?.id! };
      if (editingScript) { const { error } = await supabase.from('sales_scripts').update(payload).eq('id', editingScript.id); if (error) throw error; }
      else { const { error } = await supabase.from('sales_scripts').insert(payload); if (error) throw error; }
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['sales-scripts'] }); toast.success(editingScript ? 'Script atualizado!' : 'Script criado!'); setScriptDialogOpen(false); setEditingScript(null); setScriptForm({ title: '', content: '', objection_type: '', funnel_stage: '', tags: '' }); },
    onError: () => toast.error('Erro ao salvar script'),
  });

  const deleteScriptMutation = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from('sales_scripts').delete().eq('id', id); if (error) throw error; },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['sales-scripts'] }); toast.success('Script excluído!'); setDeleteScriptDialog(null); },
  });

  const analyzeTranscriptMutation = useMutation({
    mutationFn: async () => {
      let text = transcriptText;
      if (transcriptFile && !text) text = await transcriptFile.text();
      if (!text.trim()) throw new Error('Insira ou envie uma transcrição');
      const { data, error } = await supabase.functions.invoke('analyze-sales-call', { body: { transcript: text } });
      if (error) throw error;
      return data;
    },
    onSuccess: async (data) => {
      setTranscriptAnalysis(data.analysis);
      const preview = (transcriptText || '').substring(0, 200);
      await supabase.from('sales_call_analyses').insert({ account_id: accountId!, user_id: currentUser?.id!, analysis: data.analysis, transcript_preview: preview || null });
      queryClient.invalidateQueries({ queryKey: ['sales-call-analyses'] });
      toast.success('Análise concluída e salva!');
    },
    onError: (e: any) => toast.error(e?.message || 'Erro ao analisar'),
  });

  const deleteAnalysisMutation = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from('sales_call_analyses').delete().eq('id', id); if (error) throw error; },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['sales-call-analyses'] }); toast.success('Análise excluída!'); setDeleteAnalysisDialog(null); },
  });

  const handleCopy = async (content: string) => { await navigator.clipboard.writeText(content); toast.success('Copiado!'); };
  const filteredScripts = scripts.filter(s => { const ms = searchQuery === '' || s.title.toLowerCase().includes(searchQuery.toLowerCase()) || s.content.toLowerCase().includes(searchQuery.toLowerCase()); const mo = filterObjection === 'all' || s.objection_type === filterObjection; const mf = filterFunnel === 'all' || s.funnel_stage === filterFunnel; return ms && mo && mf; });
  const getObjectionConfig = (type: string | null) => OBJECTION_TYPES.find(o => o.value === type) || OBJECTION_TYPES[5];
  const getFunnelConfig = (stage: string | null) => FUNNEL_STAGES.find(f => f.value === stage);
  const getMaterialType = (type: string) => MATERIAL_TYPES.find(m => m.value === type);
  const getScriptType = (type: string) => SCRIPT_TYPES.find(s => s.value === type);
  const materialCountByType = MATERIAL_TYPES.map(mt => ({ ...mt, count: materials.filter(m => m.material_type === mt.value).length }));

  return (
    <div className="p-4 space-y-4 max-w-6xl mx-auto pb-20 md:pb-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1"><MessageSquareText className="w-7 h-7 text-primary" /><h1 className="text-xl font-bold">Scripts de Vendas</h1></div>
          <p className="text-muted-foreground text-xs">{isSalesRep ? "Playbooks de vendas" : "Materiais, playbooks, análise de calls, comissões e scripts"}</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        {isSalesRep ? (
          <TabsList className="grid w-full grid-cols-1 mb-4">
            <TabsTrigger value="playbooks" className="gap-1.5"><Sparkles className="w-4 h-4 hidden sm:inline" /><span className="text-xs">Playbooks</span></TabsTrigger>
          </TabsList>
        ) : (
          <TabsList className="grid w-full grid-cols-5 mb-4">
            <TabsTrigger value="materials" className="gap-1.5"><Package className="w-4 h-4 hidden sm:inline" /><span className="text-xs">Materiais</span></TabsTrigger>
            <TabsTrigger value="playbooks" className="gap-1.5"><Sparkles className="w-4 h-4 hidden sm:inline" /><span className="text-xs">Playbooks</span></TabsTrigger>
            <TabsTrigger value="analysis" className="gap-1.5"><BarChart3 className="w-4 h-4 hidden sm:inline" /><span className="text-xs">Calls</span></TabsTrigger>
            <TabsTrigger value="commission" className="gap-1.5"><DollarSign className="w-4 h-4 hidden sm:inline" /><span className="text-xs">Comissões</span></TabsTrigger>
            <TabsTrigger value="scripts" className="gap-1.5"><BookOpen className="w-4 h-4 hidden sm:inline" /><span className="text-xs">Scripts</span></TabsTrigger>
          </TabsList>
        )}

        {/* MATERIALS */}
        <TabsContent value="materials">
          <div className="flex items-center justify-between mb-4"><h2 className="text-lg font-semibold">Materiais de Apoio</h2><Button onClick={() => { setEditingMaterial(null); setMaterialFile(null); setMaterialForm({ title: '', content: '', material_type: '' }); setMaterialDialogOpen(true); }}><Plus className="w-4 h-4 mr-2" />Adicionar</Button></div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">{materialCountByType.map(mt => { const Icon = mt.icon; return (<Card key={mt.value} className={cn("cursor-pointer transition-colors", mt.count > 0 ? "border-primary/30 bg-primary/5" : "opacity-60")}><CardContent className="p-4 flex items-center gap-3"><div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", mt.count > 0 ? "bg-primary/10" : "bg-muted")}><Icon className={cn("w-5 h-5", mt.count > 0 ? "text-primary" : "text-muted-foreground")} /></div><div><p className="text-sm font-medium">{mt.label}</p><p className="text-xs text-muted-foreground">{mt.count > 0 ? `${mt.count} item(ns)` : 'Vazio'}</p></div>{mt.count > 0 && <CheckCircle2 className="w-4 h-4 text-primary ml-auto" />}</CardContent></Card>); })}</div>
          {loadingMaterials ? <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div> : materials.length === 0 ? <Card><CardContent className="p-12 text-center"><Package className="w-12 h-12 mx-auto mb-4 text-muted-foreground" /><h3 className="text-lg font-semibold mb-2">Nenhum material</h3><p className="text-muted-foreground mb-4">Adicione informações sobre produto, preço, ICP e diferenciais</p></CardContent></Card> : (
            <div className="space-y-3">{materials.map(material => { const mt = getMaterialType(material.material_type); const Icon = mt?.icon || Package; return (<Card key={material.id} className="group hover:border-primary/30 transition-colors"><CardContent className="p-4"><div className="flex items-start gap-3"><div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0"><Icon className="w-5 h-5 text-primary" /></div><div className="flex-1 min-w-0"><div className="flex items-center gap-2 mb-1"><Badge variant="secondary" className="text-xs">{mt?.label || material.material_type}</Badge><h4 className="font-medium truncate">{material.title}</h4></div><p className="text-sm text-muted-foreground whitespace-pre-wrap line-clamp-3">{material.content}</p></div><div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"><Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleCopy(material.content)}><Copy className="w-4 h-4" /></Button><Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditingMaterial(material); setMaterialForm({ title: material.title, content: material.content, material_type: material.material_type }); setMaterialDialogOpen(true); }}><Edit2 className="w-4 h-4" /></Button><Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteMaterialDialog(material)}><Trash2 className="w-4 h-4" /></Button></div></div></CardContent></Card>); })}</div>
          )}
        </TabsContent>

        {/* PLAYBOOKS */}
        <TabsContent value="playbooks">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
            <div><h2 className="text-lg font-semibold">{isSalesRep ? "Playbooks" : "Playbooks Gerados"}</h2><p className="text-sm text-muted-foreground">{isSalesRep ? "Playbooks disponíveis para consulta" : `Scripts personalizados (${materials.length} materiais)`}</p></div>
            {!isSalesRep && <Button onClick={() => setGenerateDialogOpen(true)} disabled={materials.length === 0}><Sparkles className="w-4 h-4 mr-2" />Gerar Novo Script</Button>}
          </div>
          {!isSalesRep && materials.length === 0 && <Card className="mb-6 border-primary/30 bg-primary/5"><CardContent className="p-4 flex items-center gap-3"><AlertCircle className="w-5 h-5 text-primary shrink-0" /><p className="text-sm"><strong>Dica:</strong> Cadastre materiais na aba "Materiais" para gerar scripts mais precisos.</p></CardContent></Card>}
          {loadingPlaybooks ? <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div> : playbooks.length === 0 ? <Card><CardContent className="p-12 text-center"><Sparkles className="w-12 h-12 mx-auto mb-4 text-muted-foreground" /><h3 className="text-lg font-semibold mb-2">Nenhum playbook</h3></CardContent></Card> : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{playbooks.map(pb => { const st = getScriptType(pb.script_type); const Icon = st?.icon || FileText; return (<Card key={pb.id} className="group hover:border-primary/30 transition-colors cursor-pointer" onClick={() => setViewingPlaybook(pb)}><CardHeader className="pb-2"><div className="flex items-start justify-between gap-2"><div className="flex items-center gap-2 flex-1 min-w-0"><Icon className="w-5 h-5 text-primary shrink-0" /><CardTitle className="text-base line-clamp-1">{pb.title}</CardTitle></div>{!isSalesRep && <div className="flex gap-1" onClick={e => e.stopPropagation()}><Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => toggleFavoriteMutation.mutate({ id: pb.id, isFavorite: pb.is_favorite })}>{pb.is_favorite ? <Star className="w-4 h-4 text-primary fill-primary" /> : <StarOff className="w-4 h-4 text-muted-foreground" />}</Button><Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeletePlaybookDialog(pb)}><Trash2 className="w-4 h-4" /></Button></div>}</div></CardHeader><CardContent><Badge variant="secondary" className="text-xs mb-2">{st?.label || pb.script_type}</Badge><p className="text-sm text-muted-foreground line-clamp-3">{pb.content.replace(/[#*`]/g, '').substring(0, 200)}...</p><p className="text-xs text-muted-foreground mt-2">{new Date(pb.created_at).toLocaleDateString('pt-BR')}</p></CardContent></Card>); })}</div>
          )}
        </TabsContent>

        {/* ANALYSIS */}
        <TabsContent value="analysis">
          <div className="space-y-6">
            <div><h2 className="text-lg font-semibold mb-1">Análise de Calls de Vendas</h2><p className="text-sm text-muted-foreground">Envie transcrições para identificar objeções, erros e melhorias</p></div>
            <Card><CardHeader><CardTitle className="text-base flex items-center gap-2"><Mic className="w-5 h-5 text-primary" />Transcrição da Call</CardTitle></CardHeader><CardContent className="space-y-4">
              <div className="border border-dashed border-border rounded-lg p-4">{transcriptFile ? (<div className="flex items-center justify-between"><div className="flex items-center gap-2"><FileText className="w-4 h-4 text-primary" /><span className="text-sm truncate">{transcriptFile.name}</span></div><Button variant="ghost" size="sm" onClick={() => setTranscriptFile(null)}><Trash2 className="w-4 h-4" /></Button></div>) : (<label htmlFor="transcript-file" className="flex flex-col items-center gap-2 cursor-pointer py-2"><Upload className="w-8 h-8 text-muted-foreground" /><span className="text-sm text-muted-foreground">Clique para enviar</span><span className="text-xs text-muted-foreground">TXT, PDF, Word</span><input id="transcript-file" type="file" className="hidden" accept=".txt,.pdf,.doc,.docx" onChange={e => { if (e.target.files?.[0]) setTranscriptFile(e.target.files[0]); }} /></label>)}</div>
              <Textarea placeholder="Ou cole a transcrição aqui..." value={transcriptText} onChange={e => setTranscriptText(e.target.value)} className="min-h-[200px] font-mono text-sm" />
              <Button onClick={() => analyzeTranscriptMutation.mutate()} disabled={analyzeTranscriptMutation.isPending || (!transcriptText.trim() && !transcriptFile)} className="w-full">{analyzeTranscriptMutation.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Analisando...</> : <><BarChart3 className="w-4 h-4 mr-2" />Analisar Call</>}</Button>
            </CardContent></Card>
            {transcriptAnalysis && <Card><CardHeader><CardTitle className="text-base flex items-center gap-2"><CheckCircle2 className="w-5 h-5 text-primary" />Resultado da Análise</CardTitle></CardHeader><CardContent><MarkdownRenderer content={transcriptAnalysis} /><div className="flex gap-2 mt-4"><Button variant="outline" size="sm" onClick={() => handleCopy(transcriptAnalysis)}><Copy className="w-4 h-4 mr-2" />Copiar</Button><Button variant="outline" size="sm" onClick={() => exportSalesCallToPDF({ analysis: transcriptAnalysis, createdAt: new Date().toISOString() })}><Download className="w-4 h-4 mr-2" />PDF</Button></div></CardContent></Card>}
            {savedAnalyses.length > 0 && <div><h3 className="text-base font-semibold mb-3">Análises Salvas ({savedAnalyses.length})</h3><div className="space-y-2">{savedAnalyses.map(a => (<Card key={a.id} className="cursor-pointer hover:border-primary/30" onClick={() => setViewingAnalysis(a)}><CardContent className="p-4 flex items-center justify-between"><div className="flex-1 min-w-0"><p className="text-sm font-medium">{new Date(a.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}</p>{a.transcript_preview && <p className="text-xs text-muted-foreground truncate mt-1">{a.transcript_preview}</p>}</div><div className="flex gap-1" onClick={e => e.stopPropagation()}><Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteAnalysisDialog(a)}><Trash2 className="w-4 h-4" /></Button></div></CardContent></Card>))}</div></div>}
          </div>
        </TabsContent>

        {/* COMMISSION */}
        <TabsContent value="commission"><CommissionCalculator /></TabsContent>

        {/* SCRIPTS */}
        <TabsContent value="scripts">
          <div className="flex items-center justify-between mb-4"><h2 className="text-lg font-semibold">Scripts & Objeções</h2><Button onClick={() => { setEditingScript(null); setScriptForm({ title: '', content: '', objection_type: '', funnel_stage: '', tags: '' }); setScriptDialogOpen(true); }}><Plus className="w-4 h-4 mr-2" />Novo Script</Button></div>
          <Card className="mb-6"><CardContent className="p-4"><div className="flex flex-col sm:flex-row gap-4"><div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><Input placeholder="Buscar scripts..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-10" /></div><Select value={filterObjection} onValueChange={setFilterObjection}><SelectTrigger className="w-full sm:w-[180px]"><SelectValue placeholder="Tipo de Objeção" /></SelectTrigger><SelectContent><SelectItem value="all">Todas Objeções</SelectItem>{OBJECTION_TYPES.map(({ value, label }) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select><Select value={filterFunnel} onValueChange={setFilterFunnel}><SelectTrigger className="w-full sm:w-[180px]"><SelectValue placeholder="Etapa do Funil" /></SelectTrigger><SelectContent><SelectItem value="all">Todas Etapas</SelectItem>{FUNNEL_STAGES.map(({ value, label }) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div></CardContent></Card>
          {loadingScripts ? <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div> : filteredScripts.length === 0 ? <Card><CardContent className="p-12 text-center"><MessageSquareText className="w-12 h-12 mx-auto mb-4 text-muted-foreground" /><h3 className="text-lg font-semibold mb-2">Nenhum script encontrado</h3></CardContent></Card> : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{filteredScripts.map(script => { const objection = getObjectionConfig(script.objection_type); const funnel = getFunnelConfig(script.funnel_stage); const ObjectionIcon = objection.icon; return (<Card key={script.id} className="group hover:border-primary/30 transition-colors"><CardHeader className="pb-3"><div className="flex items-start justify-between gap-2"><div className="flex-1 min-w-0"><CardTitle className="text-lg truncate">{script.title}</CardTitle><div className="flex flex-wrap gap-2 mt-2">{script.objection_type && <Badge variant="secondary" className={cn("text-xs", objection.bgColor)}><ObjectionIcon className={cn("w-3 h-3 mr-1", objection.color)} />{objection.label}</Badge>}{funnel && <Badge variant="secondary" className={cn("text-xs", funnel.bgColor)}>{funnel.label}</Badge>}</div></div><div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity"><Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleCopy(script.content)}><Copy className="w-4 h-4" /></Button><Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditingScript(script); setScriptForm({ title: script.title, content: script.content, objection_type: script.objection_type || '', funnel_stage: script.funnel_stage || '', tags: script.tags?.join(', ') || '' }); setScriptDialogOpen(true); }}><Edit2 className="w-4 h-4" /></Button><Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteScriptDialog(script)}><Trash2 className="w-4 h-4" /></Button></div></div></CardHeader><CardContent><p className="text-sm text-muted-foreground whitespace-pre-wrap line-clamp-4">{script.content}</p>{script.tags && script.tags.length > 0 && <div className="flex flex-wrap gap-1 mt-3">{script.tags.map((tag, i) => <Badge key={i} variant="outline" className="text-xs">{tag}</Badge>)}</div>}</CardContent></Card>); })}</div>
          )}
        </TabsContent>
      </Tabs>

      {/* DIALOGS */}

      {/* Material Dialog */}
      <Dialog open={materialDialogOpen} onOpenChange={setMaterialDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingMaterial ? 'Editar Material' : 'Novo Material'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            {!materialForm.material_type ? (
              <div className="grid grid-cols-2 gap-3">{MATERIAL_TYPES.map(mt => { const Icon = mt.icon; return (<Card key={mt.value} className="cursor-pointer hover:border-primary/30 transition-all" onClick={() => setMaterialForm(p => ({ ...p, material_type: mt.value }))}><CardContent className="p-4 flex items-center gap-3"><Icon className="w-5 h-5 text-primary" /><div><p className="text-sm font-medium">{mt.label}</p><p className="text-xs text-muted-foreground">{mt.description}</p></div></CardContent></Card>); })}</div>
            ) : (<>
              <div className="flex items-center gap-2"><Badge variant="secondary">{getMaterialType(materialForm.material_type)?.label}</Badge><Button variant="ghost" size="sm" onClick={() => setMaterialForm(p => ({ ...p, material_type: '' }))}>Trocar tipo</Button></div>
              <div className="space-y-2"><Label>Título *</Label><Input value={materialForm.title} onChange={e => setMaterialForm(p => ({ ...p, title: e.target.value }))} placeholder="Nome do material" /></div>
              <div className="space-y-2"><Label>Conteúdo</Label><Textarea value={materialForm.content} onChange={e => setMaterialForm(p => ({ ...p, content: e.target.value }))} className="min-h-[200px]" placeholder="Descreva o material..." /></div>
              <DialogFooter><Button variant="outline" onClick={() => setMaterialDialogOpen(false)}>Cancelar</Button><Button onClick={() => { if (!materialForm.title) { toast.error('Preencha o título'); return; } saveMaterialMutation.mutate(materialForm); }} disabled={saveMaterialMutation.isPending}>{saveMaterialMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}{editingMaterial ? 'Salvar' : 'Adicionar'}</Button></DialogFooter>
            </>)}
          </div>
        </DialogContent>
      </Dialog>

      {/* Generate Script Dialog */}
      <Dialog open={generateDialogOpen} onOpenChange={setGenerateDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {generateScriptMutation.isPending ? (<div className="py-16 flex flex-col items-center gap-4"><Loader2 className="w-8 h-8 animate-spin text-primary" /><p className="text-sm text-muted-foreground">Gerando script personalizado...</p></div>) : (<>
            <DialogHeader><DialogTitle className="flex items-center gap-2"><Sparkles className="w-5 h-5 text-primary" />Gerar Script</DialogTitle><DialogDescription>Escolha o tipo e gere baseado nos seus materiais</DialogDescription></DialogHeader>
            <ScrollArea className="max-h-[70vh]"><div className="space-y-4 pr-2">
              <div className="space-y-2"><Label>Tipo de Script *</Label><div className="grid grid-cols-2 gap-2">{SCRIPT_TYPES.map(st => { const Icon = st.icon; return (<Card key={st.value} className={cn("cursor-pointer transition-all", selectedScriptType === st.value ? "border-primary bg-primary/5" : "hover:border-primary/30")} onClick={() => setSelectedScriptType(st.value)}><CardContent className="p-3 flex items-center gap-3"><Icon className={cn("w-5 h-5", selectedScriptType === st.value ? "text-primary" : "text-muted-foreground")} /><div><p className="text-sm font-medium">{st.label}</p><p className="text-xs text-muted-foreground">{st.description}</p></div></CardContent></Card>); })}</div></div>
              <div className="space-y-2"><Label>Tipo de Reunião</Label><div className="grid grid-cols-2 gap-2"><Card className={cn("cursor-pointer", meetingType === 'scheduled' ? "border-primary bg-primary/5" : "")} onClick={() => setMeetingType('scheduled')}><CardContent className="p-3 flex items-center gap-2"><Clock className={cn("w-4 h-4", meetingType === 'scheduled' ? "text-primary" : "text-muted-foreground")} /><div><p className="text-sm font-medium">Agendada</p></div></CardContent></Card><Card className={cn("cursor-pointer", meetingType === 'cold' ? "border-primary bg-primary/5" : "")} onClick={() => setMeetingType('cold')}><CardContent className="p-3 flex items-center gap-2"><Phone className={cn("w-4 h-4", meetingType === 'cold' ? "text-primary" : "text-muted-foreground")} /><div><p className="text-sm font-medium">Cold Call</p></div></CardContent></Card></div></div>
              <div className="space-y-2"><Label>Instrução adicional (opcional)</Label><Textarea placeholder="Ex: Foque em empresas de tecnologia..." value={customPrompt} onChange={e => setCustomPrompt(e.target.value)} className="min-h-[80px]" /></div>
              <DialogFooter><Button variant="outline" onClick={() => setGenerateDialogOpen(false)}>Cancelar</Button><Button onClick={() => generateScriptMutation.mutate()} disabled={!selectedScriptType}><Sparkles className="w-4 h-4 mr-2" />Gerar Script</Button></DialogFooter>
            </div></ScrollArea>
          </>)}
        </DialogContent>
      </Dialog>

      {/* View Playbook Dialog */}
      <Dialog open={!!viewingPlaybook} onOpenChange={open => { if (!open) setViewingPlaybook(null); }}>
        <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
          <DialogHeader><DialogTitle>{viewingPlaybook?.title}</DialogTitle><DialogDescription>{getScriptType(viewingPlaybook?.script_type || '')?.label} • {viewingPlaybook && new Date(viewingPlaybook.created_at).toLocaleDateString('pt-BR')}</DialogDescription></DialogHeader>
          <div className="flex items-center gap-2 py-2 border-b border-border shrink-0"><Button variant="outline" size="sm" onClick={() => viewingPlaybook && handleCopy(viewingPlaybook.content)}><Copy className="w-4 h-4 mr-2" />Copiar</Button><Button variant="outline" size="sm" onClick={() => { if (viewingPlaybook) { const st = getScriptType(viewingPlaybook.script_type); exportPlaybookToPDF({ title: viewingPlaybook.title, scriptType: st?.label || viewingPlaybook.script_type, content: viewingPlaybook.content, createdAt: viewingPlaybook.created_at }); } }}><Download className="w-4 h-4 mr-2" />PDF</Button></div>
          <div className="flex-1 overflow-y-auto min-h-0"><div className="max-w-none pr-2"><MarkdownRenderer content={viewingPlaybook?.content || ''} /></div></div>
        </DialogContent>
      </Dialog>

      {/* Script Dialog */}
      <Dialog open={scriptDialogOpen} onOpenChange={setScriptDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingScript ? 'Editar Script' : 'Novo Script'}</DialogTitle></DialogHeader>
          <form onSubmit={e => { e.preventDefault(); if (!scriptForm.title || !scriptForm.content) { toast.error('Preencha título e conteúdo'); return; } saveScriptMutation.mutate(scriptForm); }} className="space-y-4">
            <div className="space-y-2"><Label>Título *</Label><Input value={scriptForm.title} onChange={e => setScriptForm(p => ({ ...p, title: e.target.value }))} placeholder="Ex: Resposta para objeção de preço" /></div>
            <div className="grid grid-cols-2 gap-4"><div className="space-y-2"><Label>Tipo de Objeção</Label><Select value={scriptForm.objection_type} onValueChange={v => setScriptForm(p => ({ ...p, objection_type: v }))}><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent>{OBJECTION_TYPES.map(({ value, label }) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label>Etapa do Funil</Label><Select value={scriptForm.funnel_stage} onValueChange={v => setScriptForm(p => ({ ...p, funnel_stage: v }))}><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent>{FUNNEL_STAGES.map(({ value, label }) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div></div>
            <div className="space-y-2"><Label>Conteúdo *</Label><Textarea value={scriptForm.content} onChange={e => setScriptForm(p => ({ ...p, content: e.target.value }))} className="min-h-[200px]" placeholder="Digite o script..." /></div>
            <div className="space-y-2"><Label>Tags (separadas por vírgula)</Label><Input value={scriptForm.tags} onChange={e => setScriptForm(p => ({ ...p, tags: e.target.value }))} placeholder="vendas, b2b" /></div>
            <DialogFooter><Button type="button" variant="outline" onClick={() => setScriptDialogOpen(false)}>Cancelar</Button><Button type="submit" disabled={saveScriptMutation.isPending}>{saveScriptMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}{editingScript ? 'Salvar' : 'Criar'}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* View Analysis Dialog */}
      <Dialog open={!!viewingAnalysis} onOpenChange={open => { if (!open) setViewingAnalysis(null); }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><BarChart3 className="w-5 h-5 text-primary" />Análise de Call</DialogTitle><DialogDescription>{viewingAnalysis && new Date(viewingAnalysis.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}</DialogDescription></DialogHeader>
          <div className="max-w-none"><MarkdownRenderer content={viewingAnalysis?.analysis || ''} /></div>
          <DialogFooter><Button variant="outline" size="sm" onClick={() => viewingAnalysis && handleCopy(viewingAnalysis.analysis)}><Copy className="w-4 h-4 mr-2" />Copiar</Button><Button variant="outline" size="sm" onClick={() => { if (viewingAnalysis) exportSalesCallToPDF({ analysis: viewingAnalysis.analysis, createdAt: viewingAnalysis.created_at }); }}><Download className="w-4 h-4 mr-2" />PDF</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmations */}
      <AlertDialog open={!!deleteMaterialDialog} onOpenChange={open => !open && setDeleteMaterialDialog(null)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Excluir Material</AlertDialogTitle><AlertDialogDescription>Tem certeza que deseja excluir "{deleteMaterialDialog?.title}"?</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction className="bg-destructive text-destructive-foreground" onClick={() => deleteMaterialDialog && deleteMaterialMutation.mutate(deleteMaterialDialog.id)}>Excluir</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
      <AlertDialog open={!!deletePlaybookDialog} onOpenChange={open => !open && setDeletePlaybookDialog(null)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Excluir Playbook</AlertDialogTitle><AlertDialogDescription>Tem certeza que deseja excluir "{deletePlaybookDialog?.title}"?</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction className="bg-destructive text-destructive-foreground" onClick={() => deletePlaybookDialog && deletePlaybookMutation.mutate(deletePlaybookDialog.id)}>Excluir</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
      <AlertDialog open={!!deleteScriptDialog} onOpenChange={open => !open && setDeleteScriptDialog(null)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Excluir Script</AlertDialogTitle><AlertDialogDescription>Tem certeza?</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction className="bg-destructive text-destructive-foreground" onClick={() => deleteScriptDialog && deleteScriptMutation.mutate(deleteScriptDialog.id)}>Excluir</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
      <AlertDialog open={!!deleteAnalysisDialog} onOpenChange={open => !open && setDeleteAnalysisDialog(null)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Excluir Análise</AlertDialogTitle><AlertDialogDescription>Tem certeza?</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction className="bg-destructive text-destructive-foreground" onClick={() => deleteAnalysisDialog && deleteAnalysisMutation.mutate(deleteAnalysisDialog.id)}>Excluir</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    </div>
  );
}
