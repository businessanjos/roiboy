import { createContext, useContext, ReactNode } from "react";
import { useZappNavigation } from "@/hooks/useZappNavigation";

interface ZappNavigationOptions {
  phone?: string | null;
  leadId?: string;
  clientId?: string;
  name?: string;
  openInNewTab?: boolean;
}

interface ZappNavigationContextType {
  openZappConversation: (options: ZappNavigationOptions) => Promise<void>;
  loading: boolean;
}

const ZappNavigationContext = createContext<ZappNavigationContextType | null>(null);

export function ZappNavigationProvider({ children }: { children: ReactNode }) {
  const { openZappConversation, loading, PinDialog, InstanceSelectorDialog } = useZappNavigation();
  
  return (
    <ZappNavigationContext.Provider value={{ openZappConversation, loading }}>
      {children}
      {InstanceSelectorDialog}
      {PinDialog}
    </ZappNavigationContext.Provider>
  );
}

export function useZappNavigationContext() {
  const context = useContext(ZappNavigationContext);
  if (!context) {
    throw new Error("useZappNavigationContext must be used within ZappNavigationProvider");
  }
  return context;
}
