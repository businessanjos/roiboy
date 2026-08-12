import { lazy } from "react";
import { FolderKanban, ClipboardList, Sparkles } from "lucide-react";
import { MarketingTabsHub, type MarketingHubTab } from "@/components/marketing/_shared/MarketingTabsHub";

const MarketingProjects = lazy(() => import("@/pages/marketing/MarketingProjects"));
const MarketingTasks = lazy(() => import("@/pages/MarketingTasks"));
const Rebranding = lazy(() => import("@/pages/marketing/Rebranding"));

const TABS: MarketingHubTab[] = [
  { value: "projetos", label: "Projetos", icon: FolderKanban, Component: MarketingProjects },
  { value: "tarefas", label: "Tarefas", icon: ClipboardList, Component: MarketingTasks },
  { value: "rebranding", label: "Rebranding", icon: Sparkles, Component: Rebranding },
];

export default function MarketingProjectsHub() {
  return <MarketingTabsHub tabs={TABS} />;
}
