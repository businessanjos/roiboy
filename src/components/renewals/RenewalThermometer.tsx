import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Flame, Thermometer, Snowflake } from "lucide-react";
import { cn } from "@/lib/utils";

interface RenewalThermometerProps {
  clientId: string;
  accountId: string;
}

interface ScoreBreakdown {
  financial: number;
  engagement: number;
  attendance: number;
  total: number;
}

export function RenewalThermometer({ clientId, accountId }: RenewalThermometerProps) {
  const [score, setScore] = useState<ScoreBreakdown | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function calculate() {
      setLoading(true);
      try {
        const today = new Date();
        const ninetyDaysAgo = new Date(today);
        ninetyDaysAgo.setDate(today.getDate() - 90);
        const sixMonthsAgo = new Date(today);
        sixMonthsAgo.setMonth(today.getMonth() - 6);

        const [financialRes, messagesRes, attendanceRes] = await Promise.all([
          // 1. Financial: overdue income entries
          supabase
            .from("financial_entries")
            .select("id, due_date, status")
            .eq("account_id", accountId)
            .eq("client_id", clientId)
            .eq("entry_type", "income")
            .gte("due_date", ninetyDaysAgo.toISOString().split("T")[0])
            .lte("due_date", today.toISOString().split("T")[0]),

          // 2. Client messages in last 90 days (engagement)
          supabase
            .from("message_events")
            .select("id, created_at")
            .eq("account_id", accountId)
            .eq("client_id", clientId)
            .eq("direction", "client_to_team" as any)
            .gte("created_at", ninetyDaysAgo.toISOString()),

          // 3. Event attendance in last 6 months
          supabase
            .from("attendance")
            .select("id")
            .eq("account_id", accountId)
            .eq("client_id", clientId)
            .gte("join_time", sixMonthsAgo.toISOString()),
        ]);

        if (cancelled) return;

        // --- Financial Health (45%) ---
        let financialScore = 80; // default if no entries
        if (financialRes.data && financialRes.data.length > 0) {
          const overdue = financialRes.data.filter((e: any) => {
            return e.status === "pending" && new Date(e.due_date) < today;
          });

          let maxOverdueDays = 0;
          overdue.forEach((e: any) => {
            const days = Math.floor((today.getTime() - new Date(e.due_date).getTime()) / (1000 * 60 * 60 * 24));
            if (days > maxOverdueDays) maxOverdueDays = days;
          });

          if (maxOverdueDays > 60) financialScore = 5;
          else if (maxOverdueDays > 30) financialScore = 25;
          else if (overdue.length > 0) financialScore = 55;
          else {
            const paid = financialRes.data.filter((e: any) => e.status === "paid").length;
            financialScore = financialRes.data.length > 0
              ? Math.min(100, Math.round((paid / financialRes.data.length) * 100))
              : 80;
          }
        }

        // --- Engagement via Messages (35%) ---
        let engagementScore = 20; // default if no messages
        if (messagesRes.data) {
          const count = messagesRes.data.length;
          if (count >= 40) engagementScore = 100;
          else if (count >= 20) engagementScore = 85;
          else if (count >= 10) engagementScore = 70;
          else if (count >= 5) engagementScore = 50;
          else if (count >= 1) engagementScore = 30;
          else engagementScore = 5;
        }

        // --- Attendance (20%) ---
        let attendanceScore = 15; // default if no attendance
        if (attendanceRes.data) {
          const count = attendanceRes.data.length;
          if (count >= 5) attendanceScore = 100;
          else if (count >= 3) attendanceScore = 80;
          else if (count >= 2) attendanceScore = 60;
          else if (count >= 1) attendanceScore = 40;
          else attendanceScore = 5;
        }

        const total = Math.round(
          financialScore * 0.45 +
          engagementScore * 0.35 +
          attendanceScore * 0.20
        );

        setScore({ financial: financialScore, engagement: engagementScore, attendance: attendanceScore, total });
      } catch (err) {
        console.error("Error calculating renewal score:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    calculate();
    return () => { cancelled = true; };
  }, [clientId, accountId]);

  if (loading) {
    return (
      <div className="flex justify-center">
        <div className="h-4 w-12 rounded-full bg-muted animate-pulse" />
      </div>
    );
  }

  if (!score) return <span className="text-xs text-muted-foreground">—</span>;

  const { total } = score;

  let label: string;
  let colorClass: string;
  let bgClass: string;
  let Icon: typeof Flame;

  if (total >= 70) {
    label = "Alta";
    colorClass = "text-emerald-600 dark:text-emerald-400";
    bgClass = "bg-emerald-500";
    Icon = Flame;
  } else if (total >= 40) {
    label = "Média";
    colorClass = "text-amber-600 dark:text-amber-400";
    bgClass = "bg-amber-500";
    Icon = Thermometer;
  } else {
    label = "Baixa";
    colorClass = "text-red-600 dark:text-red-400";
    bgClass = "bg-red-500";
    Icon = Snowflake;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex flex-col items-center gap-1 cursor-default min-w-[80px]">
            <div className={cn("flex items-center gap-1 text-xs font-semibold", colorClass)}>
              <Icon className="h-3.5 w-3.5" />
              {label}
            </div>
            <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className={cn("h-full rounded-full transition-all", bgClass)}
                style={{ width: `${Math.max(8, total)}%` }}
              />
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent side="left" className="text-xs space-y-1 max-w-[200px]">
          <p className="font-semibold">Termômetro: {total}%</p>
          <div className="space-y-0.5">
            <p>💰 Financeiro: {score.financial}%</p>
            <p>💬 Engajamento: {score.engagement}%</p>
            <p>📍 Presença: {score.attendance}%</p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
