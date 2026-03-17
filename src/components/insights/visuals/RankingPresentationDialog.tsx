import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Monitor, Eye, EyeOff, User, ImageIcon } from "lucide-react";

export interface PresentationOptions {
  showNames: boolean;
  showPhotos: boolean;
  blurNumbers: boolean;
}

interface RankingPresentationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPresent: (options: PresentationOptions) => void;
}

export function RankingPresentationDialog({
  open,
  onOpenChange,
  onPresent,
}: RankingPresentationDialogProps) {
  const [showNames, setShowNames] = useState(true);
  const [showPhotos, setShowPhotos] = useState(true);
  const [blurNumbers, setBlurNumbers] = useState(false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Monitor className="h-5 w-5" />
            Modo Apresentação
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-4">
          <p className="text-sm text-muted-foreground">
            Configure o que será exibido na televisão:
          </p>

          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Checkbox
                id="showNames"
                checked={showNames}
                onCheckedChange={(v) => setShowNames(!!v)}
              />
              <Label htmlFor="showNames" className="flex items-center gap-2 cursor-pointer">
                <User className="h-4 w-4 text-muted-foreground" />
                Exibir nomes dos vendedores
              </Label>
            </div>

            <div className="flex items-center gap-3">
              <Checkbox
                id="showPhotos"
                checked={showPhotos}
                onCheckedChange={(v) => setShowPhotos(!!v)}
              />
              <Label htmlFor="showPhotos" className="flex items-center gap-2 cursor-pointer">
                <ImageIcon className="h-4 w-4 text-muted-foreground" />
                Exibir fotos dos vendedores
              </Label>
            </div>

            <div className="flex items-center gap-3">
              <Checkbox
                id="blurNumbers"
                checked={blurNumbers}
                onCheckedChange={(v) => setBlurNumbers(!!v)}
              />
              <Label htmlFor="blurNumbers" className="flex items-center gap-2 cursor-pointer">
                <EyeOff className="h-4 w-4 text-muted-foreground" />
                Ocultar valores (blur nos números)
              </Label>
            </div>
          </div>

          {blurNumbers && (
            <p className="text-xs text-muted-foreground bg-muted p-2 rounded-md">
              💡 Os números ficarão borrados para visitantes, mas o ranking e o visual continuam visíveis.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={() => onPresent({ showNames, showPhotos, blurNumbers })}>
            <Monitor className="h-4 w-4 mr-2" />
            Apresentar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
