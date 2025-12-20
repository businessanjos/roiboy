import { useImpersonation } from "@/hooks/useImpersonation";
import { Button } from "@/components/ui/button";
import { X, User, Building2 } from "lucide-react";

export function ImpersonationBanner() {
  const { isImpersonating, impersonatedUser, stopImpersonation } = useImpersonation();

  if (!isImpersonating || !impersonatedUser) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-amber-500 text-amber-950 px-4 py-2 flex items-center justify-between shadow-md">
      <div className="flex items-center gap-4">
        <span className="font-semibold">Modo Impersonação</span>
        <div className="flex items-center gap-2 text-sm">
          <User className="h-4 w-4" />
          <span>{impersonatedUser.name}</span>
          <span className="opacity-70">({impersonatedUser.email})</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Building2 className="h-4 w-4" />
          <span>{impersonatedUser.account_name}</span>
        </div>
        <span className="text-xs bg-amber-600/30 px-2 py-0.5 rounded">
          {impersonatedUser.role}
        </span>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={stopImpersonation}
        className="text-amber-950 hover:bg-amber-600/30 hover:text-amber-950"
      >
        <X className="h-4 w-4 mr-1" />
        Sair
      </Button>
    </div>
  );
}
