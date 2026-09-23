import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  MoreVertical,
  Pencil,
  Trash2,
  Loader2,
  Star,
  Sparkles,
  ExternalLink,
  Brain,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { VideoCallSession } from "@/hooks/useVideoCallSessions";
import { CallLinkSelector, LinkedRecord } from "./CallLinkSelector";
import { SellerSelector, useAccountSellers } from "./SellerSelector";

interface VideoCallActionsProps {
  session: VideoCallSession;
  onChanged: () => void;
}

export function VideoCallActions({ session, onChanged }: VideoCallActionsProps) {
  const { sellers, loading: loadingSellers } = useAccountSellers();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [participantName, setParticipantName] = useState(session.participant_name ?? "");
  const [participantPhone, setParticipantPhone] = useState(session.participant_phone ?? "");
  const [notes, setNotes] = useState(session.notes ?? "");
  const [lead, setLead] = useState<LinkedRecord | null>(null);
  const [sellerId, setSellerId] = useState<string | null>(session.user_id ?? null);

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("video_call_sessions")
      .update({
        participant_name: participantName.trim() || null,
        participant_phone: participantPhone.trim() || null,
        notes: notes.trim() || null,
        ...(lead?.kind === "deal" ? { deal_id: lead.id } : {}),
        ...(lead?.kind === "lead" ? { lead_id: lead.id } : {}),

        ...(sellerId ? { user_id: sellerId } : {}),
      } as never)
      .eq("id", session.id);

    setSaving(false);

    if (error) {
      toast.error("Erro ao salvar", { description: error.message });
      return;
    }
    toast.success("Videochamada atualizada");
    setEditOpen(false);
    onChanged();
  };

  const handleDelete = async () => {
    setDeleting(true);
    const { data, error } = await supabase
      .from("video_call_sessions")
      .delete()
      .eq("id", session.id)
      .select("id");
    setDeleting(false);

    if (error) {
      toast.error("Erro ao excluir", { description: error.message });
      return;
    }
    if (!data || data.length === 0) {
      toast.error("Não foi possível excluir", {
        description: "Você não tem permissão para excluir esta videochamada.",
      });
      return;
    }
    toast.success("Videochamada excluída");
    setDeleteOpen(false);
    onChanged();
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
          <DropdownMenuItem onClick={() => setEditOpen(true)}>
            <Pencil className="h-4 w-4 mr-2" />
            Editar
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Excluir
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent
          className="sm:max-w-[500px]"
          onClick={(e) => e.stopPropagation()}
        >
          <DialogHeader>
            <DialogTitle>Editar videochamada</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Negócio vinculado</Label>
              <CallLinkSelector
                value={lead}
                onChange={(l) => {
                  setLead(l);
                  if (l?.name) setParticipantName(l.name);
                  if (l?.phone) setParticipantPhone(l.phone);
                  if (l?.responsible_user_id) setSellerId(l.responsible_user_id);
                }}
              />
            </div>

            <div className="space-y-2">
              <Label>Vendedor responsável</Label>
              <SellerSelector
                value={sellerId}
                onChange={setSellerId}
                sellers={sellers}
                loading={loadingSellers}
                className="w-full"
                placeholder="Selecionar quem conduziu a call"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="participant_name">Nome do participante</Label>
              <Input
                id="participant_name"
                value={participantName}
                onChange={(e) => setParticipantName(e.target.value)}
                placeholder="Ex: Maria Silva"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="participant_phone">Telefone</Label>
              <Input
                id="participant_phone"
                value={participantPhone}
                onChange={(e) => setParticipantPhone(e.target.value)}
                placeholder="Ex: 11 99999-9999"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Anotações</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Notas sobre a chamada"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent onClick={(e) => e.stopPropagation()}>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir videochamada?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. A videochamada
              {session.participant_name ? ` de "${session.participant_name}"` : ""} será
              removida permanentemente, incluindo gravação, transcrição e análise.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
