import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Save, Users, Briefcase, GraduationCap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { toast } from "sonner";

const CAREER_LEVELS = [
  "Anjo Vendedor",
  "Anjo Executivo",
  "Anjo Pro",
  "Anjo Elite",
  "Anjo Star",
  "Anjo Mestre",
  "Anjo Líder / Especialista",
  "Anjo Estrategista / Esp. Pro",
  "Anjo Visionário / Esp. Elite",
];

const AREAS = ["Comercial", "Operações", "CX", "CS", "Financeiro", "Marketing"];
const CARGOS = ["Vendedor", "Closer", "SDR", "BDR", "Assistente", "Analista", "Coordenador", "Gerente"];

// Nomes dos liderados do Jonathan no comercial
const SALES_TEAM_NAMES = ["everton", "jonathan", "vanessa", "darlan", "george"];

interface TeamMember {
  id: string;
  name: string;
  email: string;
  avatar_url: string | null;
}

interface CareerAssignment {
  user_id: string;
  contract_type: string;
  career_level_name: string;
  fixed_salary: number;
  area: string;
  cargo: string;
}

export function TeamCareerTab() {
  const { currentUser } = useCurrentUser();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [careers, setCareers] = useState<Record<string, CareerAssignment>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!currentUser?.account_id) return;
    loadData();
  }, [currentUser?.account_id]);

  const loadData = async () => {
    if (!currentUser?.account_id) return;
    setLoading(true);

    const [usersRes, careersRes] = await Promise.all([
      supabase
        .from("users")
        .select("id, name, email, avatar_url")
        .eq("account_id", currentUser.account_id)
        .neq("id", currentUser.id)
        .order("name"),
      supabase
        .from("sales_team_careers")
        .select("*")
        .eq("account_id", currentUser.account_id),
    ]);

    if (usersRes.data) {
      // Filter only Jonathan's sales team members
      const filtered = (usersRes.data as TeamMember[]).filter((u) =>
        SALES_TEAM_NAMES.some((name) => u.name.toLowerCase().includes(name))
      );
      setMembers(filtered);
    }

    if (careersRes.data) {
      const map: Record<string, CareerAssignment> = {};
      for (const c of careersRes.data) {
        map[c.user_id] = {
          user_id: c.user_id,
          contract_type: c.contract_type,
          career_level_name: c.career_level_name,
          fixed_salary: c.fixed_salary,
          area: (c as any).area || "Comercial",
          cargo: (c as any).cargo || "Vendedor",
        };
      }
      setCareers(map);
    }

    setLoading(false);
  };

  const updateCareer = (userId: string, field: string, value: string) => {
    setCareers((prev) => ({
      ...prev,
      [userId]: {
        user_id: userId,
        contract_type: prev[userId]?.contract_type || "CLT",
        career_level_name: prev[userId]?.career_level_name || "Anjo Vendedor",
        fixed_salary: prev[userId]?.fixed_salary || 0,
        area: prev[userId]?.area || "Comercial",
        cargo: prev[userId]?.cargo || "Vendedor",
        [field]: value,
      },
    }));
  };

  const handleSave = async () => {
    if (!currentUser?.account_id) return;
    setSaving(true);

    for (const member of members) {
      const career = careers[member.id];
      if (!career) continue;

      const { error } = await supabase
        .from("sales_team_careers")
        .upsert(
          {
            account_id: currentUser.account_id,
            user_id: member.id,
            contract_type: career.contract_type,
            career_level_name: career.career_level_name,
            fixed_salary: career.fixed_salary,
            area: career.area,
            cargo: career.cargo,
            updated_at: new Date().toISOString(),
          } as any,
          { onConflict: "account_id,user_id" }
        );

      if (error) {
        toast.error(`Erro ao salvar ${member.name}`);
        console.error(error);
      }
    }

    toast.success("Carreiras atualizadas!");
    setSaving(false);
  };

  const getInitials = (name: string) =>
    name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 bg-muted animate-pulse rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <GraduationCap className="h-4 w-4" />
            Carreira da Equipe Comercial
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Defina o regime, área, cargo e nível no plano de carreira de cada vendedor.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {members.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-10 w-10 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Nenhum membro da equipe encontrado.</p>
            </div>
          ) : (
            members.map((member) => {
              const career = careers[member.id];
              return (
                <div
                  key={member.id}
                  className="border rounded-lg p-4 space-y-3"
                >
                  {/* Row 1: Avatar + Name */}
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={member.avatar_url || undefined} />
                      <AvatarFallback className="text-xs">
                        {getInitials(member.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{member.name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {member.email}
                      </p>
                    </div>
                    <Badge variant="secondary" className="text-[10px] shrink-0">
                      {career?.contract_type || "CLT"} · {career?.area || "Comercial"}
                    </Badge>
                  </div>

                  {/* Row 2: Selectors */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] text-muted-foreground uppercase tracking-wide">
                        Regime
                      </label>
                      <Select
                        value={career?.contract_type || "CLT"}
                        onValueChange={(v) => updateCareer(member.id, "contract_type", v)}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="CLT">
                            <span className="flex items-center gap-1">
                              <Briefcase className="h-3 w-3" /> CLT
                            </span>
                          </SelectItem>
                          <SelectItem value="PJ">
                            <span className="flex items-center gap-1">
                              <Briefcase className="h-3 w-3" /> PJ
                            </span>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] text-muted-foreground uppercase tracking-wide">
                        Área
                      </label>
                      <Select
                        value={career?.area || "Comercial"}
                        onValueChange={(v) => updateCareer(member.id, "area", v)}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {AREAS.map((area) => (
                            <SelectItem key={area} value={area}>
                              {area}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] text-muted-foreground uppercase tracking-wide">
                        Cargo
                      </label>
                      <Select
                        value={career?.cargo || "Vendedor"}
                        onValueChange={(v) => updateCareer(member.id, "cargo", v)}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {CARGOS.map((cargo) => (
                            <SelectItem key={cargo} value={cargo}>
                              {cargo}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] text-muted-foreground uppercase tracking-wide">
                        Nível Carreira
                      </label>
                      <Select
                        value={career?.career_level_name || "Anjo Vendedor"}
                        onValueChange={(v) => updateCareer(member.id, "career_level_name", v)}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {CAREER_LEVELS.map((level) => (
                            <SelectItem key={level} value={level}>
                              {level}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      {members.length > 0 && (
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving} size="sm">
            <Save className="h-4 w-4 mr-2" />
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      )}
    </div>
  );
}
