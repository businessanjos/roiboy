import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useSectorAccess } from "@/hooks/useSectorAccess";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Plus, ShieldAlert, ArrowUp, ArrowDown, Pencil, Check, X } from "lucide-react";
import { usePagedList } from "@/hooks/usePagedList";
import { PagerFor } from "@/components/ui/list-pagination";

interface PracticeAreaRow {
  id: string;
  label: string;
  slug: string;
  sort_order: number;
  active: boolean;
}

function slugify(s: string) {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export default function PracticeAreasAdmin() {
  const { currentUser } = useCurrentUser();
  const { hasSectorAccess, isLoading: sectorsLoading } = useSectorAccess();
  const qc = useQueryClient();
  const [newLabel, setNewLabel] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");

  // Liberado para qualquer usuário com acesso ao setor de Customer Success.
  const canManage =
    currentUser?.role === "admin" ||
    (currentUser as any)?.is_also_admin === true ||
    hasSectorAccess("operacoes");


  const { data: rows, isLoading } = useQuery({
    queryKey: ["practice-areas", "admin"],
    queryFn: async (): Promise<PracticeAreaRow[]> => {
      const { data, error } = await supabase
        .from("practice_areas")
        .select("id,label,slug,sort_order,active")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as PracticeAreaRow[];
    },
  });

  const sortedRows = (rows ?? []).slice().sort((a, b) => a.sort_order - b.sort_order);
  const pg = usePagedList(sortedRows, { isLoading });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["practice-areas"] });
    qc.invalidateQueries({ queryKey: ["practice-areas", "admin"] });
  };

  const addMut = useMutation({
    mutationFn: async (label: string) => {
      const trimmed = label.trim();
      if (!trimmed) throw new Error("Informe um nome");
      const slug = slugify(trimmed);
      const nextOrder = (rows?.reduce((m, r) => Math.max(m, r.sort_order), 0) ?? 0) + 10;
      const { error } = await supabase.from("practice_areas").insert({
        label: trimmed,
        slug,
        sort_order: nextOrder,
        active: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Área adicionada");
      setNewLabel("");
      invalidate();
    },
    onError: (e: any) => toast.error(e.message ?? "Falha ao adicionar"),
  });

  // Troca só o nome exibido; o slug continua sendo a identidade da área.
  const renameMut = useMutation({
    mutationFn: async ({ row, label }: { row: PracticeAreaRow; label: string }) => {
      const trimmed = label.trim().replace(/\s+/g, " ");
      if (!trimmed) throw new Error("Informe um nome");
      if (trimmed === row.label) return;
      const { data, error } = await supabase
        .from("practice_areas")
        .update({ label: trimmed })
        .eq("id", row.id)
        .select("id");
      if (error) {
        if ((error as any).code === "23505") throw new Error("Já existe uma área com esse nome");
        throw error;
      }
      if (!data || data.length === 0) throw new Error("Você não tem permissão para editar esta área");
    },
    onSuccess: () => {
      toast.success("Nome atualizado");
      setEditingId(null);
      invalidate();
    },
    onError: (e: any) => toast.error(e.message ?? "Falha ao renomear"),
  });

  const startEdit = (row: PracticeAreaRow) => {
    setEditingId(row.id);
    setEditLabel(row.label);
  };

  const toggleMut = useMutation({
    mutationFn: async (row: PracticeAreaRow) => {
      const { error } = await supabase
        .from("practice_areas")
        .update({ active: !row.active })
        .eq("id", row.id);
      if (error) throw error;
    },
    onSuccess: () => invalidate(),
    onError: (e: any) => toast.error(e.message ?? "Falha ao atualizar"),
  });

  const moveMut = useMutation({
    mutationFn: async ({ row, dir }: { row: PracticeAreaRow; dir: -1 | 1 }) => {
      if (!rows) return;
      const sorted = [...rows].sort((a, b) => a.sort_order - b.sort_order);
      const idx = sorted.findIndex((r) => r.id === row.id);
      const swap = sorted[idx + dir];
      if (!swap) return;
      const { error: e1 } = await supabase
        .from("practice_areas")
        .update({ sort_order: swap.sort_order })
        .eq("id", row.id);
      if (e1) throw e1;
      const { error: e2 } = await supabase
        .from("practice_areas")
        .update({ sort_order: row.sort_order })
        .eq("id", swap.id);
      if (e2) throw e2;
    },
    onSuccess: () => invalidate(),
    onError: (e: any) => toast.error(e.message ?? "Falha ao reordenar"),
  });

  if (sectorsLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!canManage) {
    return (
      <div className="p-6 max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-warning" />
              Acesso restrito
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Somente administradores podem gerenciar as áreas de atuação.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="w-full p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Áreas de Atuação</h1>
        <p className="text-sm text-muted-foreground">
          Gerencie as opções disponíveis nos seletores de área de atuação em toda a plataforma.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Adicionar nova área</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="flex gap-2 items-end"
            onSubmit={(e) => {
              e.preventDefault();
              addMut.mutate(newLabel);
            }}
          >
            <div className="flex-1 space-y-1">
              <Label htmlFor="new-area">Nome</Label>
              <Input
                id="new-area"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="Ex.: Harmonização Facial"
              />
            </div>
            <Button type="submit" disabled={addMut.isPending || !newLabel.trim()}>
              {addMut.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Adicionar
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Áreas cadastradas</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Table className="min-w-[640px] table-fixed">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[12%]">Ordem</TableHead>
                  <TableHead className="w-[38%]">Nome</TableHead>
                  <TableHead className="w-[22%]">Slug</TableHead>
                  <TableHead className="w-[12%]">Status</TableHead>
                  <TableHead className="w-[16%] text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pg.items.map((row, pageIdx) => {
                  const i = pg.from + pageIdx;
                  const arr = sortedRows;
                  return (

                  <TableRow key={row.id}>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label={`Subir ${row.label}`}
                          disabled={i === 0 || moveMut.isPending}
                          onClick={() => moveMut.mutate({ row, dir: -1 })}
                        >
                          <ArrowUp className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label={`Descer ${row.label}`}
                          disabled={i === arr.length - 1 || moveMut.isPending}
                          onClick={() => moveMut.mutate({ row, dir: 1 })}
                        >
                          <ArrowDown className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">
                      {editingId === row.id ? (
                        <form
                          className="flex items-center gap-1"
                          onSubmit={(e) => {
                            e.preventDefault();
                            renameMut.mutate({ row, label: editLabel });
                          }}
                        >
                          <Input
                            autoFocus
                            value={editLabel}
                            onChange={(e) => setEditLabel(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Escape") setEditingId(null);
                            }}
                            aria-label={`Novo nome para ${row.label}`}
                            className="h-9"
                          />
                          <Button
                            type="submit"
                            size="icon"
                            variant="ghost"
                            aria-label="Salvar nome"
                            disabled={renameMut.isPending || !editLabel.trim()}
                          >
                            {renameMut.isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Check className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            aria-label="Cancelar edição"
                            onClick={() => setEditingId(null)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </form>
                      ) : (
                        <span className="block truncate">{row.label}</span>
                      )}
                    </TableCell>
                    <TableCell className="truncate font-mono text-xs text-muted-foreground">
                      {row.slug}
                    </TableCell>
                    <TableCell>
                      {row.active ? (
                        <Badge variant="default">Ativa</Badge>
                      ) : (
                        <Badge variant="secondary">Inativa</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label={`Editar nome de ${row.label}`}
                          onClick={() => startEdit(row)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Switch
                          aria-label={row.active ? `Desativar ${row.label}` : `Ativar ${row.label}`}
                          checked={row.active}
                          onCheckedChange={() => toggleMut.mutate(row)}
                          disabled={toggleMut.isPending}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                  );
                })}
                {rows && rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-6">
                      Nenhuma área cadastrada.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
          {!isLoading && <PagerFor state={pg} itemLabel="áreas" />}
        </CardContent>
      </Card>
    </div>
  );
}
