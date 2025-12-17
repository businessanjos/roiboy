import { useState, useEffect, useRef, forwardRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

interface User {
  id: string;
  name: string;
  avatar_url: string | null;
}

interface MentionInputProps {
  value: string;
  onChange: (value: string) => void;
  onMentionSelect?: (users: User[]) => void;
  placeholder?: string;
  className?: string;
  onKeyDown?: (e: React.KeyboardEvent) => void;
}

export const MentionInput = forwardRef<HTMLInputElement, MentionInputProps>(
  ({ value, onChange, onMentionSelect, placeholder, className, onKeyDown }, ref) => {
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [suggestions, setSuggestions] = useState<User[]>([]);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [mentionQuery, setMentionQuery] = useState("");
    const [mentionStartIndex, setMentionStartIndex] = useState(-1);
    const [mentionedUsers, setMentionedUsers] = useState<User[]>([]);
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Fetch team members for suggestions
    const fetchSuggestions = async (query: string) => {
      try {
        const { data, error } = await supabase
          .from("users")
          .select("id, name, avatar_url")
          .ilike("name", `%${query}%`)
          .limit(5);

        if (error) throw error;
        setSuggestions(data || []);
      } catch (error) {
        console.error("Error fetching suggestions:", error);
        setSuggestions([]);
      }
    };

    // Detect @ mentions while typing
    useEffect(() => {
      const cursorPosition = inputRef.current?.selectionStart || value.length;
      const textBeforeCursor = value.slice(0, cursorPosition);
      const lastAtIndex = textBeforeCursor.lastIndexOf("@");

      if (lastAtIndex !== -1) {
        const textAfterAt = textBeforeCursor.slice(lastAtIndex + 1);
        // Check if there's a space before @ (or it's at start)
        const charBeforeAt = textBeforeCursor[lastAtIndex - 1];
        const isValidMention = lastAtIndex === 0 || charBeforeAt === " ";
        
        // Check if we're still in the mention (no space after @)
        if (isValidMention && !textAfterAt.includes(" ")) {
          setMentionStartIndex(lastAtIndex);
          setMentionQuery(textAfterAt);
          setShowSuggestions(true);
          fetchSuggestions(textAfterAt);
          return;
        }
      }

      setShowSuggestions(false);
      setMentionStartIndex(-1);
    }, [value]);

    // Handle selecting a mention
    const selectMention = (user: User) => {
      const beforeMention = value.slice(0, mentionStartIndex);
      const afterMention = value.slice(mentionStartIndex + mentionQuery.length + 1);
      const newValue = `${beforeMention}@${user.name} ${afterMention}`;
      
      onChange(newValue);
      setShowSuggestions(false);
      
      // Track mentioned users
      if (!mentionedUsers.some((u) => u.id === user.id)) {
        const newMentioned = [...mentionedUsers, user];
        setMentionedUsers(newMentioned);
        onMentionSelect?.(newMentioned);
      }

      // Focus back on input
      setTimeout(() => inputRef.current?.focus(), 0);
    };

    // Handle keyboard navigation
    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (showSuggestions && suggestions.length > 0) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setSelectedIndex((prev) => (prev + 1) % suggestions.length);
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          setSelectedIndex((prev) => (prev - 1 + suggestions.length) % suggestions.length);
        } else if (e.key === "Enter" || e.key === "Tab") {
          e.preventDefault();
          selectMention(suggestions[selectedIndex]);
          return;
        } else if (e.key === "Escape") {
          setShowSuggestions(false);
        }
      }
      
      onKeyDown?.(e);
    };

    // Close suggestions when clicking outside
    useEffect(() => {
      const handleClickOutside = (e: MouseEvent) => {
        if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
          setShowSuggestions(false);
        }
      };

      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Parse mentioned users from value when it changes externally
    useEffect(() => {
      const mentions = value.match(/@(\w+(?:\s\w+)*)/g) || [];
      if (mentions.length === 0) {
        setMentionedUsers([]);
        onMentionSelect?.([]);
      }
    }, [value]);

    return (
      <div ref={containerRef} className="relative w-full">
        <input
          ref={(node) => {
            // Handle both refs
            (inputRef as any).current = node;
            if (typeof ref === "function") {
              ref(node);
            } else if (ref) {
              ref.current = node;
            }
          }}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={cn(
            "flex h-9 w-full rounded-full border-0 bg-muted/50 px-4 py-2 text-sm placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
            className
          )}
        />

        {/* Suggestions Dropdown */}
        {showSuggestions && suggestions.length > 0 && (
          <div className="absolute bottom-full left-0 mb-1 w-64 bg-popover border rounded-lg shadow-lg z-50 overflow-hidden">
            <div className="p-1">
              {suggestions.map((user, index) => (
                <button
                  key={user.id}
                  onClick={() => selectMention(user)}
                  className={cn(
                    "w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm text-left transition-colors",
                    index === selectedIndex
                      ? "bg-accent text-accent-foreground"
                      : "hover:bg-muted"
                  )}
                >
                  <Avatar className="h-6 w-6">
                    <AvatarImage src={user.avatar_url || undefined} />
                    <AvatarFallback className="text-xs">
                      {user.name?.charAt(0) || "?"}
                    </AvatarFallback>
                  </Avatar>
                  <span className="truncate">{user.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }
);

MentionInput.displayName = "MentionInput";

// Helper to extract mentioned user names from text
export function extractMentions(text: string): string[] {
  const mentions = text.match(/@([^\s@]+(?:\s[^\s@]+)*?)(?=\s@|\s|$)/g) || [];
  return mentions.map((m) => m.slice(1).trim());
}
