import { Badge } from "@/components/ui/badge";
import { Check, X, Minus, User } from "lucide-react";
import { CustomField, FieldOption } from "./CustomFieldsManager";

interface TeamUser {
  id: string;
  name: string;
  email: string;
}

interface FieldValueBadgeProps {
  field: CustomField;
  value: any;
  size?: "sm" | "md";
  teamUsers?: TeamUser[];
}

const getColorClasses = (color: string) => {
  const colorMap: Record<string, string> = {
    green: "bg-emerald-500/25 text-emerald-600 dark:text-emerald-400 border-emerald-500/40 dark:border-emerald-400/50",
    red: "bg-red-500/25 text-red-600 dark:text-red-400 border-red-500/40 dark:border-red-400/50",
    yellow: "bg-amber-500/25 text-amber-600 dark:text-amber-400 border-amber-500/40 dark:border-amber-400/50",
    blue: "bg-blue-500/25 text-blue-600 dark:text-blue-400 border-blue-500/40 dark:border-blue-400/50",
    purple: "bg-purple-500/25 text-purple-600 dark:text-purple-400 border-purple-500/40 dark:border-purple-400/50",
    pink: "bg-pink-500/25 text-pink-600 dark:text-pink-400 border-pink-500/40 dark:border-pink-400/50",
    orange: "bg-orange-500/25 text-orange-600 dark:text-orange-400 border-orange-500/40 dark:border-orange-400/50",
    gray: "bg-gray-500/25 text-gray-600 dark:text-gray-400 border-gray-500/40 dark:border-gray-400/50",
  };
  return colorMap[color] || colorMap.gray;
};

export function FieldValueBadge({ field, value, size = "sm", teamUsers }: FieldValueBadgeProps) {
  const textSize = size === "sm" ? "text-xs" : "text-sm";
  const padding = size === "sm" ? "px-1.5 py-0.5" : "px-2 py-1";

  // Boolean field
  if (field.field_type === "boolean") {
    if (value === true) {
      return (
        <span className={`inline-flex items-center gap-1 ${padding} rounded bg-emerald-500/25 text-emerald-600 dark:text-emerald-400 border border-emerald-500/40 dark:border-emerald-400/50 font-medium ${textSize}`}>
          <Check className="h-3 w-3" />
          Sim
        </span>
      );
    } else if (value === false) {
      return (
        <span className={`inline-flex items-center gap-1 ${padding} rounded bg-red-500/25 text-red-600 dark:text-red-400 border border-red-500/40 dark:border-red-400/50 font-medium ${textSize}`}>
          <X className="h-3 w-3" />
          Não
        </span>
      );
    }
    return (
      <span className={`inline-flex items-center gap-1 ${padding} rounded bg-muted/50 text-muted-foreground border border-border ${textSize}`}>
        <Minus className="h-3 w-3" />
      </span>
    );
  }

  // Select field
  if (field.field_type === "select") {
    const option = field.options.find(opt => opt.value === value);
    if (!option) {
      return (
        <span className={`inline-flex items-center ${padding} rounded bg-muted/50 text-muted-foreground border border-border ${textSize}`}>
          —
        </span>
      );
    }
    return (
      <span className={`inline-flex items-center ${padding} rounded border font-medium ${getColorClasses(option.color)} ${textSize}`}>
        {option.label}
      </span>
    );
  }

  // Multi-select field
  if (field.field_type === "multi_select") {
    const selectedValues = Array.isArray(value) ? value : [];
    if (selectedValues.length === 0) {
      return (
        <span className={`inline-flex items-center ${padding} rounded bg-muted/50 text-muted-foreground border border-border ${textSize}`}>
          —
        </span>
      );
    }
    const selectedOptions = field.options.filter(opt => selectedValues.includes(opt.value));
    return (
      <div className="flex flex-wrap gap-1">
        {selectedOptions.slice(0, 2).map((option) => (
          <span
            key={option.value}
            className={`inline-flex items-center ${padding} rounded border font-medium ${getColorClasses(option.color)} ${textSize}`}
          >
            {option.label}
          </span>
        ))}
        {selectedOptions.length > 2 && (
          <span className={`inline-flex items-center ${padding} rounded bg-muted/50 text-muted-foreground border border-border ${textSize}`}>
            +{selectedOptions.length - 2}
          </span>
        )}
      </div>
    );
  }

  // User field
  if (field.field_type === "user") {
    const selectedUserIds = Array.isArray(value) ? value : [];
    if (selectedUserIds.length === 0) {
      return (
        <span className={`inline-flex items-center ${padding} rounded bg-muted text-muted-foreground ${textSize}`}>
          —
        </span>
      );
    }
    
    // If we have team users data, show names
    if (teamUsers && teamUsers.length > 0) {
      const selectedUsers = teamUsers.filter(u => selectedUserIds.includes(u.id));
      return (
        <div className="flex flex-wrap gap-1">
          {selectedUsers.slice(0, 2).map((user) => (
            <span
              key={user.id}
              className={`inline-flex items-center gap-1 ${padding} rounded bg-primary/10 text-primary border border-primary/20 ${textSize}`}
            >
              <User className="h-3 w-3" />
              {user.name.split(" ")[0]}
            </span>
          ))}
          {selectedUsers.length > 2 && (
            <span className={`inline-flex items-center ${padding} rounded bg-muted text-muted-foreground ${textSize}`}>
              +{selectedUsers.length - 2}
            </span>
          )}
        </div>
      );
    }
    
    // Fallback: show count
    return (
      <span className={`inline-flex items-center gap-1 ${padding} rounded bg-primary/10 text-primary border border-primary/20 ${textSize}`}>
        <User className="h-3 w-3" />
        {selectedUserIds.length}
      </span>
    );
  }

  // Number field
  if (field.field_type === "number") {
    if (value === null || value === undefined) {
      return <span className={`text-muted-foreground ${textSize}`}>—</span>;
    }
    return <span className={textSize}>{value}</span>;
  }

  // Currency field
  if (field.field_type === "currency") {
    if (value === null || value === undefined) {
      return <span className={`text-muted-foreground ${textSize}`}>—</span>;
    }
    return (
      <span className={textSize}>
        {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value)}
      </span>
    );
  }

  // Date field
  if (field.field_type === "date") {
    if (!value) {
      return <span className={`text-muted-foreground ${textSize}`}>—</span>;
    }
    return (
      <span className={textSize}>
        {new Date(value).toLocaleDateString("pt-BR")}
      </span>
    );
  }

  // Text field
  if (field.field_type === "text") {
    if (!value) {
      return <span className={`text-muted-foreground ${textSize}`}>—</span>;
    }
    return (
      <span className={`${textSize} truncate max-w-32`} title={value}>
        {value}
      </span>
    );
  }

  return <span className={`text-muted-foreground ${textSize}`}>—</span>;
}
