import { Talent } from "@/hooks/useContentHQ";
import { Card } from "@/components/ui/card";

export function ContentHQLibrary({ talent }: { talent: Talent }) {
  return (
    <Card className="p-8 text-center text-muted-foreground space-y-2">
      <h3 className="font-semibold text-foreground">Biblioteca — {talent.name}</h3>
      <p className="text-sm">Banco de hooks, CTAs, hashtags e referências por pilar. Em breve.</p>
    </Card>
  );
}
