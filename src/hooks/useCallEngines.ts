import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import type { CallEngine } from "@/lib/telephony/callEngines";

/** Motores de ligação configurados na conta (3C Plus e/ou Call Ryka). */
export function useCallEngines() {
  const { currentUser } = useCurrentUser();
  const accountId = currentUser?.account_id ?? null;
  const [engines, setEngines] = useState<CallEngine[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    if (!accountId) {
      setEngines([]);
      setLoading(false);
      return;
    }
    void (async () => {
      const { data } = await supabase
        .from("integrations")
        .select("type, status")
        .eq("account_id", accountId)
        .in("type", ["3cplus", "ryka_call"] as never[]);
      if (!active) return;
      const connected = (data || [])
        .filter((row: any) => row.status === "connected")
        .map((row: any) => row.type as CallEngine);
      setEngines(connected);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [accountId]);

  return { engines, loading, hasRyka: engines.includes("ryka_call"), has3C: engines.includes("3cplus") };
}
