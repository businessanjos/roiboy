import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Helper to format date in Brazilian format
function formatDate(dateStr: string): string {
  const date = new Date(dateStr + "T12:00:00");
  return date.toLocaleDateString("pt-BR");
}

// Helper to format time
function formatTime(dateTimeStr: string): string {
  const date = new Date(dateTimeStr);
  return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

// Get today's date in Brazil timezone (America/Sao_Paulo)
function getTodayInBrazil(): string {
  const now = new Date();
  const brazilTime = new Date(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  return brazilTime.toISOString().split("T")[0];
}

// Get tomorrow's date in Brazil timezone
function getTomorrowInBrazil(): string {
  const now = new Date();
  const brazilTime = new Date(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  brazilTime.setDate(brazilTime.getDate() + 1);
  return brazilTime.toISOString().split("T")[0];
}

// Check if notification already exists for today
async function notificationExistsToday(
  supabase: any,
  userId: string,
  sourceType: string,
  sourceId: string,
  type: string,
  today: string
): Promise<boolean> {
  const { data } = await supabase
    .from("notifications")
    .select("id")
    .eq("user_id", userId)
    .eq("source_type", sourceType)
    .eq("source_id", sourceId)
    .eq("type", type)
    .gte("created_at", `${today}T00:00:00`)
    .limit(1);

  return data && data.length > 0;
}

// Create notification
async function createNotification(
  supabase: any,
  params: {
    accountId: string;
    userId: string;
    type: string;
    title: string;
    content: string;
    link: string;
    sourceType: string;
    sourceId: string;
  }
): Promise<boolean> {
  const { error } = await supabase.from("notifications").insert({
    account_id: params.accountId,
    user_id: params.userId,
    type: params.type,
    title: params.title,
    content: params.content,
    link: params.link,
    source_type: params.sourceType,
    source_id: params.sourceId,
  });

  if (error) {
    console.error(`Error creating notification:`, error);
    return false;
  }
  return true;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const today = getTodayInBrazil();
    const tomorrow = getTomorrowInBrazil();
    console.log(`Checking agenda reminders for today: ${today}, tomorrow: ${tomorrow}`);

    let tasksNotified = 0;
    let eventsNotified = 0;
    let mentorNotified = 0;

    // ==========================================
    // 1. TASKS DUE TODAY
    // ==========================================
    const { data: todayTasks, error: todayTasksError } = await supabase
      .from("internal_tasks")
      .select("id, title, assigned_to, created_by, client_id, account_id, status_id, clients(full_name)")
      .eq("due_date", today)
      .not("status_id", "is", null);

    if (todayTasksError) {
      console.error("Error fetching today tasks:", todayTasksError);
    } else if (todayTasks) {
      // Filter out completed/cancelled tasks by checking status
      for (const task of todayTasks as any[]) {
        // Get the status to check if it's completed
        const { data: statusData } = await supabase
          .from("task_statuses")
          .select("is_completed_status")
          .eq("id", task.status_id)
          .single();

        if (statusData?.is_completed_status) {
          continue; // Skip completed tasks
        }

        const userId = task.assigned_to || task.created_by;
        if (!userId) continue;

        const exists = await notificationExistsToday(
          supabase,
          userId,
          "internal_tasks",
          task.id,
          "task_due_today",
          today
        );

        if (exists) {
          console.log(`Notification already sent for task ${task.id}`);
          continue;
        }

        const clientName = task.clients?.full_name;
        const content = clientName ? `${task.title} - ${clientName}` : task.title;

        const created = await createNotification(supabase, {
          accountId: task.account_id,
          userId,
          type: "task_due_today",
          title: "⏰ Tarefa para hoje",
          content,
          link: task.client_id ? `/clients/${task.client_id}` : "/tasks",
          sourceType: "internal_tasks",
          sourceId: task.id,
        });

        if (created) tasksNotified++;
      }
    }

    // ==========================================
    // 2. OVERDUE TASKS
    // ==========================================
    const { data: overdueTasks, error: overdueTasksError } = await supabase
      .from("internal_tasks")
      .select("id, title, assigned_to, created_by, client_id, account_id, due_date, status_id, clients(full_name)")
      .lt("due_date", today)
      .not("status_id", "is", null);

    if (overdueTasksError) {
      console.error("Error fetching overdue tasks:", overdueTasksError);
    } else if (overdueTasks) {
      for (const task of overdueTasks as any[]) {
        // Get the status to check if it's completed
        const { data: statusData } = await supabase
          .from("task_statuses")
          .select("is_completed_status")
          .eq("id", task.status_id)
          .single();

        if (statusData?.is_completed_status) {
          continue; // Skip completed tasks
        }

        const userId = task.assigned_to || task.created_by;
        if (!userId) continue;

        const exists = await notificationExistsToday(
          supabase,
          userId,
          "internal_tasks",
          task.id,
          "task_overdue",
          today
        );

        if (exists) {
          console.log(`Overdue notification already sent for task ${task.id}`);
          continue;
        }

        const clientName = task.clients?.full_name;
        const content = clientName
          ? `${task.title} - ${clientName} (Venceu em ${formatDate(task.due_date)})`
          : `${task.title} (Venceu em ${formatDate(task.due_date)})`;

        const created = await createNotification(supabase, {
          accountId: task.account_id,
          userId,
          type: "task_overdue",
          title: "⚠️ Tarefa atrasada",
          content,
          link: task.client_id ? `/clients/${task.client_id}` : "/tasks",
          sourceType: "internal_tasks",
          sourceId: task.id,
        });

        if (created) tasksNotified++;
      }
    }

    // ==========================================
    // 3. EVENTS TODAY
    // ==========================================
    const { data: todayEvents, error: todayEventsError } = await supabase
      .from("events")
      .select("id, title, account_id, scheduled_at")
      .gte("scheduled_at", `${today}T00:00:00`)
      .lt("scheduled_at", `${today}T23:59:59`);

    if (todayEventsError) {
      console.error("Error fetching today events:", todayEventsError);
    } else if (todayEvents) {
      for (const event of todayEvents) {
        // Get team members for this event
        const { data: teamMembers } = await supabase
          .from("event_team")
          .select("user_id")
          .eq("event_id", event.id);

        if (!teamMembers || teamMembers.length === 0) {
          console.log(`No team members for event ${event.id}`);
          continue;
        }

        for (const member of teamMembers) {
          const exists = await notificationExistsToday(
            supabase,
            member.user_id,
            "events",
            event.id,
            "event_today",
            today
          );

          if (exists) {
            console.log(`Event notification already sent for event ${event.id} to user ${member.user_id}`);
            continue;
          }

          const created = await createNotification(supabase, {
            accountId: event.account_id,
            userId: member.user_id,
            type: "event_today",
            title: "📅 Evento hoje",
            content: `${event.title} às ${formatTime(event.scheduled_at)}`,
            link: `/events/${event.id}`,
            sourceType: "events",
            sourceId: event.id,
          });

          if (created) eventsNotified++;
        }
      }
    }

    // ==========================================
    // 4. OVERDUE EVENTS (past events not completed)
    // ==========================================
    const { data: overdueEvents, error: overdueEventsError } = await supabase
      .from("events")
      .select("id, title, account_id, scheduled_at, status")
      .lt("scheduled_at", `${today}T00:00:00`)
      .neq("status", "completed");

    if (overdueEventsError) {
      console.error("Error fetching overdue events:", overdueEventsError);
    } else if (overdueEvents) {
      for (const event of overdueEvents) {
        // Get team members for this event
        const { data: teamMembers } = await supabase
          .from("event_team")
          .select("user_id")
          .eq("event_id", event.id);

        if (!teamMembers || teamMembers.length === 0) {
          continue;
        }

        for (const member of teamMembers) {
          const exists = await notificationExistsToday(
            supabase,
            member.user_id,
            "events",
            event.id,
            "event_overdue",
            today
          );

          if (exists) {
            continue;
          }

          const eventDate = new Date(event.scheduled_at).toLocaleDateString("pt-BR");
          const created = await createNotification(supabase, {
            accountId: event.account_id,
            userId: member.user_id,
            type: "event_overdue",
            title: "⚠️ Evento não realizado",
            content: `${event.title} - Agendado para ${eventDate}`,
            link: `/events/${event.id}`,
            sourceType: "events",
            sourceId: event.id,
          });

          if (created) eventsNotified++;
        }
      }
    }

    // ==========================================
    // 5. MENTOR EVENTS - TOMORROW (1 day before)
    // ==========================================
    const { data: mentorEventsTomorrow, error: mentorTomorrowError } = await supabase
      .from("events")
      .select("id, title, account_id, scheduled_at, mentor_user_id")
      .gte("scheduled_at", `${tomorrow}T00:00:00`)
      .lt("scheduled_at", `${tomorrow}T23:59:59`)
      .not("mentor_user_id", "is", null);

    if (mentorTomorrowError) {
      console.error("Error fetching mentor events for tomorrow:", mentorTomorrowError);
    } else if (mentorEventsTomorrow) {
      console.log(`Found ${mentorEventsTomorrow.length} mentor events for tomorrow`);
      
      for (const event of mentorEventsTomorrow) {
        const exists = await notificationExistsToday(
          supabase,
          event.mentor_user_id,
          "events",
          event.id,
          "mentor_event_tomorrow",
          today
        );

        if (exists) {
          console.log(`Mentor tomorrow notification already sent for event ${event.id}`);
          continue;
        }

        const created = await createNotification(supabase, {
          accountId: event.account_id,
          userId: event.mentor_user_id,
          type: "mentor_event_tomorrow",
          title: "🔔 Evento amanhã",
          content: `${event.title} está agendado para amanhã às ${formatTime(event.scheduled_at)}`,
          link: `/events/${event.id}`,
          sourceType: "events",
          sourceId: event.id,
        });

        if (created) mentorNotified++;
      }
    }

    // ==========================================
    // 6. MENTOR EVENTS - TODAY
    // ==========================================
    const { data: mentorEventsToday, error: mentorTodayError } = await supabase
      .from("events")
      .select("id, title, account_id, scheduled_at, mentor_user_id")
      .gte("scheduled_at", `${today}T00:00:00`)
      .lt("scheduled_at", `${today}T23:59:59`)
      .not("mentor_user_id", "is", null);

    if (mentorTodayError) {
      console.error("Error fetching mentor events for today:", mentorTodayError);
    } else if (mentorEventsToday) {
      console.log(`Found ${mentorEventsToday.length} mentor events for today`);
      
      for (const event of mentorEventsToday) {
        const exists = await notificationExistsToday(
          supabase,
          event.mentor_user_id,
          "events",
          event.id,
          "mentor_event_today",
          today
        );

        if (exists) {
          console.log(`Mentor today notification already sent for event ${event.id}`);
          continue;
        }

        const created = await createNotification(supabase, {
          accountId: event.account_id,
          userId: event.mentor_user_id,
          type: "mentor_event_today",
          title: "📅 Evento hoje!",
          content: `${event.title} às ${formatTime(event.scheduled_at)}`,
          link: `/events/${event.id}`,
          sourceType: "events",
          sourceId: event.id,
        });

        if (created) mentorNotified++;
      }
    }

    console.log(`Agenda reminders check completed. Tasks: ${tasksNotified}, Events: ${eventsNotified}, Mentor: ${mentorNotified}`);

    return new Response(
      JSON.stringify({
        success: true,
        date: today,
        tasksNotified,
        eventsNotified,
        mentorNotified,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in check-agenda-reminders:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
