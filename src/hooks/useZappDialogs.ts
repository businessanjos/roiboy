import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Agent, Department } from "@/components/royzapp";
import { sectors, SectorId } from "@/config/sectors";
import { withRetry } from "@/lib/retryFetch";

interface TeamUser {
  id: string;
  name: string;
  email: string;
  avatar_url: string | null;
  role: string;
  team_role_id: string | null;
  team_role?: {
    id: string;
    name: string;
    color: string;
  } | null;
}

const HEARTBEAT_INTERVAL_MS = 120000;

interface UseZappDialogsOptions {
  accountId?: string;
  userId?: string;
  sectorId?: SectorId;
}

export function useZappDialogs(options: UseZappDialogsOptions) {
  const { accountId, userId, sectorId } = options;

  const [departments, setDepartments] = useState<Department[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [teamUsers, setTeamUsers] = useState<TeamUser[]>([]);
  const [teamRoles, setTeamRoles] = useState<{ id: string; name: string; color: string }[]>([]);

  const agentHeartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastHeartbeatRef = useRef<number>(0);

  const currentAgent = useMemo(() => {
    return agents.find((a) => a.user_id === userId);
  }, [agents, userId]);

  const updateAgentHeartbeat = useCallback(async (agentId: string) => {
    const now = Date.now();
    if (now - lastHeartbeatRef.current < HEARTBEAT_INTERVAL_MS) return;
    lastHeartbeatRef.current = now;

    try {
      await supabase
        .from("zapp_agents")
        .update({ is_online: true, last_activity_at: new Date().toISOString() })
        .eq("id", agentId);
    } catch (error) {
      console.error("Error updating agent heartbeat:", error);
    }
  }, []);

  const fetchDialogData = useCallback(async (): Promise<{
    departments: Department[];
    targetDepartmentId: string | null;
    usersData: any[];
  }> => {
    if (!accountId) return { departments: [], targetDepartmentId: null, usersData: [] };

    // Fetch departments
    const { data: depts, error: deptsError } = await supabase
      .from("zapp_departments")
      .select("*")
      .eq("account_id", accountId)
      .order("display_order");

    if (deptsError) throw deptsError;

    let targetDepartmentId: string | null = null;
    if (sectorId) {
      const sectorDept = (depts || []).find(d => d.sector_id === sectorId);
      targetDepartmentId = sectorDept?.id || null;
    }

    // Fetch agents, users, roles, tags in parallel
    const [
      { data: agentsData, error: agentsError },
      { data: usersData, error: usersError },
      { data: rolesData, error: rolesError },
    ] = await Promise.all([
      supabase
        .from("zapp_agents")
        .select(`*, user:users!zapp_agents_user_id_fkey(id, name, email, avatar_url, team_role_id, role, is_also_admin), department:zapp_departments(*)`)
        .eq("account_id", accountId)
        .order("created_at"),
      supabase
        .from("users")
        .select("id, name, email, avatar_url, role, team_role_id, is_also_admin, team_role:team_roles(id, name, color)")
        .eq("account_id", accountId)
        .order("name"),
      supabase
        .from("team_roles")
        .select("id, name, color")
        .eq("account_id", accountId)
        .order("display_order"),
    ]);

    if (agentsError) throw agentsError;
    if (usersError) throw usersError;
    if (rolesError) throw rolesError;

    // Sync sectors to departments
    const sectorsToSync = sectors.filter(s => s.id !== "configuracoes" && !s.comingSoon);
    const existingDepts = depts || [];
    const existingSectorIds = existingDepts.map(d => d.sector_id).filter(Boolean);
    const missingSectors = sectorsToSync.filter(s => !existingSectorIds.includes(s.id));

    let finalDepartments = existingDepts;

    if (missingSectors.length > 0 && accountId) {
      const newDepts = missingSectors.map((sector, idx) => ({
        account_id: accountId,
        name: sector.name,
        description: sector.description,
        color: sector.color.replace("text-", "").replace("-600", ""),
        sector_id: sector.id,
        display_order: (existingDepts.length + idx + 1),
        auto_distribution: false,
      }));

      const { data: createdDepts, error: createDeptsError } = await supabase
        .from("zapp_departments")
        .insert(newDepts)
        .select("*");

      if (createDeptsError) {
        console.error("[ZappDialogs] Error creating departments:", createDeptsError);
      } else if (createdDepts) {
        toast.success(`${createdDepts.length} departamentos criados automaticamente`);
        finalDepartments = [...existingDepts, ...createdDepts];
      }
    }

    setDepartments(finalDepartments);
    setTeamUsers((usersData || []) as TeamUser[]);
    setTeamRoles(rolesData || []);

    // Auto-register agent if needed
    let finalAgents = agentsData || [];
    const existingAgent = finalAgents.find((a: Agent) => a.user_id === userId);

    if (!existingAgent && userId) {
      const { data: newAgent, error: createError } = await supabase
        .from("zapp_agents")
        .insert({
          account_id: accountId,
          user_id: userId,
          is_online: true,
          last_activity_at: new Date().toISOString(),
        })
        .select(`*, user:users!zapp_agents_user_id_fkey(id, name, email, avatar_url, team_role_id, role, is_also_admin), department:zapp_departments(*)`)
        .single();

      if (!createError && newAgent) {
        finalAgents = [...finalAgents, newAgent];
      } else if (createError) {
        console.error("Error auto-registering agent:", createError);
      }
    } else if (existingAgent) {
      if (agentHeartbeatRef.current) clearInterval(agentHeartbeatRef.current);
      updateAgentHeartbeat(existingAgent.id);
      agentHeartbeatRef.current = setInterval(() => {
        updateAgentHeartbeat(existingAgent.id);
      }, HEARTBEAT_INTERVAL_MS);
    }

    // Filter agents by current sector's department
    let filteredAgents = finalAgents;
    if (sectorId && targetDepartmentId) {
      filteredAgents = finalAgents.filter((a: Agent) => {
        if (a.user_id === userId) return true;
        if (a.department_id === targetDepartmentId) return true;
        if (a.department_id === null) return true;

        const userRole = a.user?.role || usersData?.find((u: any) => u.id === a.user_id)?.role;
        const isAdmin = userRole === 'admin' || userRole === 'super_admin';
        const isGestor = userRole === 'gestor';
        const teamUser = usersData?.find((u: any) => u.id === a.user_id);
        const hasAdminFlag = (teamUser as any)?.is_also_admin === true;

        if (isAdmin || isGestor || hasAdminFlag) return true;
        return false;
      });
    }

    setAgents(filteredAgents);

    return { departments: finalDepartments, targetDepartmentId, usersData: usersData || [] };
  }, [accountId, userId, sectorId, updateAgentHeartbeat]);

  // Cleanup heartbeat on unmount
  useEffect(() => {
    return () => {
      if (agentHeartbeatRef.current) clearInterval(agentHeartbeatRef.current);
    };
  }, []);

  return {
    departments,
    agents,
    teamUsers,
    teamRoles,
    currentAgent,
    setDepartments,
    setAgents,
    fetchDialogData,
  };
}

export type { TeamUser };
