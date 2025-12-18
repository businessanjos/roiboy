export const MLS_LEVELS = [
  { value: "bronze", label: "Bronze", dotColor: "bg-amber-700" },
  { value: "prata", label: "Prata", dotColor: "bg-gray-400" },
  { value: "ouro", label: "Ouro", dotColor: "bg-yellow-500" },
  { value: "diamond", label: "Diamond", dotColor: "bg-cyan-400" },
  { value: "platinum", label: "Platinum", dotColor: "bg-slate-400" },
] as const;

export type MlsLevel = typeof MLS_LEVELS[number]["value"];

export const getMlsBadgeClasses = (level: string | null | undefined): string => {
  switch (level) {
    case "bronze":
      return "bg-gradient-to-r from-amber-700 to-amber-600 text-white";
    case "prata":
      return "bg-gradient-to-r from-gray-400 to-gray-300 text-gray-800";
    case "ouro":
      return "bg-gradient-to-r from-yellow-500 to-amber-400 text-white";
    case "diamond":
      return "bg-gradient-to-r from-cyan-400 to-blue-400 text-white";
    case "platinum":
      return "bg-gradient-to-r from-slate-400 to-slate-300 text-slate-800";
    default:
      return "bg-gradient-to-r from-amber-500 to-yellow-500 text-white";
  }
};

export const getMlsLevelLabel = (level: string | null | undefined): string => {
  const found = MLS_LEVELS.find(l => l.value === level);
  return found?.label || level || "";
};

export const getMlsDotColor = (level: string | null | undefined): string => {
  const found = MLS_LEVELS.find(l => l.value === level);
  return found?.dotColor || "bg-amber-500";
};
