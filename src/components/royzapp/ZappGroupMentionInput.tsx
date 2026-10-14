import { useState, useEffect, useRef, forwardRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { Users } from "lucide-react";

interface GroupParticipant {
  id: string;
  phone: string;
  name: string;
  isAdmin: boolean;
}

export interface MentionData {
  phone: string;
  jid: string;
  name: string;
}

interface ZappGroupMentionInputProps {
  value: string;
  onChange: (value: string) => void;
  onMentionInsert?: (mention: MentionData) => void;
  placeholder?: string;
  className?: string;
  onKeyDown?: (e: React.KeyboardEvent) => void;
  disabled?: boolean;
  groupJid: string | null;
  sectorId?: string;
  onPaste?: (e: React.ClipboardEvent<HTMLTextAreaElement>) => void;
}

const norm = (t: string) => (t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

export const ZappGroupMentionInput = forwardRef<HTMLTextAreaElement, ZappGroupMentionInputProps>(
  ({ value, onChange, onMentionInsert, placeholder, className, onKeyDown, disabled, groupJid, sectorId, onPaste }, ref) => {
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [participants, setParticipants] = useState<GroupParticipant[]>([]);
    const [filteredParticipants, setFilteredParticipants] = useState<GroupParticipant[]>([]);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [mentionQuery, setMentionQuery] = useState("");
    const [mentionStartIndex, setMentionStartIndex] = useState(-1);
    const [loadingParticipants, setLoadingParticipants] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    // Fetch group participants when groupJid changes
    useEffect(() => {
      if (!groupJid) {
        setParticipants([]);
        return;
      }

      const fetchParticipants = async () => {
        setLoadingParticipants(true);
        try {
          const { data, error } = await supabase.functions.invoke("uazapi-manager", {
            body: { 
              action: "group_participants",
              group_id: groupJid,
              sector_id: sectorId,
            },
          });

          if (error) console.warn("Could not fetch group participants:", error.message);
          const rawParticipants: any[] = error ? [] : (data?.data?.participants || data?.participants || []);

          // Nomes conhecidos: cache de participantes + remetentes de mensagens do grupo
          const known: Record<string, string> = {};
          const addKnown = (ph: any, nm: any) => {
            const d = String(ph || "").replace(/\D/g, "");
            const n = String(nm || "").trim();
            if (d.length >= 8 && n && !/^\+?\d[\d\s()-]*$/.test(n) && !known[d.slice(-8)]) known[d.slice(-8)] = n;
          };
          const sb: any = supabase;
          const { data: cached } = await sb.from("whatsapp_group_participants").select("phone, name").eq("group_jid", groupJid).limit(1000);
          (cached || []).forEach((c: any) => addKnown(c.phone, c.name));
          const { data: conv } = await sb.from("zapp_conversations").select("id").eq("group_jid", groupJid).limit(5);
          const convIds = (conv || []).map((c: any) => c.id);
          if (convIds.length) {
            const { data: msgs } = await sb.from("zapp_messages").select("sender_phone, sender_name")
              .in("zapp_conversation_id", convIds).not("sender_name", "is", null)
              .order("created_at", { ascending: false }).limit(2000);
            (msgs || []).forEach((m: any) => addKnown(m.sender_phone, m.sender_name));
          }
          if (rawParticipants.length === 0) {
            Object.entries(known).forEach(([suf, nm]) => {
              const row = (cached || []).find((c: any) => String(c.phone || "").replace(/\D/g, "").endsWith(suf));
              const ph = String(row?.phone || "").replace(/\D/g, "");
              if (ph) rawParticipants.push({ PhoneNumber: ph, DisplayName: nm });
            });
          }
          
          // Extract phone numbers for client lookup
          const phoneNumbers = rawParticipants.map((p: any) => {
            const phoneField = p.PhoneNumber || p.phoneNumber || p.phone || p.id || "";
            return phoneField.replace("@s.whatsapp.net", "").replace("@lid", "");
          }).filter(Boolean);

          // Query clients to get names - match by last 8 digits
          const sufs = phoneNumbers.map((x: string) => x.replace(/\D/g, "").slice(-8)).filter((x: string) => x.length === 8);
          const { data: clients } = sufs.length
            ? await sb.from("clients").select("phone_e164, full_name").or(sufs.map((x: string) => `phone_e164.ilike.%${x}`).join(",")).limit(500)
            : { data: [] as any[] };

          // Create phone -> name map
          const phoneToName: Record<string, string> = {};
          if (clients) {
            clients.forEach((c: any) => {
              const cleanPhone = c.phone_e164?.replace(/\D/g, "") || "";
              if (cleanPhone && c.full_name) {
                phoneToName[cleanPhone] = c.full_name;
                phoneToName[cleanPhone.slice(-8)] = c.full_name;
                phoneToName[cleanPhone.slice(-9)] = c.full_name;
              }
            });
          }
          
          const participantsList: GroupParticipant[] = rawParticipants.map((p: any) => {
            const phoneField = p.PhoneNumber || p.phoneNumber || p.phone || p.id || "";
            const phone = String(phoneField).split("@")[0].split(":")[0].replace(/\D/g, "");
            const displayName = p.DisplayName || p.displayName || p.name || p.notify || p.pushName || "";
            const isAdmin = p.IsAdmin || p.isAdmin || p.IsSuperAdmin || p.isSuperAdmin || 
                           p.admin === "admin" || p.admin === "superadmin" || false;
            
            // Try to find name from clients table
            const clientName = phoneToName[phone] || phoneToName[phone.slice(-8)] || phoneToName[phone.slice(-9)] || "";
            
            return {
              id: p.JID || p.jid || p.LID || p.lid || p.id || phone,
              phone: phone,
              name: displayName || known[phone.slice(-8)] || clientName || phone,
              isAdmin: isAdmin,
            };
          });

          setParticipants(participantsList);
        } catch (error) {
          console.error("Error fetching group participants:", error);
          setParticipants([]);
        } finally {
          setLoadingParticipants(false);
        }
      };

      fetchParticipants();
    }, [groupJid]);

    // Filter participants based on query
    useEffect(() => {
      if (!mentionQuery) {
        setFilteredParticipants(participants.slice(0, 8));
      } else {
        const query = mentionQuery.toLowerCase();
        const filtered = participants.filter(
          p => norm(p.name).includes(norm(query)) || p.phone.includes(query)
        ).slice(0, 8);
        setFilteredParticipants(filtered);
      }
      setSelectedIndex(0);
    }, [mentionQuery, participants]);

    // Detect @ mentions while typing
    useEffect(() => {
      const cursorPosition = inputRef.current?.selectionStart || value.length;
      const textBeforeCursor = value.slice(0, cursorPosition);
      const lastAtIndex = textBeforeCursor.lastIndexOf("@");

      if (lastAtIndex !== -1 && groupJid) {
        const textAfterAt = textBeforeCursor.slice(lastAtIndex + 1);
        const charBeforeAt = textBeforeCursor[lastAtIndex - 1];
        const isValidMention = lastAtIndex === 0 || charBeforeAt === " ";
        
        if (isValidMention && !textAfterAt.includes(" ")) {
          setMentionStartIndex(lastAtIndex);
          setMentionQuery(textAfterAt);
          setShowSuggestions(true);
          return;
        }
      }

      setShowSuggestions(false);
      setMentionStartIndex(-1);
    }, [value, groupJid]);

    // Handle selecting a mention
    const selectMention = useCallback((participant: GroupParticipant) => {
      const beforeMention = value.slice(0, mentionStartIndex);
      const afterMention = value.slice(mentionStartIndex + mentionQuery.length + 1);
      // Insert the name in the message text, the phone/JID is tracked separately for the API
      const newValue = `${beforeMention}@${participant.name} ${afterMention}`;
      
      onChange(newValue);
      setShowSuggestions(false);
      
      // Always build JID using phone number with @s.whatsapp.net format (not @lid)
      const jid = `${participant.phone}@s.whatsapp.net`;
      onMentionInsert?.({ phone: participant.phone, jid, name: participant.name });

      setTimeout(() => inputRef.current?.focus(), 0);
    }, [value, mentionStartIndex, mentionQuery, onChange, onMentionInsert]);

    // Handle keyboard navigation
    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (showSuggestions && filteredParticipants.length > 0) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setSelectedIndex((prev) => (prev + 1) % filteredParticipants.length);
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          setSelectedIndex((prev) => (prev - 1 + filteredParticipants.length) % filteredParticipants.length);
        } else if (e.key === "Enter" || e.key === "Tab") {
          e.preventDefault();
          selectMention(filteredParticipants[selectedIndex]);
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

    const getInitials = (name: string) => {
      return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
    };

    return (
      <div ref={containerRef} className="relative w-full flex-1">
        <textarea
          ref={(node) => {
            (inputRef as any).current = node;
            if (typeof ref === "function") {
              ref(node);
            } else if (ref) {
              ref.current = node;
            }
          }}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            // Auto-resize textarea
            const target = e.target;
            target.style.height = 'auto';
            target.style.height = `${Math.min(target.scrollHeight, 120)}px`;
          }}
          onKeyDown={handleKeyDown}
          onPaste={onPaste}
          placeholder={placeholder}
          disabled={disabled}
          rows={2}
          className={cn(
            "flex min-h-[52px] max-h-[120px] w-full rounded-lg border-0 bg-zapp-input px-4 py-2.5 text-sm text-zapp-text placeholder:text-zapp-text-muted focus-visible:outline-none focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-50 resize-none overflow-y-auto",
            className
          )}
        />

        {/* Suggestions Dropdown */}
        {showSuggestions && groupJid && (
          <div className="absolute bottom-full left-0 mb-1 w-72 bg-zapp-panel border border-zapp-border rounded-lg shadow-lg z-50 overflow-hidden">
            <div className="px-3 py-2 border-b border-zapp-border bg-zapp-panel-header">
              <div className="flex items-center gap-2 text-xs text-zapp-text-muted">
                <Users className="h-3 w-3" />
                <span>Mencionar participante</span>
                {loadingParticipants && <span className="animate-pulse">...</span>}
              </div>
            </div>
            <div className="p-1 max-h-64 overflow-y-auto">
              {filteredParticipants.length === 0 ? (
                <div className="px-3 py-4 text-center text-sm text-zapp-text-muted">
                  {loadingParticipants ? "Carregando..." : "Nenhum participante encontrado"}
                </div>
              ) : (
                filteredParticipants.map((participant, index) => (
                  <button
                    key={participant.id}
                    onClick={() => selectMention(participant)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2 rounded text-sm text-left transition-colors",
                      index === selectedIndex
                        ? "bg-zapp-accent/20 text-zapp-text"
                        : "hover:bg-zapp-hover text-zapp-text"
                    )}
                  >
                    <Avatar className="h-8 w-8 flex-shrink-0">
                      <AvatarFallback className="text-xs bg-zapp-accent/20 text-zapp-accent">
                        {getInitials(participant.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-medium">{participant.name}</span>
                        {participant.isAdmin && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-warning/20 text-warning flex-shrink-0">
                            Admin
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-zapp-text-muted truncate block">
                        +{participant.phone}
                      </span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    );
  }
);

ZappGroupMentionInput.displayName = "ZappGroupMentionInput";
