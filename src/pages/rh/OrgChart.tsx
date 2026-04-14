import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Network, Users } from "lucide-react";

interface Collaborator {
  id: string;
  full_name: string;
  department: string | null;
  position: string | null;
  avatar_url: string | null;
}

interface DepartmentGroup {
  name: string;
  collaborators: Collaborator[];
}

const DEPARTMENT_COLORS: Record<string, string> = {
  Comercial: "bg-blue-500/15 text-blue-700 border-blue-300 dark:text-blue-300 dark:border-blue-700",
  CS: "bg-emerald-500/15 text-emerald-700 border-emerald-300 dark:text-emerald-300 dark:border-emerald-700",
  Marketing: "bg-pink-500/15 text-pink-700 border-pink-300 dark:text-pink-300 dark:border-pink-700",
  Operações: "bg-amber-500/15 text-amber-700 border-amber-300 dark:text-amber-300 dark:border-amber-700",
  Financeiro: "bg-violet-500/15 text-violet-700 border-violet-300 dark:text-violet-300 dark:border-violet-700",
  Administrativo: "bg-slate-500/15 text-slate-700 border-slate-300 dark:text-slate-300 dark:border-slate-700",
};

const DEPARTMENT_HEADER_COLORS: Record<string, string> = {
  Comercial: "from-blue-500 to-blue-600",
  CS: "from-emerald-500 to-emerald-600",
  Marketing: "from-pink-500 to-pink-600",
  Operações: "from-amber-500 to-amber-600",
  Financeiro: "from-violet-500 to-violet-600",
  Administrativo: "from-slate-500 to-slate-600",
};

const DEPARTMENT_ORDER = ["Comercial", "CS", "Marketing", "Operações", "Financeiro", "Administrativo"];

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

export default function OrgChart() {
  const navigate = useNavigate();
  const [departments, setDepartments] = useState<DepartmentGroup[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const { data } = await supabase
      .from("hr_collaborators")
      .select("id, full_name, department, position, avatar_url")
      .eq("status", "active")
      .order("full_name");

    if (!data) {
      setLoading(false);
      return;
    }

    const grouped = new Map<string, Collaborator[]>();
    for (const c of data) {
      const dept = c.department || "Sem departamento";
      if (!grouped.has(dept)) grouped.set(dept, []);
      grouped.get(dept)!.push(c);
    }

    // Sort: heads first in each department
    for (const [, members] of grouped) {
      members.sort((a, b) => {
        const aHead = a.position?.toLowerCase().includes("head") || a.position?.toLowerCase().includes("admin") ? 0 : 1;
        const bHead = b.position?.toLowerCase().includes("head") || b.position?.toLowerCase().includes("admin") ? 0 : 1;
        if (aHead !== bHead) return aHead - bHead;
        return a.full_name.localeCompare(b.full_name);
      });
    }

    const sorted = Array.from(grouped.entries()).sort(([a], [b]) => {
      const ai = DEPARTMENT_ORDER.indexOf(a);
      const bi = DEPARTMENT_ORDER.indexOf(b);
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
    });

    setDepartments(sorted.map(([name, collaborators]) => ({ name, collaborators })));
    setLoading(false);
  }

  const totalCollaborators = departments.reduce((sum, d) => sum + d.collaborators.length, 0);

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/rh")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center">
            <Network className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Organograma</h1>
            <p className="text-sm text-muted-foreground">
              {totalCollaborators} colaboradores em {departments.length} departamentos
            </p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="h-64 animate-pulse bg-muted/50" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {departments.map((dept) => {
            const headerColor = DEPARTMENT_HEADER_COLORS[dept.name] || "from-gray-500 to-gray-600";
            const badgeColor = DEPARTMENT_COLORS[dept.name] || "bg-gray-500/15 text-gray-700 border-gray-300";

            return (
              <Card key={dept.name} className="overflow-hidden border-0 shadow-md">
                {/* Department header */}
                <div className={`bg-gradient-to-r ${headerColor} px-5 py-4`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-white/80" />
                      <h2 className="text-base font-semibold text-white">{dept.name}</h2>
                    </div>
                    <Badge variant="secondary" className="bg-white/20 text-white border-0 text-xs">
                      {dept.collaborators.length}
                    </Badge>
                  </div>
                </div>

                {/* Members */}
                <div className="p-3 space-y-1">
                  {dept.collaborators.map((c) => {
                    const isHead = c.position?.toLowerCase().includes("head") || c.position?.toLowerCase().includes("admin");

                    return (
                      <button
                        key={c.id}
                        onClick={() => navigate(`/rh/collaborators/${c.id}`)}
                        className={`w-full flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-muted/80 text-left ${
                          isHead ? "bg-muted/40" : ""
                        }`}
                      >
                        <Avatar className={isHead ? "h-10 w-10 ring-2 ring-offset-2 ring-offset-background ring-primary/30" : "h-9 w-9"}>
                          <AvatarImage src={c.avatar_url || undefined} alt={c.full_name} />
                          <AvatarFallback className={`text-xs font-medium ${isHead ? "bg-primary/10 text-primary" : "bg-muted"}`}>
                            {getInitials(c.full_name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm truncate ${isHead ? "font-semibold text-foreground" : "font-medium text-foreground"}`}>
                            {c.full_name}
                          </p>
                          {c.position && (
                            <Badge variant="outline" className={`mt-0.5 text-[10px] px-1.5 py-0 h-4 font-normal ${badgeColor}`}>
                              {c.position}
                            </Badge>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
