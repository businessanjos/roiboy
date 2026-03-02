import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronDown, ChevronRight, History, RefreshCw } from "lucide-react";

interface LogEntry {
  id: string;
  deal_id: string | null;
  action: string;
  status: string;
  omie_os_id: string | null;
  request_payload: any;
  response_payload: any;
  error_message: string | null;
  created_at: string;
}

export function OmieLogsTable() {
  const { currentUser } = useCurrentUser();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchLogs = async () => {
    if (!currentUser?.account_id) return;
    setLoading(true);
    const { data } = await supabase
      .from("omie_integration_logs")
      .select("*")
      .eq("account_id", currentUser.account_id)
      .order("created_at", { ascending: false })
      .limit(10);
    setLogs((data as LogEntry[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchLogs();
  }, [currentUser?.account_id]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <History className="h-5 w-5" />
            Logs de Integração
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={fetchLogs} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">Últimas 10 tentativas de criação de OS.</p>
      </CardHeader>
      <CardContent>
        {logs.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">Nenhum log encontrado.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8"></TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>OS Omie</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log) => (
                <Collapsible key={log.id} asChild open={expandedId === log.id} onOpenChange={(open) => setExpandedId(open ? log.id : null)}>
                  <>
                    <CollapsibleTrigger asChild>
                      <TableRow className="cursor-pointer hover:bg-muted/50">
                        <TableCell className="w-8 p-2">
                          {expandedId === log.id ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </TableCell>
                        <TableCell className="text-sm">
                          {format(new Date(log.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                        </TableCell>
                        <TableCell>
                          <Badge variant={log.status === "success" ? "default" : "destructive"} className="text-xs">
                            {log.status === "success" ? "Sucesso" : "Erro"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm font-mono">
                          {log.omie_os_id || "—"}
                        </TableCell>
                      </TableRow>
                    </CollapsibleTrigger>
                    <CollapsibleContent asChild>
                      <TableRow>
                        <TableCell colSpan={4} className="bg-muted/30 p-3">
                          {log.error_message && (
                            <div className="mb-2">
                              <p className="text-xs font-semibold text-destructive">Erro:</p>
                              <p className="text-xs text-destructive">{log.error_message}</p>
                            </div>
                          )}
                          {log.request_payload && (
                            <div className="mb-2">
                              <p className="text-xs font-semibold mb-1">Request:</p>
                              <pre className="text-xs bg-background rounded p-2 overflow-x-auto max-h-32">
                                {JSON.stringify(log.request_payload, null, 2)}
                              </pre>
                            </div>
                          )}
                          {log.response_payload && (
                            <div>
                              <p className="text-xs font-semibold mb-1">Response:</p>
                              <pre className="text-xs bg-background rounded p-2 overflow-x-auto max-h-32">
                                {JSON.stringify(log.response_payload, null, 2)}
                              </pre>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    </CollapsibleContent>
                  </>
                </Collapsible>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
