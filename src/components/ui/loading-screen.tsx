import royLogo from "@/assets/roy-logo.png";

interface LoadingScreenProps {
  message?: string;
  fullScreen?: boolean;
}

export function LoadingScreen({ message = "Carregando...", fullScreen = true }: LoadingScreenProps) {
  return (
    <div 
      className={`flex flex-col items-center justify-center gap-4 ${
        fullScreen ? "fixed inset-0 bg-background z-50" : "py-12"
      }`}
    >
      {/* Logo with pulse animation */}
      <div className="relative">
        {/* Glow effect */}
        <div className="absolute inset-0 animate-ping opacity-20">
          <img 
            src={royLogo} 
            alt="" 
            className="h-16 w-16 object-contain blur-sm"
          />
        </div>
        
        {/* Main logo with pulse */}
        <img 
          src={royLogo} 
          alt="Roy Logo" 
          className="h-16 w-16 object-contain animate-pulse"
        />
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

export function LoadingSpinner({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center ${className}`}>
      <img 
        src={royLogo} 
        alt="Carregando" 
        className="h-8 w-8 object-contain animate-pulse"
      />
    </div>
  );
}
