import { forwardRef } from "react";
import { RoyLogo } from "@/components/ui/roy-logo";

interface LoadingScreenProps {
  message?: string;
  fullScreen?: boolean;
}

export const LoadingScreen = forwardRef<HTMLDivElement, LoadingScreenProps>(
  function LoadingScreen({ message = "Carregando...", fullScreen = true }, ref) {
    return (
      <div 
        ref={ref}
        className={`flex flex-col items-center justify-center gap-4 ${
          fullScreen ? "fixed inset-0 bg-background z-50" : "py-12"
        }`}
      >
        {/* Logo with pulse animation */}
        <div className="relative">
          {/* Glow effect */}
          <div className="absolute inset-0 animate-ping opacity-20">
            <RoyLogo size="xl" className="blur-sm" />
          </div>
          
          {/* Main logo with pulse */}
          <RoyLogo size="xl" className="animate-pulse" />
        </div>
        
        {/* Loading dots animation */}
        <div className="flex items-center gap-1">
          <span className="text-sm text-muted-foreground">{message}</span>
          <span className="flex gap-0.5">
            <span className="h-1 w-1 rounded-full bg-primary animate-bounce" style={{ animationDelay: "0ms" }} />
            <span className="h-1 w-1 rounded-full bg-primary animate-bounce" style={{ animationDelay: "150ms" }} />
            <span className="h-1 w-1 rounded-full bg-primary animate-bounce" style={{ animationDelay: "300ms" }} />
          </span>
        </div>
      </div>
    );
  }
);

export function LoadingSpinner({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center ${className}`}>
      <RoyLogo size="md" className="animate-pulse" />
    </div>
  );
}
