import { useMemo } from 'react';
import { Check, X, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';

interface PostQualityScoreProps {
  composition: string[];
  objective?: string;
  postType?: string;
  specialistVersion?: string;
  caption?: string;
  className?: string;
}

interface ScoreCriteria {
  name: string;
  weight: number;
  check: () => boolean;
}

export function PostQualityScore({
  composition,
  objective,
  postType,
  specialistVersion,
  caption,
  className,
}: PostQualityScoreProps) {
  const { score, classification, color, criteria } = useMemo(() => {
    const compositionLower = composition.map((c) => c.toLowerCase());

    const allCriteria: ScoreCriteria[] = [
      {
        name: 'Gancho forte',
        weight: 15,
        check: () => compositionLower.some((c) => c.includes('gancho')),
      },
      {
        name: 'CTA (Call to Action)',
        weight: 15,
        check: () => compositionLower.some((c) => c.includes('cta')),
      },
      {
        name: 'Música em alta',
        weight: 10,
        check: () => compositionLower.some((c) => c.includes('musica') || c.includes('música')),
      },
      {
        name: 'Legenda elaborada',
        weight: 10,
        check: () => compositionLower.some((c) => c.includes('legenda')),
      },
      {
        name: 'Capa chamativa',
        weight: 10,
        check: () => compositionLower.some((c) => c.includes('capa')),
      },
      {
        name: 'Duração adequada',
        weight: 10,
        check: () => compositionLower.some((c) => c.includes('duração') || c.includes('duracao')),
      },
      {
        name: 'Versão do especialista',
        weight: 10,
        check: () => !!specialistVersion,
      },
      {
        name: 'Mínimo 3 composições',
        weight: 10,
        check: () => composition.length >= 3,
      },
      {
        name: 'Mínimo 5 composições',
        weight: 10,
        check: () => composition.length >= 5,
      },
    ];

    let totalScore = 0;
    const evaluatedCriteria = allCriteria.map((c) => {
      const passed = c.check();
      if (passed) totalScore += c.weight;
      return { ...c, passed };
    });

    let classification: string;
    let color: string;

    if (totalScore >= 86) {
      classification = 'Excelente';
      color = 'text-green-500';
    } else if (totalScore >= 61) {
      classification = 'Ótimo';
      color = 'text-emerald-400';
    } else if (totalScore >= 31) {
      classification = 'Bom';
      color = 'text-yellow-500';
    } else {
      classification = 'Básico';
      color = 'text-red-500';
    }

    return {
      score: totalScore,
      classification,
      color,
      criteria: evaluatedCriteria,
    };
  }, [composition, specialistVersion]);

  const missingCriteria = criteria.filter((c) => !c.passed);
  const passedCriteria = criteria.filter((c) => c.passed);

  return (
    <div className={cn('space-y-4', className)}>
      {/* Score Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <span className="font-medium">Score de Qualidade</span>
        </div>
        <div className={cn('text-2xl font-bold', color)}>{score}%</div>
      </div>

      {/* Progress Bar */}
      <div className="space-y-2">
        <Progress
          value={score}
          className="h-3"
        />
        <p className={cn('text-sm font-medium text-center', color)}>
          {classification}
        </p>
      </div>

      {/* Criteria Checklist */}
      <div className="space-y-3">
        {/* Passed Criteria */}
        {passedCriteria.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Atendidos
            </p>
            <div className="space-y-1">
              {passedCriteria.map((c) => (
                <div
                  key={c.name}
                  className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400"
                >
                  <Check className="h-3.5 w-3.5" />
                  <span>{c.name}</span>
                  <span className="text-xs text-muted-foreground ml-auto">
                    +{c.weight}pts
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Missing Criteria */}
        {missingCriteria.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Faltando para 100%
            </p>
            <div className="space-y-1">
              {missingCriteria.map((c) => (
                <div
                  key={c.name}
                  className="flex items-center gap-2 text-sm text-muted-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                  <span>{c.name}</span>
                  <span className="text-xs ml-auto">+{c.weight}pts</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
