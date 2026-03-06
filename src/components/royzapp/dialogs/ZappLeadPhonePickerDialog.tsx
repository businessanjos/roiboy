import { memo } from "react";
import { Phone } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface PhoneOption {
  phone: string;
  label?: string;
  isPrimary?: boolean;
}

interface ZappLeadPhonePickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadName: string;
  phones: PhoneOption[];
  onSelectPhone: (phone: string) => void;
}

export const ZappLeadPhonePickerDialog = memo(function ZappLeadPhonePickerDialog({
  open,
  onOpenChange,
  leadName,
  phones,
  onSelectPhone,
}: ZappLeadPhonePickerDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#2a3942] border-[#3b4a54] text-[#e9edef] max-w-xs">
        <DialogHeader>
          <DialogTitle className="text-base">Selecione o número</DialogTitle>
          <DialogDescription className="text-[#8696a0] text-sm">
            {leadName}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5 py-2">
          {phones.map((item, idx) => (
            <button
              key={item.phone}
              onClick={() => {
                onSelectPhone(item.phone);
                onOpenChange(false);
              }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-[#202c33] transition-colors text-left"
            >
              <Phone className="h-4 w-4 text-emerald-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <span className="text-[#e9edef] text-sm">{item.phone}</span>
                {item.isPrimary && (
                  <span className="text-[#8696a0] text-xs ml-2">(Principal)</span>
                )}
                {item.label && !item.isPrimary && (
                  <span className="text-[#8696a0] text-xs ml-2">({item.label})</span>
                )}
              </div>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
});
