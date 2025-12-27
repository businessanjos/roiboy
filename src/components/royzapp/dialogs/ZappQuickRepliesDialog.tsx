import { memo } from "react";
import { Plus, Pencil, Trash2, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface QuickReply {
  id: string;
  title: string;
  content: string;
}

interface ZappQuickRepliesDialogProps {
  // Main list dialog
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quickReplies: QuickReply[];
  onUseReply: (reply: QuickReply) => void;
  onEditReply: (reply: QuickReply) => void;
  onDeleteReply: (id: string) => void;
  onCreateNew: () => void;
  // Edit dialog
  editDialogOpen: boolean;
  onEditDialogChange: (open: boolean) => void;
  editingReply: QuickReply | null;
  form: { title: string; content: string };
  onFormChange: (form: { title: string; content: string }) => void;
  onSave: () => void;
  saving: boolean;
}

export const ZappQuickRepliesDialog = memo(function ZappQuickRepliesDialog({
  open,
  onOpenChange,
  quickReplies,
  onUseReply,
  onEditReply,
  onDeleteReply,
  onCreateNew,
  editDialogOpen,
  onEditDialogChange,
  editingReply,
  form,
  onFormChange,
  onSave,
  saving,
}: ZappQuickRepliesDialogProps) {
  return (
    <>
      {/* Main Quick Replies List */}
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="bg-[#2a3942] border-[#3b4a54] text-[#e9edef] max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>Respostas Rápidas</span>
              <Button
                size="sm"
                onClick={onCreateNew}
                className="bg-[#00a884] hover:bg-[#00a884]/90"
              >
                <Plus className="h-4 w-4 mr-1" />
                Nova
              </Button>
            </DialogTitle>
            <DialogDescription className="text-[#8696a0]">
              Clique para usar uma resposta ou gerencie suas respostas salvas
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-72">
            {quickReplies.length === 0 ? (
              <div className="text-center py-8">
                <Zap className="h-12 w-12 mx-auto text-[#8696a0] mb-3" />
                <p className="text-[#8696a0]">Nenhuma resposta rápida criada</p>
                <p className="text-[#8696a0] text-sm">Crie respostas para agilizar seu atendimento</p>
              </div>
            ) : (
              <div className="space-y-2">
                {quickReplies.map((reply) => (
                  <div
                    key={reply.id}
                    className="group flex items-start gap-2 p-3 rounded-lg hover:bg-[#202c33] transition-colors"
                  >
                    <button
                      onClick={() => onUseReply(reply)}
                      className="flex-1 text-left"
                    >
                      <p className="text-[#e9edef] font-medium">{reply.title}</p>
                      <p className="text-[#8696a0] text-sm line-clamp-2">{reply.content}</p>
                    </button>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-[#8696a0] hover:text-[#e9edef]"
                        onClick={() => onEditReply(reply)}
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-[#8696a0] hover:text-red-400"
                        onClick={() => onDeleteReply(reply.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Edit/Create Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={onEditDialogChange}>
        <DialogContent className="bg-[#2a3942] border-[#3b4a54] text-[#e9edef]">
          <DialogHeader>
            <DialogTitle>{editingReply ? "Editar Resposta" : "Nova Resposta Rápida"}</DialogTitle>
            <DialogDescription className="text-[#8696a0]">
              Crie atalhos para mensagens que você envia frequentemente
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="qr-title" className="text-[#8696a0]">Título</Label>
              <Input
                id="qr-title"
                value={form.title}
                onChange={(e) => onFormChange({ ...form, title: e.target.value })}
                placeholder="Ex: Saudação inicial"
                className="bg-[#202c33] border-[#3b4a54] text-[#e9edef]"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="qr-content" className="text-[#8696a0]">Conteúdo da mensagem</Label>
              <Textarea
                id="qr-content"
                value={form.content}
                onChange={(e) => onFormChange({ ...form, content: e.target.value })}
                placeholder="Olá! Como posso ajudá-lo hoje?"
                rows={4}
                className="bg-[#202c33] border-[#3b4a54] text-[#e9edef] font-mono text-sm"
              />
              <p className="text-xs text-[#8696a0]">
                Dica: Use *negrito*, _itálico_, ~tachado~ para formatação WhatsApp
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => onEditDialogChange(false)} className="border-[#3b4a54] text-[#8696a0]">
              Cancelar
            </Button>
            <Button onClick={onSave} disabled={saving} className="bg-[#00a884] hover:bg-[#00a884]/90">
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
});
