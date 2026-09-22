import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { HeartHandshake } from "lucide-react";
import { useHRBehaviorProfiles } from "@/hooks/useHRBehaviorProfiles";
import { optionColor, PDA_CHIP_TEXT, PROFILE_OPTIONS } from "@/lib/rh/pda";

/** Cartão "Como lidar" com o conteúdo do perfil comportamental. */
export default function HowToDealCard({
  profileKey,
  title,
}: {
  profileKey?: string | null;
  title: string;
}) {
  const { byKey } = useHRBehaviorProfiles();
  const p = byKey(profileKey);

  if (!profileKey) return null;

  return (
    <Card className="bg-muted/30">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <HeartHandshake className="h-4 w-4 text-muted-foreground" />
          Como lidar · {title}
          <Badge
            className="border-0"
            style={{ backgroundColor: optionColor(PROFILE_OPTIONS, profileKey), color: PDA_CHIP_TEXT }}
          >
            {profileKey}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-xs">
        {!p ? (
          <p className="text-muted-foreground">Sem conteúdo cadastrado para este perfil.</p>
        ) : (
          <>
            {p.leadership_style && (
              <p><span className="font-medium">Estilo de liderança:</span> {p.leadership_style}</p>
            )}
            {p.motivation && <p className="text-muted-foreground">{p.motivation}</p>}
            {p.communication.length > 0 && (
              <div>
                <p className="font-medium mb-1">Como se comunicar</p>
                <ul className="list-disc pl-4 space-y-0.5 text-muted-foreground">
                  {p.communication.map((c, i) => <li key={i}>{c}</li>)}
                </ul>
              </div>
            )}
            {p.strengths && (
              <div>
                <p className="font-medium mb-0.5">Pontos fortes</p>
                <p className="text-muted-foreground">{p.strengths}</p>
              </div>
            )}
            {p.improvements && (
              <div>
                <p className="font-medium mb-0.5">A trabalhar</p>
                <p className="text-muted-foreground">{p.improvements}</p>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
