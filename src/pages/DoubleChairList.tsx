import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ArrowLeft, Link2, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface Pair {
  id: string;
  primary_client_id: string;
  related_client_id: string;
  relationship_label: string | null;
  primary_client: { id: string; full_name: string } | null;
  related_client: { id: string; full_name: string } | null;
}

export default function DoubleChairList() {
  const { currentUser } = useCurrentUser();
  const accountId = currentUser?.account_id;

  const { data: pairs = [], isLoading } = useQuery({
    queryKey: ["double-chair-list", accountId],
    queryFn: async () => {
      if (!accountId) return [];
      const { data, error } = await supabase
        .from("client_relationships")
        .select(`
          id,
          primary_client_id,
          related_client_id,
          relationship_label,
          primary_client:clients!client_relationships_primary_client_id_fkey(id, full_name),
          related_client:clients!client_relationships_related_client_id_fkey(id, full_name)
        `)
        .eq("account_id", accountId)
        .eq("sync_data", true)
        .eq("is_active", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Pair[];
    },
    enabled: !!accountId,
  });

  return (
    <div className="container mx-auto p-6 space-y-4 max-w-4xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/dashboard">
            <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5 text-pink-500" />
            Cadeira Dupla
            <Badge variant="secondary" className="ml-2">{pairs.length}</Badge>
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Pares de clientes vinculados com compartilhamento de dados ativo. Cada par conta como 1 cadeira dupla.
          </p>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : pairs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="h-10 w-10 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Nenhuma cadeira dupla cadastrada.</p>
            </div>
          ) : (
            <div className="divide-y">
              {pairs.map((p) => (
                <div key={p.id} className="py-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    {p.primary_client ? (
                      <Link
                        to={`/clients/${p.primary_client.id}`}
                        className="font-semibold text-foreground hover:underline"
                      >
                        {p.primary_client.full_name}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                    <Link2 className="h-4 w-4 text-pink-500" />
                    {p.related_client ? (
                      <Link
                        to={`/clients/${p.related_client.id}`}
                        className="font-semibold text-foreground hover:underline"
                      >
                        {p.related_client.full_name}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </div>
                  {p.relationship_label && (
                    <Badge variant="outline" className="text-xs">{p.relationship_label}</Badge>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
