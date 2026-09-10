import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Bot, CheckCircle2, Copy, Info, LockKeyhole, MessageSquare, SearchCheck } from "lucide-react";

const MCP_AREAS = [
  "Vendas e metas",
  "Telefonia",
  "RoyZapp",
  "Clientes e contratos",
  "Customer Success",
  "Financeiro",
  "RH",
  "Marketing",
  "Eventos",
  "Produtos e atividades",
  "Auditoria gerencial",
];

export function McpConnectionTab() {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? "";
  const mcpUrl = supabaseUrl ? `${supabaseUrl.replace(/\/$/, "")}/functions/v1/mcp` : "";

  const copyLink = () => {
    if (!mcpUrl) return;
    navigator.clipboard.writeText(mcpUrl);
    setCopied(true);
    toast({ title: "Link MCP copiado!" });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Bot className="h-6 w-6 text-primary" />
              </div>
              <div>
                <CardTitle>MCP do ROY</CardTitle>
                <CardDescription>
                  Conecte o Claude ou o ChatGPT ao ROY para analisar as áreas liberadas para sua conta.
                </CardDescription>
              </div>
            </div>
            <Badge variant="default" className="gap-1 shrink-0">
              <CheckCircle2 className="h-3 w-3" />
              Pronto
            </Badge>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <SearchCheck className="h-4 w-4 text-primary" />
              <p className="text-sm font-medium">Áreas disponíveis para análise</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {MCP_AREAS.map((area) => (
                <Badge key={area} variant="secondary" className="font-normal">{area}</Badge>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="space-y-1 flex-1 min-w-0">
                <p className="text-sm font-medium">Link do servidor MCP</p>
                <Input value={mcpUrl || "Publicar o app para gerar o link"} readOnly className="font-mono text-sm" />
              </div>
              <Button
                variant="outline"
                onClick={copyLink}
                disabled={!mcpUrl}
                className="shrink-0"
              >
                {copied ? (
                  <><CheckCircle2 className="h-4 w-4 mr-2" />Copiado</>
                ) : (
                  <><Copy className="h-4 w-4 mr-2" />Copiar link</>
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Use este mesmo endereço no Claude ou no ChatGPT.
            </p>
          </div>

          <Tabs defaultValue="claude" className="space-y-4">
            <TabsList className="grid h-auto w-full grid-cols-2 sm:w-[360px]">
              <TabsTrigger value="claude" className="gap-2">
                <Bot className="h-4 w-4" /> Claude
              </TabsTrigger>
              <TabsTrigger value="chatgpt" className="gap-2">
                <MessageSquare className="h-4 w-4" /> ChatGPT
              </TabsTrigger>
            </TabsList>

            <TabsContent value="claude" className="rounded-lg border border-border p-4">
              <ConnectionSteps
                title="Conectar no Claude"
                steps={[
                  <>Clique em <strong>Copiar link</strong> acima.</>,
                  <>No Claude, abra <strong>Configurações → Conectores</strong>.</>,
                  <>Escolha <strong>Adicionar conector personalizado</strong> e cole o link do ROY.</>,
                  <>Faça login com sua conta do ROY e clique em <strong>Autorizar</strong>.</>,
                  <>Abra uma nova conversa e confirme que as ferramentas do ROY estão habilitadas.</>,
                ]}
              />
            </TabsContent>

            <TabsContent value="chatgpt" className="rounded-lg border border-border p-4">
              <ConnectionSteps
                title="Conectar no ChatGPT"
                steps={[
                  <>Clique em <strong>Copiar link</strong> acima.</>,
                  <>No ChatGPT, abra <strong>Configurações → Conectores</strong>.</>,
                  <>Ative o <strong>Modo de desenvolvedor</strong> e escolha <strong>Criar</strong>.</>,
                  <>Informe o nome <strong>ROY ETERNUM</strong>, cole o link e conclua a autenticação.</>,
                  <>Em uma nova conversa, abra as ferramentas e selecione o conector do ROY.</>,
                ]}
              />
            </TabsContent>
          </Tabs>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
              <LockKeyhole className="h-5 w-5 shrink-0 text-primary" />
              <p>Cada pessoa conecta sua própria conta. Claude e ChatGPT só enxergam os dados já liberados para ela no ROY.</p>
            </div>
            <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
              <Info className="h-5 w-5 shrink-0 text-primary" />
              <p>O acesso é somente para consulta e análise. O Claude não cria, altera ou exclui nenhum registro.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ConnectionSteps({ title, steps }: { title: string; steps: React.ReactNode[] }) {
  return (
    <div className="space-y-3">
      <p className="text-sm font-medium">{title}</p>
      <ol className="space-y-3 text-sm text-muted-foreground">
        {steps.map((step, index) => (
          <li key={index} className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
              {index + 1}
            </span>
            <span>{step}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
