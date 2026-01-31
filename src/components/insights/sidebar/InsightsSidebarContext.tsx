import { createContext, useContext, useState, ReactNode } from "react";

interface InsightsSidebarContextType {
  isCollapsed: boolean;
  toggleCollapsed: () => void;
  setCollapsed: (collapsed: boolean) => void;
}

const InsightsSidebarContext = createContext<InsightsSidebarContextType | null>(null);

export function InsightsSidebarProvider({ children }: { children: ReactNode }) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const toggleCollapsed = () => setIsCollapsed((prev) => !prev);
  const setCollapsed = (collapsed: boolean) => setIsCollapsed(collapsed);

  return (
    <InsightsSidebarContext.Provider value={{ isCollapsed, toggleCollapsed, setCollapsed }}>
      {children}
    </InsightsSidebarContext.Provider>
  );
}

export function useInsightsSidebar() {
  const context = useContext(InsightsSidebarContext);
  if (!context) {
    throw new Error("useInsightsSidebar must be used within InsightsSidebarProvider");
  }
  return context;
}
