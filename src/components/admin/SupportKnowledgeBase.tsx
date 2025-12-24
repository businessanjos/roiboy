import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  BookOpen,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Search,
  Tag
} from "lucide-react";

interface KnowledgeArticle {
  id: string;
  title: string;
  content: string;
  category: string;
  keywords: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const CATEGORIES = [
  { value: "geral", label: "Geral" },
  { value: "troubleshooting", label: "Solução de Problemas" },
  { value: "clientes", label: "Clientes" },
  { value: "eventos", label: "Eventos" },
  { value: "integracoes", label: "Integrações" },
  { value: "financeiro", label: "Financeiro" },
  { value: "tarefas", label: "Tarefas" },
];

export function SupportKnowledgeBase() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingArticle, setEditingArticle] = useState<KnowledgeArticle | null>(null);
  
  // Form state
  const [formTitle, setFormTitle] = useState("");
  const [formContent, setFormContent] = useState("");
  const [formCategory, setFormCategory] = useState("geral");
  const [formKeywords, setFormKeywords] = useState("");
  const [formActive, setFormActive] = useState(true);

  // Fetch articles
  const { data: articles = [], isLoading } = useQuery({
    queryKey: ["knowledge-base", categoryFilter, search],
    queryFn: async () => {
      let query = supabase
        .from("support_knowledge_base")
        .select("*")
        .order("updated_at", { ascending: false });

      if (categoryFilter !== "all") {
        query = query.eq("category", categoryFilter);
      }

      if (search) {
        query = query.or(`title.ilike.%${search}%,content.ilike.%${search}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as KnowledgeArticle[];
    }
  });

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      const keywords = formKeywords
        .split(",")
        .map(k => k.trim().toLowerCase())
        .filter(k => k.length > 0);

      const articleData = {
        title: formTitle,
        content: formContent,
        category: formCategory,
        keywords,
        is_active: formActive
      };

      if (editingArticle) {
        const { error } = await supabase
          .from("support_knowledge_base")
          .update(articleData)
          .eq("id", editingArticle.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("support_knowledge_base")
          .insert(articleData);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editingArticle ? "Artigo atualizado" : "Artigo criado");
      queryClient.invalidateQueries({ queryKey: ["knowledge-base"] });
      handleCloseDialog();
    },
    onError: () => {
      toast.error("Erro ao salvar artigo");
    }
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("support_knowledge_base")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Artigo excluído");
      queryClient.invalidateQueries({ queryKey: ["knowledge-base"] });
    },
    onError: () => {
      toast.error("Erro ao excluir artigo");
    }
  });

  const handleOpenDialog = (article?: KnowledgeArticle) => {
    if (article) {
      setEditingArticle(article);
      setFormTitle(article.title);
      setFormContent(article.content);
      setFormCategory(article.category);
      setFormKeywords((article.keywords || []).join(", "));
      setFormActive(article.is_active);
    } else {
      setEditingArticle(null);
      setFormTitle("");
      setFormContent("");
      setFormCategory("geral");
      setFormKeywords("");
      setFormActive(true);
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingArticle(null);
  };

  const handleSave = () => {
    if (!formTitle.trim() || !formContent.trim()) {
      toast.error("Preencha título e conteúdo");
      return;
    }
    saveMutation.mutate();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Base de Conhecimento</h3>
          <p className="text-sm text-muted-foreground">
            Artigos e FAQs para a IA de suporte consultar
          </p>
        </div>
        <Button onClick={() => handleOpenDialog()}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Artigo
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar artigos..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            {CATEGORIES.map(cat => (
              <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Articles Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : articles.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>Nenhum artigo encontrado</p>
          <p className="text-sm">Crie artigos para a IA consultar ao responder clientes</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {articles.map((article) => (
            <Card key={article.id} className={!article.is_active ? "opacity-50" : ""}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-sm font-medium line-clamp-2">
                    {article.title}
                  </CardTitle>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => handleOpenDialog(article)}
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive"
                      onClick={() => deleteMutation.mutate(article.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground line-clamp-3 mb-3">
                  {article.content}
                </p>
                <div className="flex flex-wrap gap-1 mb-2">
                  <Badge variant="secondary" className="text-xs">
                    {CATEGORIES.find(c => c.value === article.category)?.label || article.category}
                  </Badge>
                  {!article.is_active && (
                    <Badge variant="outline" className="text-xs">Inativo</Badge>
                  )}
                </div>
                {article.keywords && article.keywords.length > 0 && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Tag className="h-3 w-3" />
                    <span className="truncate">{article.keywords.slice(0, 3).join(", ")}</span>
                    {article.keywords.length > 3 && (
                      <span>+{article.keywords.length - 3}</span>
                    )}
                  </div>
                )}
                <p className="text-xs text-muted-foreground mt-2">
                  Atualizado: {format(new Date(article.updated_at), "dd/MM/yyyy", { locale: ptBR })}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingArticle ? "Editar Artigo" : "Novo Artigo"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Título</Label>
              <Input
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="Ex: Como limpar cache do navegador"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Categoria</Label>
                <Select value={formCategory} onValueChange={setFormCategory}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(cat => (
                      <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Palavras-chave</Label>
                <Input
                  value={formKeywords}
                  onChange={(e) => setFormKeywords(e.target.value)}
                  placeholder="cache, limpar, navegador"
                />
                <p className="text-xs text-muted-foreground">Separadas por vírgula</p>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Conteúdo</Label>
              <Textarea
                value={formContent}
                onChange={(e) => setFormContent(e.target.value)}
                placeholder="Instruções detalhadas..."
                rows={10}
              />
              <p className="text-xs text-muted-foreground">
                Use **texto** para negrito e listas numeradas (1. 2. 3.)
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={formActive}
                onCheckedChange={setFormActive}
              />
              <Label>Artigo ativo</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
