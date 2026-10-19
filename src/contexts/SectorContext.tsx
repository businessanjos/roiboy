import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { SectorId, Sector, getSectorById, getSectorByRoute, routeBelongsToSector } from "@/config/sectors";

interface SectorContextType {
  currentSector: Sector | null;
  setCurrentSector: (sectorId: SectorId | null) => void;
  clearSector: () => void;
}

const SectorContext = createContext<SectorContextType>({
  currentSector: null,
  setCurrentSector: () => {},
  clearSector: () => {},
});

export function SectorProvider({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [currentSectorId, setCurrentSectorId] = useState<SectorId | null>(() => {
    const saved = localStorage.getItem("current_sector") as SectorId | null;
    return saved && getSectorById(saved) ? saved : null;
  });

  const currentSector = currentSectorId ? getSectorById(currentSectorId) || null : null;

  // Auto-detect sector based on current route
  useEffect(() => {
    // Don't auto-detect if we're on sectors page
    if (["/setores", "/settings", "/notifications", "/tasks"].includes(location.pathname)) {
      return;
    }

    // If we have a current sector and the route belongs to it, keep it
    if (currentSectorId && routeBelongsToSector(location.pathname + location.search, currentSectorId)) {
      return;
    }

    // Try to detect sector from route
    const detectedSector = getSectorByRoute(location.pathname + location.search);
    if (detectedSector && detectedSector.id !== currentSectorId) {
      setCurrentSectorId(detectedSector.id);
      localStorage.setItem("current_sector", detectedSector.id);
    }
  }, [location.pathname, location.search, currentSectorId]);

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
  return useContext(SectorContext);
}
