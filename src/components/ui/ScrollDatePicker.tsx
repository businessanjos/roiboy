import { useState, useRef, useEffect, useCallback } from "react";

interface ScrollDatePickerProps {
  value?: Date;
  onChange: (date: Date) => void;
  minYear?: number;
  maxYear?: number;
}

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const ITEM_HEIGHT = 40;
const VISIBLE_ITEMS = 5;
const CENTER_INDEX = Math.floor(VISIBLE_ITEMS / 2);

function getDaysInMonth(month: number, year: number) {
  return new Date(year, month + 1, 0).getDate();
}

function ScrollColumn({
  items,
  selectedIndex,
  onSelect,
  renderItem,
}: {
  items: number[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  renderItem: (value: number, isSelected: boolean) => string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollTimeout = useRef<ReturnType<typeof setTimeout>>();
  const isUserScrolling = useRef(false);

  const scrollToIndex = useCallback((index: number, smooth = true) => {
    if (!containerRef.current) return;
    const top = index * ITEM_HEIGHT;
    containerRef.current.scrollTo({ top, behavior: smooth ? "smooth" : "auto" });
  }, []);

  useEffect(() => {
    if (!isUserScrolling.current) {
      scrollToIndex(selectedIndex, false);
    }
  }, [selectedIndex, scrollToIndex]);

  const handleScroll = () => {
    isUserScrolling.current = true;
    if (scrollTimeout.current) clearTimeout(scrollTimeout.current);
    scrollTimeout.current = setTimeout(() => {
      if (!containerRef.current) return;
      const scrollTop = containerRef.current.scrollTop;
      const index = Math.round(scrollTop / ITEM_HEIGHT);
      const clampedIndex = Math.max(0, Math.min(items.length - 1, index));
      scrollToIndex(clampedIndex, true);
      if (clampedIndex !== selectedIndex) {
        onSelect(clampedIndex);
      }
      isUserScrolling.current = false;
    }, 80);
  };

  const paddingTop = CENTER_INDEX * ITEM_HEIGHT;
  const paddingBottom = CENTER_INDEX * ITEM_HEIGHT;

  return (
    <div className="relative flex-1" style={{ height: VISIBLE_ITEMS * ITEM_HEIGHT }}>
      {/* Selection highlight */}
      <div
        className="absolute left-1 right-1 rounded-lg pointer-events-none z-10"
        style={{
          top: CENTER_INDEX * ITEM_HEIGHT,
          height: ITEM_HEIGHT,
          background: "rgba(255,255,255,0.08)",
          border: "1px solid rgba(255,255,255,0.12)",
        }}
      />
      {/* Fade top */}
      <div
        className="absolute top-0 left-0 right-0 z-20 pointer-events-none"
        style={{
          height: CENTER_INDEX * ITEM_HEIGHT,
          background: "linear-gradient(to bottom, rgba(24,24,27,1) 0%, rgba(24,24,27,0) 100%)",
        }}
      />
      {/* Fade bottom */}
      <div
        className="absolute bottom-0 left-0 right-0 z-20 pointer-events-none"
        style={{
          height: CENTER_INDEX * ITEM_HEIGHT,
          background: "linear-gradient(to top, rgba(24,24,27,1) 0%, rgba(24,24,27,0) 100%)",
        }}
      />
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="h-full overflow-y-auto scrollbar-none"
        style={{
          scrollSnapType: "y mandatory",
          WebkitOverflowScrolling: "touch",
          msOverflowStyle: "none",
          scrollbarWidth: "none",
        }}
      >
        <div style={{ height: paddingTop }} />
        {items.map((item, i) => {
          const isSelected = i === selectedIndex;
          return (
            <div
              key={`${item}-${i}`}
              onClick={() => {
                onSelect(i);
                scrollToIndex(i, true);
              }}
              className="flex items-center justify-center cursor-pointer select-none transition-all duration-150"
              style={{
                height: ITEM_HEIGHT,
                scrollSnapAlign: "start",
                color: isSelected ? "#f0f0f2" : "rgba(240,240,242,0.35)",
                fontSize: isSelected ? "16px" : "14px",
                fontWeight: isSelected ? 600 : 400,
              }}
            >
              {renderItem(item, isSelected)}
            </div>
          );
        })}
        <div style={{ height: paddingBottom }} />
      </div>
    </div>
  );
}

export function ScrollDatePicker({ value, onChange, minYear = 1930, maxYear }: ScrollDatePickerProps) {
  const currentYear = new Date().getFullYear();
  const effectiveMaxYear = maxYear ?? currentYear;

  const years = Array.from({ length: effectiveMaxYear - minYear + 1 }, (_, i) => effectiveMaxYear - i);
  const months = Array.from({ length: 12 }, (_, i) => i);

  const initialDate = value || new Date(2000, 0, 1);
  const [selectedYear, setSelectedYear] = useState(initialDate.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(initialDate.getMonth());
  const [selectedDay, setSelectedDay] = useState(initialDate.getDate());

  const daysInMonth = getDaysInMonth(selectedMonth, selectedYear);
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const clampedDay = Math.min(selectedDay, daysInMonth);

  useEffect(() => {
    if (selectedDay > daysInMonth) {
      setSelectedDay(daysInMonth);
    }
  }, [daysInMonth, selectedDay]);

  const yearIndex = years.indexOf(selectedYear);
  const monthIndex = selectedMonth;
  const dayIndex = clampedDay - 1;

  const handleChange = (day: number, month: number, year: number) => {
    const maxDay = getDaysInMonth(month, year);
    const finalDay = Math.min(day, maxDay);
    onChange(new Date(year, month, finalDay));
  };

  return (
    <div className="flex flex-col gap-3 p-4" style={{ backgroundColor: "rgb(24,24,27)" }}>
      <div className="flex gap-1" style={{ height: VISIBLE_ITEMS * ITEM_HEIGHT }}>
        <ScrollColumn
          items={days}
          selectedIndex={dayIndex}
          onSelect={(i) => {
            const newDay = days[i];
            setSelectedDay(newDay);
            handleChange(newDay, selectedMonth, selectedYear);
          }}
          renderItem={(val) => String(val).padStart(2, "0")}
        />
        <ScrollColumn
          items={months}
          selectedIndex={monthIndex}
          onSelect={(i) => {
            setSelectedMonth(i);
            handleChange(selectedDay, i, selectedYear);
          }}
          renderItem={(val) => MONTHS[val].slice(0, 3)}
        />
        <ScrollColumn
          items={years}
          selectedIndex={yearIndex >= 0 ? yearIndex : 0}
          onSelect={(i) => {
            const newYear = years[i];
            setSelectedYear(newYear);
            handleChange(selectedDay, selectedMonth, newYear);
          }}
          renderItem={(val) => String(val)}
        />
      </div>
    </div>
  );
}
