import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Monitor, Apple, Chrome, CheckCircle2, Download, Smartphone, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";

export default function DownloadPage() {
  const features = [
    "Captura automática de mensagens do WhatsApp Web",
    "Detecção de participantes em Zoom e Google Meet",
    "Sincronização em tempo real com o ROY APP",
    "Funciona em segundo plano",
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      {/* Header */}
      <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/sobre" className="flex items-center gap-2">
            <img src="/roy-logo.png" alt="ROY" className="h-8 w-8" />
            <span className="font-bold text-xl">ROY APP</span>
          </Link>
          <Link to="/auth">
            <Button variant="outline">Entrar</Button>
          </Link>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12">
        {/* Hero */}
        <div className="text-center mb-12">
          <Badge variant="secondary" className="mb-4">
            <Download className="h-3 w-3 mr-1" />
            Download Gratuito
          </Badge>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Baixe o ROY APP
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Capture automaticamente engajamento de WhatsApp, Zoom e Google Meet 
            com nosso app desktop ou extensão do Chrome.
          </p>
        </div>

        {/* Download Options */}
        <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto mb-16">
          {/* Desktop App */}
          <Card className="relative overflow-hidden border-2 hover:border-primary/50 transition-colors">
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-primary/10 to-transparent rounded-bl-full" />
            <CardHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-3 rounded-xl bg-primary/10">
                  <Monitor className="h-6 w-6 text-primary" />
                </div>
                <Badge>Recomendado</Badge>
              </div>
              <CardTitle className="text-2xl">App Desktop</CardTitle>
              <CardDescription>
                Aplicativo nativo para macOS e Windows com todas as funcionalidades
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <ul className="space-y-2">
                {features.map((feature, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <div className="space-y-3">
                <a 
                  href="https://github.com/nicollaspetrworski/roiboy-app/releases/latest/download/ROY-APP-mac.dmg"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block"
                >
                  <Button className="w-full gap-2" size="lg">
                    <Apple className="h-5 w-5" />
                    Download para Mac
                  </Button>
                </a>
                <a 
                  href="https://github.com/nicollaspetrworski/roiboy-app/releases/latest/download/ROY-APP-win.exe"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block"
                >
                  <Button variant="outline" className="w-full gap-2" size="lg">
                    <Monitor className="h-5 w-5" />
                    Download para Windows
                  </Button>
                </a>
              </div>

              <p className="text-xs text-muted-foreground text-center">
                Versão 1.0.0 • Requer macOS 10.15+ ou Windows 10+
              </p>
            </CardContent>
          </Card>

          {/* Chrome Extension */}
          <Card className="relative overflow-hidden border-2 hover:border-primary/50 transition-colors">
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-blue-500/10 to-transparent rounded-bl-full" />
            <CardHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-3 rounded-xl bg-blue-500/10">
                  <Chrome className="h-6 w-6 text-blue-500" />
                </div>
                <Badge variant="outline">Leve</Badge>
              </div>
              <CardTitle className="text-2xl">Extensão Chrome</CardTitle>
              <CardDescription>
                Extensão leve para navegador, funciona diretamente no Chrome
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <ul className="space-y-2">
                {features.map((feature, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <div className="space-y-3">
                <a 
                  href="https://chrome.google.com/webstore/detail/roi-boy-captura-de-engaja/ndlhaeafgjdgjnakicpeoamemidnglpe"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block"
                >
                  <Button className="w-full gap-2 bg-blue-600 hover:bg-blue-700" size="lg">
                    <Chrome className="h-5 w-5" />
                    Adicionar ao Chrome
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </a>
                <p className="text-sm text-muted-foreground text-center">
                  ou instale manualmente:
                </p>
                <a 
                  href="https://github.com/nicollaspetrworski/roiboy-app/releases/latest/download/extension.zip"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block"
                >
                  <Button variant="outline" className="w-full gap-2" size="lg">
                    <Download className="h-5 w-5" />
                    Baixar Extensão (.zip)
                  </Button>
                </a>
              </div>

              <p className="text-xs text-muted-foreground text-center">
                Versão 1.0.0 • Chrome, Edge ou Brave
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Installation Instructions */}
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-8">Como Instalar</h2>
          
          <div className="grid md:grid-cols-2 gap-8">
            {/* Mac Instructions */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Apple className="h-5 w-5" />
                <h3 className="font-semibold">macOS</h3>
              </div>
              <ol className="space-y-3 text-sm text-muted-foreground">
                <li className="flex gap-3">
                  <span className="font-bold text-foreground">1.</span>
                  Baixe o arquivo .dmg
                </li>
                <li className="flex gap-3">
                  <span className="font-bold text-foreground">2.</span>
                  Abra o arquivo e arraste o ROY APP para Applications
                </li>
                <li className="flex gap-3">
                  <span className="font-bold text-foreground">3.</span>
                  Na primeira execução, clique com botão direito → Abrir
                </li>
                <li className="flex gap-3">
                  <span className="font-bold text-foreground">4.</span>
                  Permita acesso ao microfone nas configurações do sistema
                </li>
              </ol>
            </div>

            {/* Chrome Instructions */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Chrome className="h-5 w-5" />
                <h3 className="font-semibold">Extensão Manual</h3>
              </div>
              <ol className="space-y-3 text-sm text-muted-foreground">
                <li className="flex gap-3">
                  <span className="font-bold text-foreground">1.</span>
                  Baixe e extraia o arquivo .zip
                </li>
                <li className="flex gap-3">
                  <span className="font-bold text-foreground">2.</span>
                  Acesse chrome://extensions no navegador
                </li>
                <li className="flex gap-3">
                  <span className="font-bold text-foreground">3.</span>
                  Ative o "Modo do desenvolvedor" no canto superior
                </li>
                <li className="flex gap-3">
                  <span className="font-bold text-foreground">4.</span>
                  Clique em "Carregar sem compactação" e selecione a pasta
                </li>
              </ol>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="text-center mt-16 p-8 rounded-2xl bg-primary/5 border max-w-2xl mx-auto">
          <Smartphone className="h-12 w-12 mx-auto mb-4 text-primary" />
          <h3 className="text-xl font-bold mb-2">Ainda não tem uma conta?</h3>
          <p className="text-muted-foreground mb-4">
            Crie sua conta gratuita para começar a capturar engajamento
          </p>
          <Link to="/auth">
            <Button size="lg">Criar Conta Grátis</Button>
          </Link>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t mt-16 py-8">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>© 2024 ROY APP. Todos os direitos reservados.</p>
          <div className="flex justify-center gap-4 mt-2">
            <Link to="/termos" className="hover:text-foreground">Termos de Uso</Link>
            <Link to="/privacidade" className="hover:text-foreground">Privacidade</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
