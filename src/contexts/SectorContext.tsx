import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { SectorId, Sector, sectors, getSectorById, getSectorByRoute } from "@/config/sectors";

interface SectorContextType {
  currentSector: Sector | null;
  setCurrentSector: (sectorId: SectorId | null) => void;
  clearSector: () => void;
}

const SectorContext = createContext<SectorContextType | undefined>(undefined);

export function SectorProvider({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [currentSectorId, setCurrentSectorId] = useState<SectorId | null>(() => {
    const saved = localStorage.getItem("current_sector");
    return saved as SectorId | null;
  });

  const currentSector = currentSectorId ? getSectorById(currentSectorId) || null : null;

  // Auto-detect sector based on current route
  useEffect(() => {
    // Don't auto-detect if we're on sectors page
    if (location.pathname === "/setores") {
      return;
    }

    // Try to detect sector from route
    const detectedSector = getSectorByRoute(location.pathname);
    if (detectedSector && detectedSector.id !== currentSectorId) {
      setCurrentSectorId(detectedSector.id);
      localStorage.setItem("current_sector", detectedSector.id);
    }
  }, [location.pathname, currentSectorId]);

  const setCurrentSector = (sectorId: SectorId | null) => {
    setCurrentSectorId(sectorId);
    if (sectorId) {
      localStorage.setItem("current_sector", sectorId);
    } else {
      localStorage.removeItem("current_sector");
    }
  };

  const clearSector = () => {
    setCurrentSectorId(null);
    localStorage.removeItem("current_sector");
  };

  return (
    <SectorContext.Provider value={{ currentSector, setCurrentSector, clearSector }}>
      {children}
    </SectorContext.Provider>
  );
}

export function useSector() {
  const context = useContext(SectorContext);
  if (context === undefined) {
    throw new Error("useSector must be used within a SectorProvider");
  }
  return context;
}
