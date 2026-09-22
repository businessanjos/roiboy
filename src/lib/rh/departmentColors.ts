export const DEPARTMENT_COLOR_OPTIONS = [
  { value: "blue", label: "Azul", hsl: "hsl(217 91% 60%)" },
  { value: "emerald", label: "Verde", hsl: "hsl(152 55% 45%)" },
  { value: "amber", label: "Âmbar", hsl: "hsl(39 60% 55%)" },
  { value: "purple", label: "Roxo", hsl: "hsl(271 81% 56%)" },
  { value: "red", label: "Vermelho", hsl: "hsl(0 72% 51%)" },
  { value: "teal", label: "Teal", hsl: "hsl(172 66% 50%)" },
  { value: "pink", label: "Rosa", hsl: "hsl(330 81% 60%)" },
  { value: "indigo", label: "Índigo", hsl: "hsl(239 84% 67%)" },
  { value: "orange", label: "Laranja", hsl: "hsl(25 95% 53%)" },
  { value: "slate", label: "Cinza", hsl: "hsl(215 20% 65%)" },
];

export const getDepartmentColorHsl = (color: string | null | undefined) => {
  if (!color) return "hsl(215 20% 65%)";
  if (color.startsWith("hsl") || color.startsWith("#")) return color;
  return DEPARTMENT_COLOR_OPTIONS.find((c) => c.value === color)?.hsl || "hsl(215 20% 65%)";
};
