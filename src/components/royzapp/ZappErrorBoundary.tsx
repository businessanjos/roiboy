import { Component, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { MessageSquare, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ZappErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[ZappErrorBoundary] Caught error:", error, info);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center h-full bg-zapp-bg">
          <div className="text-center space-y-4 max-w-md px-4">
            <div className="w-20 h-20 mx-auto rounded-full bg-amber-500/10 flex items-center justify-center">
              <MessageSquare className="h-10 w-10 text-amber-500" />
            </div>
            <h2 className="text-zapp-text text-xl font-semibold">Erro temporário</h2>
            <p className="text-zapp-text-muted text-sm">
              O ROY zAPP encontrou um problema de conexão. Isso geralmente é causado por instabilidade na rede.
            </p>
            <Button
              onClick={this.handleRetry}
              className="bg-zapp-accent hover:bg-zapp-accent/90 text-white"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Tentar novamente
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
