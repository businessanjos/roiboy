import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Copy, Check, MessageSquare, Sparkles } from "lucide-react";
import { toast } from "sonner";

interface ScriptItem {
  question: string;
  whyAsk: string;
  exampleAnswer?: string;
  followUp?: string;
}

interface ScriptBlock {
  id: string;
  title: string;
  intro: string;
  items: ScriptItem[];
}

const CHECKIN_BLOCKS: ScriptBlock[] = [
  {
    id: "abertura",
    title: "1. Abertura — quebra o gelo",
    intro: "Comece sempre humano. Nada de ir direto pro indicador.",
    items: [
      {
        question: "Oi [Nome], tudo bem? Como tá sendo a sua semana até agora?",
        whyAsk: "Mostra cuidado de pessoa pra pessoa antes de virar consultora.",
        followUp: "Que bom! / Poxa, conta mais um pouquinho do que tá pesando.",
      },
      {
        question: "Antes da gente entrar em números, queria te perguntar: como você tá se sentindo com o seu negócio nessa semana?",
        whyAsk: "Capta o emocional. É aí que mora o churn que ninguém vê.",
      },
    ],
  },
  {
    id: "evolucao",
    title: "2. Evolução — o que andou desde o último check-in",
    intro: "Você precisa saber o que mexeu pra cliente sentir que a mentoria caminha.",
    items: [
      {
        question: "Você conseguiu colocar em prática o que a gente combinou da última vez?",
        whyAsk: "Mede execução. Se não fez, descobre por quê (tempo, dúvida, medo).",
        followUp: "Se sim: o que mudou na prática? / Se não: o que travou?",
      },
      {
        question: "Quais foram as 2 ou 3 vitórias da semana, mesmo as pequenas?",
        whyAsk: "Cliente que reconhece vitória renova. Cliente que só vê problema cancela.",
      },
      {
        question: "E o que mais te frustrou? O que ficou pra trás?",
        whyAsk: "Abre espaço pra dor. Aqui aparece a real necessidade de ajuste.",
      },
    ],
  },
  {
    id: "indicadores",
    title: "3. Indicadores — números do negócio",
    intro: "Agora sim entra a parte técnica, com os dados que você acompanha.",
    items: [
      {
        question: "Como ficou seu faturamento na última semana comparado com a anterior?",
        whyAsk: "Resultado financeiro é o que sustenta a percepção de valor da mentoria.",
      },
      {
        question: "Quantas avaliações você fez? Quantas converteram em pacote?",
        whyAsk: "Mede o funil de atendimento da cliente.",
        followUp: "Se a conversão caiu: vamos olhar o discurso da avaliação juntas?",
      },
      {
        question: "Tem alguma cliente sua hoje em risco de cancelar ou pedir reembolso?",
        whyAsk: "Antecipa churn da carteira da cliente — e protege o resultado dela.",
      },
    ],
  },
  {
    id: "compromisso",
    title: "4. Compromisso — o que ela vai fazer até o próximo check-in",
    intro: "Sem combinado claro, a próxima conversa vira repetição.",
    items: [
      {
        question: "Olhando pra essa semana, qual a UMA coisa mais importante pra você executar?",
        whyAsk: "Foca a cliente. Lista de 10 ações vira 0 ações.",
      },
      {
        question: "Como eu posso te ajudar a destravar isso? Precisa de material, áudio, exemplo?",
        whyAsk: "Mostra que você entrega valor entre os check-ins, não só na call.",
      },
      {
        question: "Posso confirmar nosso próximo check-in pra [dia/horário]?",
        whyAsk: "Próxima conversa agendada na frente dela. Nunca encerre sem isso.",
      },
    ],
  },
  {
    id: "encerramento",
    title: "5. Encerramento — fechamento que gera vínculo",
    intro: "Última frase é a que mais fica. Capricha.",
    items: [
      {
        question: "Quero que você saia dessa conversa com uma frase: '[reforço positivo personalizado]'. Tá combinado?",
        whyAsk: "Fecha com afeto e reforço. Cria âncora emocional positiva da call.",
      },
      {
        question: "Qualquer coisa antes do nosso próximo check-in, me chama no WhatsApp, tá? Mesmo que seja pra desabafar.",
        whyAsk: "Comunica disponibilidade sem virar plantão 24h.",
      },
    ],
  },
];

