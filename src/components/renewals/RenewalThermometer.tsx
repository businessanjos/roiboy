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
  financial: number;    // 0-100, weight 40%
  escore: number;       // 0-100, weight 25%
  attendance: number;   // 0-100, weight 20%
  roizometer: number;   // 0-100, weight 15%
  total: number;        // 0-100 weighted
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
        const sixMonthsAgo = new Date(today);
        sixMonthsAgo.setMonth(today.getMonth() - 6);
        const ninetyDaysAgo = new Date(today);
        ninetyDaysAgo.setDate(today.getDate() - 90);

        // Fetch all data in parallel
        const [financialRes, scoreRes, attendanceRes] = await Promise.all([
          // 1. Financial health: pending entries in last 90 days
          supabase
            .from("financial_entries")
            .select("id, due_date, status")
            .eq("account_id", accountId)
            .eq("client_id", clientId)
            .eq("entry_type", "income")
            .gte("due_date", ninetyDaysAgo.toISOString().split("T")[0])
            .lte("due_date", today.toISOString().split("T")[0]),

          // 2. Latest score snapshot (escore + roizometer)
          supabase
            .from("score_snapshots")
            .select("escore, roizometer")
            .eq("account_id", accountId)
            .eq("client_id", clientId)
            .order("computed_at", { ascending: false })
            .limit(1),

          // 3. Event attendance in last 6 months
          supabase
            .from("attendance")
            .select("id")
            .eq("account_id", accountId)
            .eq("client_id", clientId)
            .gte("join_time", sixMonthsAgo.toISOString()),
        ]);

        if (cancelled) return;

        // --- Score: Financial Health (40%) ---
        let financialScore = 100;
        if (financialRes.data && financialRes.data.length > 0) {
          const total = financialRes.data.length;
          const pending = financialRes.data.filter((e: any) => e.status === "pending");
          const overduePending = pending.filter((e: any) => {
            const due = new Date(e.due_date);
            return due < today;
          });
          const overdueCount = overduePending.length;
          
          // Check max overdue days
          let maxOverdueDays = 0;
          overduePending.forEach((e: any) => {
            const due = new Date(e.due_date);
            const days = Math.floor((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
            if (days > maxOverdueDays) maxOverdueDays = days;
          });

          if (maxOverdueDays > 60) {
            financialScore = 10; // Very bad
          } else if (maxOverdueDays > 30) {
            financialScore = 30;
          } else if (overdueCount > 0) {
            financialScore = 60;
          } else {
            // All paid - check payment ratio
            const paidCount = financialRes.data.filter((e: any) => e.status === "paid").length;
            financialScore = total > 0 ? Math.min(100, Math.round((paidCount / total) * 100)) : 80;
          }
        } else {
          financialScore = 70; // No data, neutral
        }

        // --- Score: Escore (25%) ---
        let escoreScore = 50;
        let roizometerScore = 50;
        if (scoreRes.data && scoreRes.data.length > 0) {
          const snap = scoreRes.data[0] as any;
          // escore is typically 0-1000
          escoreScore = Math.min(100, Math.round((snap.escore || 0) / 10));
          // roizometer is typically 0-1000
          roizometerScore = Math.min(100, Math.round((snap.roizometer || 0) / 10));
        }

        // --- Score: Attendance (20%) ---
        let attendanceScore = 0;
        if (attendanceRes.data) {
          const count = attendanceRes.data.length;
          if (count >= 6) attendanceScore = 100;
          else if (count >= 4) attendanceScore = 80;
          else if (count >= 2) attendanceScore = 60;
          else if (count >= 1) attendanceScore = 40;
          else attendanceScore = 10;
        }

        // --- Weighted Total ---
        const total = Math.round(
          financialScore * 0.4 +
          escoreScore * 0.25 +
          attendanceScore * 0.2 +
          roizometerScore * 0.15
        );

        setScore({
          financial: financialScore,
          escore: escoreScore,
          attendance: attendanceScore,
          roizometer: roizometerScore,
          total,
        });
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

  const barWidth = `${Math.max(8, total)}%`;

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
                style={{ width: barWidth }}
              />
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent side="left" className="text-xs space-y-1 max-w-[200px]">
          <p className="font-semibold">Termômetro: {total}%</p>
          <div className="space-y-0.5">
            <p>💰 Financeiro: {score.financial}%</p>
            <p>⭐ Escore: {score.escore}%</p>
            <p>📍 Presença: {score.attendance}%</p>
            <p>📊 ROI: {score.roizometer}%</p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
