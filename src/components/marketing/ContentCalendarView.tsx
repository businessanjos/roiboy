import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Instagram, Music2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isToday,
  addMonths,
  subMonths,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useContentCalendarData, ContentPost } from "@/hooks/useContentCalendarData";
import { ContentCalendarPostsDialog } from "./ContentCalendarPostsDialog";
import { useNavigate } from "react-router-dom";

const WEEKDAYS = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];

interface ContentCalendarViewProps {
  currentMonth: Date;
  onMonthChange: (date: Date) => void;
}

// Custom Instagram icon with gradient
function InstagramIcon({ className }: { className?: string }) {
  return (
    <div
      className={cn("rounded flex items-center justify-center", className)}
      style={{
        background:
          "linear-gradient(45deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888)",
      }}
    >
      <Instagram className="h-3.5 w-3.5 text-white" />
    </div>
  );
}

// Custom TikTok icon with brand colors
function TikTokIcon({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "rounded flex items-center justify-center bg-black relative overflow-hidden",
        className
      )}
    >
      <Music2 className="h-3.5 w-3.5 text-white relative z-10" />
      <div
        className="absolute inset-0 opacity-30"
        style={{
          background: "linear-gradient(135deg, #00f2ea 0%, transparent 50%, #ff0050 100%)",
        }}
      />
    </div>
  );
}

// Badge component for count
function CountBadge({ count }: { count: number }) {
  if (count <= 1) return null;
  return (
    <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-[10px] font-bold min-w-[16px] h-4 rounded-full flex items-center justify-center px-1">
      {count}
    </span>
  );
}

export function ContentCalendarView({
  currentMonth,
  onMonthChange,
}: ContentCalendarViewProps) {
  const navigate = useNavigate();
  const { data: contentByDate, isLoading } = useContentCalendarData(currentMonth);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedPosts, setSelectedPosts] = useState<ContentPost[]>([]);
  const [selectedPlatform, setSelectedPlatform] = useState<"instagram" | "tiktok">("instagram");
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  // Calculate calendar days
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });

    return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  }, [currentMonth]);

  const handlePrevMonth = () => onMonthChange(subMonths(currentMonth, 1));
  const handleNextMonth = () => onMonthChange(addMonths(currentMonth, 1));
  const handleToday = () => onMonthChange(new Date());

  const isCurrentMonthToday = isSameMonth(currentMonth, new Date());

  const handlePlatformClick = (
    e: React.MouseEvent,
    posts: ContentPost[],
    platform: "instagram" | "tiktok",
    day: Date
  ) => {
    e.stopPropagation();

    if (posts.length === 1) {
      // Navigate directly to the post
      navigate(`/social-media?platform=${platform}&postId=${posts[0].id}`);
    } else {
      // Open dialog with post list
      setSelectedPosts(posts);
      setSelectedPlatform(platform);
      setSelectedDate(day);
      setDialogOpen(true);
    }
  };

  const getContentForDay = (date: Date) => {
    const dateKey = format(date, "yyyy-MM-dd");
    return contentByDate?.[dateKey];
  };

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex flex-col h-[calc(100vh-220px)] space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleToday}
              className={cn(isCurrentMonthToday && "opacity-50")}
            >
              Hoje
            </Button>
            <Button variant="ghost" size="icon" onClick={handlePrevMonth}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={handleNextMonth}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <h2 className="text-xl font-semibold capitalize">
              {format(currentMonth, "MMMM 'de' yyyy", { locale: ptBR })}
            </h2>
          </div>
        </div>

        {/* Calendar Grid */}
        <div className="flex-1 flex flex-col border rounded-lg overflow-hidden bg-card">
          {/* Weekday headers */}
          <div className="grid grid-cols-7 border-b bg-muted/50">
            {WEEKDAYS.map((day) => (
              <div
                key={day}
                className="px-2 py-3 text-center text-xs font-medium text-muted-foreground border-r last:border-r-0"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Days grid */}
          <div className="flex-1 grid grid-cols-7 auto-rows-fr">
            {isLoading ? (
              <div className="col-span-7 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
              </div>
            ) : (
              calendarDays.map((day, index) => {
                const dayContent = getContentForDay(day);
                const isInMonth = isSameMonth(day, currentMonth);
                const isDayToday = isToday(day);

                const hasInstagram = dayContent?.instagram && dayContent.instagram.count > 0;
                const hasTikTok = dayContent?.tiktok && dayContent.tiktok.count > 0;

                return (
                  <div
                    key={index}
                    className={cn(
                      "min-h-[100px] border-r border-b last:border-r-0 p-1 flex flex-col transition-colors",
                      !isInMonth && "bg-muted/30",
                      isDayToday && "bg-primary/5"
                    )}
                  >
                    {/* Day number */}
                    <div className="flex items-center justify-between mb-1">
                      <span
                        className={cn(
                          "text-sm w-7 h-7 flex items-center justify-center rounded-full",
                          isDayToday && "bg-primary text-primary-foreground font-bold",
                          !isInMonth && "text-muted-foreground"
                        )}
                      >
                        {format(day, "d")}
                      </span>
                    </div>

                    {/* Platform icons */}
                    <div className="flex-1 flex items-end justify-center gap-2 pb-2">
                      {hasInstagram && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              onClick={(e) =>
                                handlePlatformClick(
                                  e,
                                  dayContent.instagram.posts,
                                  "instagram",
                                  day
                                )
                              }
                              className="relative p-1 rounded hover:bg-muted/50 transition-colors"
                            >
                              <InstagramIcon className="w-6 h-6" />
                              <CountBadge count={dayContent.instagram.count} />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>
                            {dayContent.instagram.count} post{dayContent.instagram.count > 1 ? "s" : ""} no Instagram
                          </TooltipContent>
                        </Tooltip>
                      )}

                      {hasTikTok && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              onClick={(e) =>
                                handlePlatformClick(e, dayContent.tiktok.posts, "tiktok", day)
                              }
                              className="relative p-1 rounded hover:bg-muted/50 transition-colors"
                            >
                              <TikTokIcon className="w-6 h-6" />
                              <CountBadge count={dayContent.tiktok.count} />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>
                            {dayContent.tiktok.count} post{dayContent.tiktok.count > 1 ? "s" : ""} no TikTok
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      <ContentCalendarPostsDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        posts={selectedPosts}
        platform={selectedPlatform}
        date={selectedDate}
      />
    </TooltipProvider>
  );
}
