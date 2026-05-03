import { Crown } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useVipClientIds } from "@/hooks/useVipClientIds";
import { cn } from "@/lib/utils";

interface VipBadgeProps {
  clientId: string | null | undefined;
  size?: "sm" | "md";
  className?: string;
}

/**
 * Renders a small crown icon when the given client is currently classified as VIP.
 * Returns null otherwise. Safe to drop next to any client name in the app.
 */
export function VipBadge({ clientId, size = "sm", className }: VipBadgeProps) {
  const { vipIds } = useVipClientIds();
  if (!clientId || !vipIds.has(clientId)) return null;

  const dim = size === "md" ? "h-4 w-4" : "h-3.5 w-3.5";

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn(
              "inline-flex items-center justify-center text-amber-500 shrink-0",
              className
            )}
            aria-label="Cliente VIP"
          >
            <Crown className={cn(dim, "fill-amber-400")} />
          </span>
        </TooltipTrigger>
        <TooltipContent>Cliente VIP</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
