import { useState } from "react";
import { ContentCalendarView } from "@/components/marketing/ContentCalendarView";

export default function ContentCalendar() {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Calendário de Conteúdo</h1>
        <p className="text-muted-foreground">
          Visualize os posts publicados nas redes sociais
        </p>
      </div>

      <ContentCalendarView
        currentMonth={currentMonth}
        onMonthChange={setCurrentMonth}
      />
    </div>
  );
}
