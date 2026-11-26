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
import {
  Loader2,
  Plus,
  ShieldAlert,
  ArrowUp,
  ArrowDown,
  Pencil,
  Check,
  X,
  Trash2,
  AlertTriangle,
  ArrowRight,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  NO_USAGE,
  canConfirmDelete,
  cleanAreaName,
  describeUsage,
  findNameConflict,
  usageTotal,
  validateAreaName,
  type AreaUsage,
  type DeleteMode,
} from "@/lib/practiceAreas/changeImpact";
import { usePagedList } from "@/hooks/usePagedList";
import { PagerFor } from "@/components/ui/list-pagination";

interface PracticeAreaRow {
  id: string;
  label: string;
  slug: string;
  sort_order: number;
  active: boolean;
}

interface UsageRow {
  area_key: string;
  label: string;
  area_id: string | null;
  clients_count: number;
  leads_count: number;
}

interface OrphanLabel {
  label: string;
  usage: AreaUsage;
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
  // Confirmações: troca de nome, exclusão e nome fora da lista oficial.
  const [renameTarget, setRenameTarget] = useState<{ row: PracticeAreaRow; label: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PracticeAreaRow | null>(null);
  const [deleteMode, setDeleteMode] = useState<DeleteMode | null>(null);
  const [moveToId, setMoveToId] = useState<string | null>(null);
  const [orphanTarget, setOrphanTarget] = useState<OrphanLabel | null>(null);

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

  // Quantas fichas (clientes e leads) usam cada nome hoje.
  const { data: usageRows } = useQuery({
    queryKey: ["practice-areas-usage"],
    enabled: canManage,
    queryFn: async (): Promise<UsageRow[]> => {
      const { data, error } = await (supabase as any).rpc("practice_areas_usage");
      if (error) throw error;
      return (data ?? []) as UsageRow[];
    },
  });

  const usageOf = (areaId: string): AreaUsage => {
    const hit = usageRows?.find((u) => u.area_id === areaId);
    return hit ? { clients: hit.clients_count, leads: hit.leads_count } : NO_USAGE;
  };

  const orphans: OrphanLabel[] = (usageRows ?? [])
    .filter((u) => !u.area_id)
    .map((u) => ({ label: u.label, usage: { clients: u.clients_count, leads: u.leads_count } }))
    .sort((a, b) => usageTotal(b.usage) - usageTotal(a.usage));

  const sortedRows = (rows ?? []).slice().sort((a, b) => a.sort_order - b.sort_order);
  const pg = usePagedList(sortedRows, { isLoading });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["practice-areas"] });
    qc.invalidateQueries({ queryKey: ["practice-areas", "admin"] });
    qc.invalidateQueries({ queryKey: ["practice-areas-usage"] });
  };

  // Fichas mudaram: listas, filtros e gráficos de clientes precisam recarregar.
  const invalidateEverything = () => {
    qc.invalidateQueries();
  };

  const changedText = (res: any) =>
    describeUsage({ clients: Number(res?.clients ?? 0), leads: Number(res?.leads ?? 0) });

  const addMut = useMutation({
    mutationFn: async (label: string) => {
      const trimmed = cleanAreaName(label);
      const invalid = validateAreaName(trimmed);
      if (invalid) throw new Error(invalid);
      const clash = findNameConflict(rows ?? [], null, trimmed);
      if (clash) throw new Error(`Já existe a área "${clash.label}"`);
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

  // Troca o nome na lista e em todas as fichas que usam a área (feito no banco, tudo ou nada).
  const renameMut = useMutation({
    mutationFn: async ({ row, label }: { row: PracticeAreaRow; label: string }) => {
      const { data, error } = await (supabase as any).rpc("rename_practice_area", {
        _area_id: row.id,
        _new_label: cleanAreaName(label),
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (res) => {
      const changed = changedText(res);
      toast.success(changed ? `Nome atualizado em ${changed}` : "Nome atualizado");
      setRenameTarget(null);
      setEditingId(null);
      invalidateEverything();
    },
    onError: (e: any) => toast.error(e.message ?? "Falha ao renomear"),
  });

  const deleteMut = useMutation({
    mutationFn: async ({
      row,
      moveTo,
      remove,
    }: {
      row: PracticeAreaRow;
      moveTo: string | null;
      remove: boolean;
    }) => {
      const { data, error } = await (supabase as any).rpc("delete_practice_area", {
        _area_id: row.id,
        _move_to: moveTo,
        _remove_from_records: remove,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (res) => {
      const changed = changedText(res);
      if (changed && res?.moved_to) toast.success(`Área excluída. ${changed} agora em "${res.moved_to}"`);
      else if (changed) toast.success(`Área excluída e retirada de ${changed}`);
      else toast.success("Área excluída");
      closeDelete();
      setRenameTarget(null);
      setEditingId(null);
      invalidateEverything();
    },
    onError: (e: any) => toast.error(e.message ?? "Falha ao excluir"),
  });

  const moveOrphanMut = useMutation({
    mutationFn: async ({ label, moveTo }: { label: string; moveTo: string }) => {
      const { data, error } = await (supabase as any).rpc("move_practice_area_label", {
        _from_label: label,
        _move_to: moveTo,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (res) => {
      const changed = changedText(res);
      toast.success(changed ? `${changed} agora em "${res?.moved_to}"` : "Nada para mover");
      setOrphanTarget(null);
      setMoveToId(null);
      invalidateEverything();
    },
    onError: (e: any) => toast.error(e.message ?? "Falha ao mover"),
  });

  const closeDelete = () => {
    setDeleteTarget(null);
    setDeleteMode(null);
    setMoveToId(null);
  };

  const openDelete = (row: PracticeAreaRow) => {
    setDeleteMode(null);
    setMoveToId(null);
    setDeleteTarget(row);
  };

  // Antes de salvar o nome, mostra o que vai mudar.
  const askRename = (row: PracticeAreaRow, label: string) => {
    const cleaned = cleanAreaName(label);
    const invalid = validateAreaName(cleaned);
    if (invalid) {
      toast.error(invalid);
      return;
    }
    if (cleaned === row.label) {
      setEditingId(null);
      return;
    }
    setRenameTarget({ row, label: cleaned });
  };

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
            <Table className="min-w-[760px] table-fixed">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[11%]">Ordem</TableHead>
                  <TableHead className="w-[30%]">Nome</TableHead>
                  <TableHead className="w-[17%]">Slug</TableHead>
                  <TableHead className="w-[15%]">Em uso</TableHead>
                  <TableHead className="w-[10%]">Status</TableHead>
                  <TableHead className="w-[17%] text-right">Ações</TableHead>
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
                            askRename(row, editLabel);
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
                    <TableCell className="text-sm text-muted-foreground">
                      {usageRows ? (describeUsage(usageOf(row.id)) ?? "Nenhuma ficha") : "…"}
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
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label={`Excluir ${row.label}`}
                          onClick={() => openDelete(row)}
                        >
                          <Trash2 className="h-4 w-4" />
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
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-6">
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

      {orphans.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Nomes fora da lista oficial</CardTitle>
            <p className="text-sm text-muted-foreground">
              Estão escritos em fichas, mas não existem na lista acima. Mova para a área certa ou
              torne o nome oficial.
            </p>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-border">
              {orphans.map((o) => (
                <li
                  key={o.label}
                  className="flex flex-wrap items-center justify-between gap-2 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{o.label}</p>
                    <p className="text-xs text-muted-foreground">{describeUsage(o.usage)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setMoveToId(null);
                        setOrphanTarget(o);
                      }}
                    >
                      Mover para área oficial
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={addMut.isPending || !!validateAreaName(o.label)}
                      onClick={() => addMut.mutate(o.label)}
                    >
                      Tornar oficial
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Confirmação da troca de nome */}
      <Dialog open={!!renameTarget} onOpenChange={(o) => !o && !renameMut.isPending && setRenameTarget(null)}>
        <DialogContent className="sm:max-w-lg">
          {renameTarget &&
            (() => {
              const usage = usageOf(renameTarget.row.id);
              const used = describeUsage(usage);
              const clash = findNameConflict(rows ?? [], renameTarget.row.id, renameTarget.label);
              return (
                <>
                  <DialogHeader>
                    <DialogTitle>Trocar o nome da área</DialogTitle>
                    <DialogDescription className="flex flex-wrap items-center gap-2 pt-1">
                      <Badge variant="secondary">{renameTarget.row.label}</Badge>
                      <ArrowRight className="h-4 w-4" />
                      <Badge>{renameTarget.label}</Badge>
                    </DialogDescription>
                  </DialogHeader>

                  {clash ? (
                    <div className="space-y-2 rounded-md border border-warning/40 bg-warning/10 p-3 text-sm">
                      <p className="flex items-center gap-2 font-medium">
                        <AlertTriangle className="h-4 w-4 text-warning" />
                        Já existe a área "{clash.label}"
                      </p>
                      <p className="text-muted-foreground">
                        Dois nomes iguais não podem ficar na lista. Se as duas são a mesma coisa, junte:
                        {used ? ` ${used} passam para "${clash.label}" e ` : " "}
                        "{renameTarget.row.label}" sai da lista.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2 text-sm">
                      <p className="font-medium">O que vai mudar:</p>
                      <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
                        <li>
                          A lista de opções de área em todo o sistema (ficha do cliente, contratos e
                          perfil do negócio).
                        </li>
                        <li>
                          {used
                            ? `${used} que hoje têm "${renameTarget.row.label}" passam a mostrar "${renameTarget.label}".`
                            : "Nenhuma ficha usa esta área hoje, então só a lista muda."}
                        </li>
                        <li>
                          Filtros, gráfico de clientes por área e exportações passam a usar o novo nome.
                        </li>
                        {usage.clients > 0 && (
                          <li>
                            A integração com a Clínica Ryka é avisada da atualização dessas fichas, como
                            em qualquer edição de cliente.
                          </li>
                        )}
                      </ul>
                      <p className="text-xs text-muted-foreground">
                        A troca é feita de uma vez só e fica registrada no histórico.
                      </p>
                    </div>
                  )}

                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => setRenameTarget(null)}
                      disabled={renameMut.isPending || deleteMut.isPending}
                    >
                      Cancelar
                    </Button>
                    {clash ? (
                      <Button
                        disabled={deleteMut.isPending}
                        onClick={() =>
                          deleteMut.mutate({ row: renameTarget.row, moveTo: clash.id, remove: false })
                        }
                      >
                        {deleteMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                        Juntar com "{clash.label}"
                      </Button>
                    ) : (
                      <Button disabled={renameMut.isPending} onClick={() => renameMut.mutate(renameTarget)}>
                        {renameMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                        Trocar o nome
                      </Button>
                    )}
                  </DialogFooter>
                </>
              );
            })()}
        </DialogContent>
      </Dialog>

      {/* Confirmação da exclusão */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && !deleteMut.isPending && closeDelete()}>
        <DialogContent className="sm:max-w-lg">
          {deleteTarget &&
            (() => {
              const usage = usageOf(deleteTarget.id);
              const used = describeUsage(usage);
              const others = sortedRows.filter((r) => r.id !== deleteTarget.id);
              return (
                <>
                  <DialogHeader>
                    <DialogTitle>Excluir a área "{deleteTarget.label}"</DialogTitle>
                    <DialogDescription>
                      {used
                        ? `Esta área está em ${used}. Escolha o que fazer com elas antes de excluir.`
                        : "Nenhuma ficha usa esta área. Ela só sai da lista de opções."}
                    </DialogDescription>
                  </DialogHeader>

                  {used && (
                    <RadioGroup
                      value={deleteMode ?? ""}
                      onValueChange={(v) => setDeleteMode(v as DeleteMode)}
                      className="space-y-2"
                    >
                      <div className="rounded-md border p-3">
                        <div className="flex items-center gap-2">
                          <RadioGroupItem value="move" id="del-move" />
                          <Label htmlFor="del-move" className="font-medium">
                            Mover as fichas para outra área
                          </Label>
                        </div>
                        {deleteMode === "move" && (
                          <div className="pl-6 pt-2">
                            <Select value={moveToId ?? ""} onValueChange={setMoveToId}>
                              <SelectTrigger aria-label="Área que recebe as fichas">
                                <SelectValue placeholder="Escolha a área" />
                              </SelectTrigger>
                              <SelectContent>
                                {others.map((r) => (
                                  <SelectItem key={r.id} value={r.id}>
                                    {r.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                      </div>
                      <div className="rounded-md border p-3">
                        <div className="flex items-center gap-2">
                          <RadioGroupItem value="remove" id="del-remove" />
                          <Label htmlFor="del-remove" className="font-medium">
                            Só tirar esta área das fichas
                          </Label>
                        </div>
                        <p className="pl-6 pt-1 text-xs text-muted-foreground">
                          As outras áreas de cada ficha continuam. Quem só tinha esta fica sem área
                          informada.
                        </p>
                      </div>
                    </RadioGroup>
                  )}

                  <p className="text-xs text-muted-foreground">
                    Só o nome está errado?{" "}
                    <button
                      type="button"
                      className="font-medium text-primary underline-offset-2 hover:underline"
                      onClick={() => {
                        const row = deleteTarget;
                        closeDelete();
                        startEdit(row);
                      }}
                    >
                      Editar o nome
                    </button>{" "}
                    mantém tudo ligado e corrige as fichas.
                  </p>

                  <DialogFooter>
                    <Button variant="outline" onClick={closeDelete} disabled={deleteMut.isPending}>
                      Cancelar
                    </Button>
                    <Button
                      variant="destructive"
                      disabled={deleteMut.isPending || !canConfirmDelete(usage, deleteMode, moveToId)}
                      onClick={() =>
                        deleteMut.mutate({
                          row: deleteTarget,
                          moveTo: deleteMode === "move" ? moveToId : null,
                          remove: deleteMode === "remove",
                        })
                      }
                    >
                      {deleteMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                      Excluir área
                    </Button>
                  </DialogFooter>
                </>
              );
            })()}
        </DialogContent>
      </Dialog>

      {/* Mover um nome fora da lista para uma área oficial */}
      <Dialog
        open={!!orphanTarget}
        onOpenChange={(o) => {
          if (o || moveOrphanMut.isPending) return;
          setOrphanTarget(null);
          setMoveToId(null);
        }}
      >
        <DialogContent className="sm:max-w-lg">
          {orphanTarget && (
            <>
              <DialogHeader>
                <DialogTitle>Mover "{orphanTarget.label}"</DialogTitle>
                <DialogDescription>
                  {describeUsage(orphanTarget.usage)} com esse nome passam a mostrar a área escolhida.
                </DialogDescription>
              </DialogHeader>
              <Select value={moveToId ?? ""} onValueChange={setMoveToId}>
                <SelectTrigger aria-label="Área oficial de destino">
                  <SelectValue placeholder="Escolha a área oficial" />
                </SelectTrigger>
                <SelectContent>
                  {sortedRows.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <DialogFooter>
                <Button
                  variant="outline"
                  disabled={moveOrphanMut.isPending}
                  onClick={() => {
                    setOrphanTarget(null);
                    setMoveToId(null);
                  }}
                >
                  Cancelar
                </Button>
                <Button
                  disabled={!moveToId || moveOrphanMut.isPending}
                  onClick={() =>
                    moveToId && moveOrphanMut.mutate({ label: orphanTarget.label, moveTo: moveToId })
                  }
                >
                  {moveOrphanMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  Mover fichas
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