const SPECIAL_BLOCKS: ScriptBlock[] = [
  {
    id: "risco",
    title: "Cliente em risco de cancelar",
    intro: "Quando você sente que a cliente tá frustrada e prestes a sumir.",
    items: [
      {
        question: "[Nome], senti uma energia diferente nas últimas conversas. Quero te perguntar de verdade: o que você esperava da mentoria que ainda não tá acontecendo?",
        whyAsk: "Nomeia o desconforto antes da cliente nomear sozinha. Reabre o diálogo.",
      },
      {
        question: "Se a gente fosse desenhar um plano pros próximos 30 dias só pra você se sentir no caminho de novo, o que precisaria mudar?",
        whyAsk: "Devolve protagonismo pra cliente e gera plano concreto de recuperação.",
      },
    ],
  },
  {
    id: "renovacao",
    title: "Plano de renovação (mês 9 do contrato)",
    intro: "Não é hora de vender. É hora de fazer balanço.",
    items: [
      {
        question: "A gente tá completando [X] meses juntas. Olhando pra trás, o que mudou no seu negócio nesse período?",
        whyAsk: "Faz a cliente listar resultados. É a base pro convite de renovação no mês 10.",
      },
      {
        question: "E olhando pra frente, qual o próximo nível que você quer alcançar até o fim do ano que vem?",
        whyAsk: "Cria a ponte natural: 'pra esse novo objetivo, faz sentido continuarmos'.",
      },
    ],
  },
  {
    id: "nps",
    title: "Coleta de NPS sem parecer formulário",
    intro: "NPS escondido dentro da conversa rende mais que pesquisa formal.",
    items: [
      {
        question: "De 0 a 10, o quanto você indicaria a mentoria pra uma amiga sua hoje?",
        whyAsk: "Pergunta de NPS pura. Faça olhando nos olhos, sem desviar.",
      },
      {
        question: "O que faltou pra ser um 10? (ou: o que fez ser um 10?)",
        whyAsk: "Justifica a nota e gera insumo qualitativo pro time todo.",
      },
    ],
  },
];

function ScriptCard({ item }: { item: ScriptItem }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    await navigator.clipboard.writeText(item.question);
    setCopied(true);
    toast.success("Copiado!");
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className="rounded-xl border bg-card p-4 space-y-3 hover:border-primary/40 transition-colors">
      <div className="flex items-start gap-3">
        <MessageSquare className="h-4 w-4 text-primary mt-1 flex-shrink-0" />
        <p className="flex-1 text-sm font-medium leading-relaxed">"{item.question}"</p>
        <Button
          size="sm"
          variant="ghost"
          onClick={handleCopy}
          className="h-7 px-2 flex-shrink-0"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
        </Button>
      </div>
      <div className="ml-7 space-y-1.5 text-xs text-muted-foreground">
        <p><span className="font-semibold text-foreground">Por que perguntar:</span> {item.whyAsk}</p>
        {item.followUp && (
          <p><span className="font-semibold text-foreground">Caminho seguinte:</span> {item.followUp}</p>
        )}
      </div>
    </div>
  );
}

function BlockSection({ block }: { block: ScriptBlock }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base">{block.title}</CardTitle>
            <CardDescription className="mt-1">{block.intro}</CardDescription>
          </div>
          <Badge variant="secondary">{block.items.length} perguntas</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {block.items.map((item, i) => <ScriptCard key={i} item={item} />)}
      </CardContent>
    </Card>
  );
}

export default function OperationsScripts() {
  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Sparkles className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Scripts</h1>
          <p className="text-sm text-muted-foreground">
            Beabá pronto pro check-in com a cliente. Copia, cola, adapta — e fala com naturalidade.
          </p>
        </div>
      </div>

      <Tabs defaultValue="checkin" className="space-y-4">
        <TabsList>
          <TabsTrigger value="checkin">Check-in do dia</TabsTrigger>
          <TabsTrigger value="especiais">Situações especiais</TabsTrigger>
        </TabsList>

        <TabsContent value="checkin" className="space-y-4">
          {CHECKIN_BLOCKS.map((b) => <BlockSection key={b.id} block={b} />)}
        </TabsContent>

        <TabsContent value="especiais" className="space-y-4">
          {SPECIAL_BLOCKS.map((b) => <BlockSection key={b.id} block={b} />)}
        </TabsContent>
      </Tabs>
    </div>
  );
}
