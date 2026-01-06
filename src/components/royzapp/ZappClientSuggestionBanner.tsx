import { useState, useEffect, useCallback, memo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Lightbulb, Check, X, ChevronDown, Loader2, Phone, Package } from "lucide-react";
import { toast } from "sonner";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

interface ClientSuggestion {
  id: string;
  suggested_client_id: string;
  match_type: string;
  match_score: number;
  match_details: Record<string, unknown>;
  client?: {
    id: string;
    full_name: string;
    phone_e164: string | null;
    avatar_url: string | null;
    client_products?: { product: { id: string; name: string; color?: string | null } }[];
  };
}

interface ZappClientSuggestionBannerProps {
  conversationId: string;
  accountId: string;
  onAccept: (clientId: string) => void;
  onOpenLinkDialog: () => void;
}

export const ZappClientSuggestionBanner = memo(function ZappClientSuggestionBanner({
  conversationId,
  accountId,
  onAccept,
  onOpenLinkDialog,
}: ZappClientSuggestionBannerProps) {
  const [suggestions, setSuggestions] = useState<ClientSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [showAll, setShowAll] = useState(false);

  // Fetch suggestions
  const fetchSuggestions = useCallback(async () => {
    if (!conversationId || !accountId) return;

    try {
      const { data, error } = await supabase
        .from("zapp_client_suggestions")
        .select(`
          id, suggested_client_id, match_type, match_score, match_details,
          client:clients!suggested_client_id(
            id, full_name, phone_e164, avatar_url,
            client_products(product:products(id, name, color))
          )
        `)
        .eq("zapp_conversation_id", conversationId)
        .eq("status", "pending")
        .order("match_score", { ascending: false })
        .limit(5);

      if (error) throw error;
      
      // Cast and filter out invalid entries
      const validSuggestions = (data || []).filter(s => s.client) as ClientSuggestion[];
      setSuggestions(validSuggestions);
    } catch (error) {
      console.error("Error fetching suggestions:", error);
    } finally {
      setLoading(false);
    }
  }, [conversationId, accountId]);

  useEffect(() => {
    fetchSuggestions();
  }, [fetchSuggestions]);

  // Accept suggestion
  const handleAccept = async (suggestion: ClientSuggestion) => {
    setAccepting(true);
    try {
      // Update conversation
      const { error: convError } = await supabase
        .from("zapp_conversations")
        .update({ client_id: suggestion.suggested_client_id })
        .eq("id", conversationId);

      if (convError) throw convError;

      // Mark suggestion as accepted
      await supabase
        .from("zapp_client_suggestions")
        .update({ status: "accepted" })
        .eq("id", suggestion.id);

      // Mark other suggestions as rejected
      await supabase
        .from("zapp_client_suggestions")
        .update({ status: "rejected" })
        .eq("zapp_conversation_id", conversationId)
        .eq("status", "pending")
        .neq("id", suggestion.id);

      toast.success(`Vinculado a ${suggestion.client?.full_name}`);
      onAccept(suggestion.suggested_client_id);
      setSuggestions([]);
    } catch (error: any) {
      console.error("Error accepting suggestion:", error);
      toast.error("Erro ao vincular cliente");
    } finally {
      setAccepting(false);
    }
  };

  // Reject suggestion
  const handleReject = async (suggestion: ClientSuggestion) => {
    try {
      await supabase
        .from("zapp_client_suggestions")
        .update({ status: "rejected" })
        .eq("id", suggestion.id);

      setSuggestions(prev => prev.filter(s => s.id !== suggestion.id));
    } catch (error) {
      console.error("Error rejecting suggestion:", error);
    }
  };

  // Reject all
  const handleRejectAll = async () => {
    try {
      await supabase
        .from("zapp_client_suggestions")
        .update({ status: "rejected" })
        .eq("zapp_conversation_id", conversationId)
        .eq("status", "pending");

      setSuggestions([]);
    } catch (error) {
      console.error("Error rejecting all:", error);
    }
  };

  const getInitials = (name: string) =>
    name
      .split(" ")
      .map(n => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);

  const formatPhone = (phone: string | null) => {
    if (!phone) return "";
    const digits = phone.replace(/\D/g, "");
    if (digits.length >= 12) {
      return `+${digits.slice(0, 2)} ${digits.slice(2, 4)} ${digits.slice(4, 9)}-${digits.slice(9)}`;
    }
    return phone;
  };

  const getMatchLabel = (type: string) => {
    switch (type) {
      case "name": return "Nome similar";
      case "partial_phone": return "Telefone parcial";
      case "similar_name": return "Nome parcial";
      default: return "Sugestão";
    }
  };

  if (loading || suggestions.length === 0) return null;

  const topSuggestion = suggestions[0];
  const otherSuggestions = suggestions.slice(1);

  return (
    <div className="bg-amber-500/10 border-b border-amber-500/30">
      {/* Main suggestion */}
      <div className="px-4 py-2 flex items-center gap-3">
        <Lightbulb className="h-4 w-4 text-amber-500 flex-shrink-0" />
        
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Avatar className="h-7 w-7">
            <AvatarImage src={topSuggestion.client?.avatar_url || undefined} />
            <AvatarFallback className="bg-muted text-[10px]">
              {getInitials(topSuggestion.client?.full_name || "?")}
            </AvatarFallback>
          </Avatar>
          
          <div className="min-w-0 flex-1">
            <p className="text-sm truncate">
              <span className="text-muted-foreground">Este contato pode ser </span>
              <span className="font-medium text-foreground">
                {topSuggestion.client?.full_name}
              </span>
            </p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 bg-amber-500/20 text-amber-700">
                {getMatchLabel(topSuggestion.match_type)}
              </Badge>
              {topSuggestion.client?.phone_e164 && (
                <span className="flex items-center gap-1">
                  <Phone className="h-3 w-3" />
                  {formatPhone(topSuggestion.client.phone_e164)}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-xs hover:bg-red-500/10 hover:text-red-600"
            onClick={() => handleReject(topSuggestion)}
            disabled={accepting}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="sm"
            className="h-7 px-3 text-xs bg-amber-500 hover:bg-amber-600 text-white"
            onClick={() => handleAccept(topSuggestion)}
            disabled={accepting}
          >
            {accepting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <>
                <Check className="h-3.5 w-3.5 mr-1" />
                Vincular
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Other suggestions (collapsible) */}
      {otherSuggestions.length > 0 && (
        <Collapsible open={showAll} onOpenChange={setShowAll}>
          <CollapsibleTrigger asChild>
            <button className="w-full px-4 py-1.5 text-xs text-muted-foreground hover:bg-amber-500/10 flex items-center justify-center gap-1 border-t border-amber-500/20">
              <span>Ver outras {otherSuggestions.length} sugestões</span>
              <ChevronDown className={cn("h-3 w-3 transition-transform", showAll && "rotate-180")} />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="px-4 pb-2 space-y-1.5">
              {otherSuggestions.map((suggestion) => (
                <div
                  key={suggestion.id}
                  className="flex items-center gap-2 p-2 rounded-lg bg-background/50"
                >
                  <Avatar className="h-6 w-6">
                    <AvatarImage src={suggestion.client?.avatar_url || undefined} />
                    <AvatarFallback className="bg-muted text-[9px]">
                      {getInitials(suggestion.client?.full_name || "?")}
                    </AvatarFallback>
                  </Avatar>
                  
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">
                      {suggestion.client?.full_name}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {formatPhone(suggestion.client?.phone_e164)}
                    </p>
                  </div>

                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 w-6 p-0 hover:bg-red-500/10 hover:text-red-600"
                      onClick={() => handleReject(suggestion)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 w-6 p-0 hover:bg-green-500/10 hover:text-green-600"
                      onClick={() => handleAccept(suggestion)}
                    >
                      <Check className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
              
              <div className="flex items-center justify-between pt-1">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 text-xs text-muted-foreground"
                  onClick={handleRejectAll}
                >
                  Descartar todas
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 text-xs"
                  onClick={onOpenLinkDialog}
                >
                  Buscar outro cliente
                </Button>
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
});
