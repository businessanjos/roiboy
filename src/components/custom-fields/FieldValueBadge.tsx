import { Badge } from "@/components/ui/badge";
import { Check, X, Minus, User, Instagram, MapPin, ExternalLink } from "lucide-react";
import { CustomField, FieldOption } from "./CustomFieldsManager";
import { formatLocalDate } from "@/lib/dateUtils";

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
  onRemoveInstagram?: (index: number) => void;
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

export function FieldValueBadge({ field, value, size = "sm", teamUsers, onRemoveInstagram }: FieldValueBadgeProps) {
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
    return <span className={`text-muted-foreground ${textSize}`}>—</span>;
  }

  // Select field
  if (field.field_type === "select") {
    const option = field.options.find(opt => opt.value === value);
    if (!option) {
      return <span className={`text-muted-foreground ${textSize}`}>—</span>;
    }
    return (
      <span 
        className={`inline-flex items-center ${padding} rounded border font-medium ${getColorClasses(option.color)} ${textSize} break-words whitespace-normal`}
      >
        {option.label}
      </span>
    );
  }

  // Multi-select field
  if (field.field_type === "multi_select") {
    const selectedValues = Array.isArray(value) ? value : [];
    if (selectedValues.length === 0) {
      return <span className={`text-muted-foreground ${textSize}`}>—</span>;
    }
    const selectedOptions = field.options.filter(opt => selectedValues.includes(opt.value));
    return (
      <div className="flex flex-wrap gap-1">
        {selectedOptions.map((option) => (
          <span
            key={option.value}
            className={`inline-flex items-center ${padding} rounded border font-medium ${getColorClasses(option.color)} ${textSize} break-words whitespace-normal`}
          >
            {option.label}
          </span>
        ))}
      </div>
    );
  }

  // User field
  if (field.field_type === "user") {
    const selectedUserIds = Array.isArray(value) ? value : [];
    if (selectedUserIds.length === 0) {
      return <span className={`text-muted-foreground ${textSize}`}>—</span>;
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
        {formatLocalDate(value)}
      </span>
    );
  }

  // Text field
  if (field.field_type === "text") {
    if (!value) {
      return <span className={`text-muted-foreground ${textSize}`}>—</span>;
    }
    const isUrl = /^https?:\/\//i.test(value);
    if (isUrl) {
      return (
        <a
          href={value}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className={`inline-flex items-center gap-1 ${padding} rounded bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30 hover:bg-blue-500/25 transition-colors font-medium ${textSize} max-w-full min-w-0 overflow-hidden`}
        >
          <ExternalLink className="h-3 w-3 flex-shrink-0" />
          <span className="truncate">{value.replace(/^https?:\/\//, '')}</span>
        </a>
      );
    }
    return (
      <span className={`${textSize} break-words whitespace-normal`}>
        {value}
      </span>
    );
  }

  // Instagram field
  if (field.field_type === "instagram") {
    if (!value) {
      return <span className={`text-muted-foreground ${textSize}`}>—</span>;
    }
    // Remove @ if present and clean the handle
    const handle = value.replace(/^@/, '').trim();
    const instagramUrl = `https://instagram.com/${handle}`;
    return (
      <a
        href={instagramUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className={`inline-flex items-center gap-1 ${padding} rounded bg-pink-500/15 text-pink-600 dark:text-pink-400 border border-pink-500/30 hover:bg-pink-500/25 transition-colors font-medium ${textSize} max-w-full min-w-0 overflow-hidden`}
      >
        <Instagram className="h-3 w-3 flex-shrink-0" />
        <span className="truncate">@{handle}</span>
      </a>
    );
  }

  // Multi-Instagram field
  if (field.field_type === "multi_instagram") {
    const instagrams = Array.isArray(value) ? value : (value ? [value] : []);
    if (instagrams.length === 0) {
      return <span className={`text-muted-foreground ${textSize}`}>—</span>;
    }
    return (
      <div className="flex flex-wrap gap-1 max-w-full overflow-hidden">
        {instagrams.slice(0, 3).map((ig, index) => {
          const handle = String(ig).replace(/^@/, '').trim();
          const instagramUrl = `https://instagram.com/${handle}`;
          return (
            <div key={index} className="group inline-flex items-center max-w-[calc(100%-8px)] min-w-0">
              <a
                href={instagramUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className={`inline-flex items-center gap-1 ${padding} ${onRemoveInstagram ? 'rounded-l' : 'rounded'} bg-pink-500/15 text-pink-600 dark:text-pink-400 border border-pink-500/30 ${onRemoveInstagram ? 'border-r-0' : ''} hover:bg-pink-500/25 transition-colors font-medium ${textSize} min-w-0 overflow-hidden`}
              >
                <Instagram className="h-3 w-3 flex-shrink-0" />
                <span className="truncate">@{handle}</span>
              </a>
              {onRemoveInstagram && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    onRemoveInstagram(index);
                  }}
                  className={`flex-shrink-0 ${padding} rounded-r bg-pink-500/15 border border-pink-500/30 border-l-0 hover:bg-pink-500/30 text-pink-600 dark:text-pink-400 transition-colors`}
                  title="Remover Instagram"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          );
        })}
        {instagrams.length > 3 && (
          <span className={`inline-flex items-center ${padding} rounded bg-muted text-muted-foreground ${textSize}`}>
            +{instagrams.length - 3}
          </span>
        )}
      </div>
    );
  }

  // Location field
  if (field.field_type === "location") {
    if (!value?.formatted_address) {
      return <span className={`text-muted-foreground ${textSize}`}>—</span>;
    }
    return (
      <span className={`inline-flex items-start gap-1 ${padding} rounded bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border border-cyan-500/30 font-medium ${textSize}`}>
        <MapPin className="h-3 w-3 flex-shrink-0 mt-0.5" />
        <span className="break-words whitespace-normal">{value.formatted_address}</span>
      </span>
    );
  }

  return <span className={`text-muted-foreground ${textSize}`}>—</span>;
}
