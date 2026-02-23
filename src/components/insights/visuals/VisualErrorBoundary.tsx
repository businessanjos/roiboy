import { Component, ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";

interface Props {
  title?: string;
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class VisualErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <Card className="h-full flex flex-col">
          <CardHeader className="pb-2 flex-shrink-0">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-destructive" />
              {this.props.title || "Visual"}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 flex items-center justify-center">
            <p className="text-sm text-muted-foreground">
              Erro ao renderizar este visual. Tente recarregar a página.
            </p>
          </CardContent>
        </Card>
      );
    }
    return this.props.children;
  }
}
