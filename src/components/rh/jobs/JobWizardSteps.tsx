import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { JOB_WIZARD_STEPS } from "@/constants/jobOptions";

interface JobWizardStepsProps {
  currentStep: number;
  onStepClick?: (step: number) => void;
  completedSteps?: number[];
  allowAllSteps?: boolean;
}

export function JobWizardSteps({ currentStep, onStepClick, completedSteps = [], allowAllSteps = false }: JobWizardStepsProps) {
  const progress = ((currentStep - 1) / (JOB_WIZARD_STEPS.length - 1)) * 100;

  return (
    <div className="w-full">
      <div className="relative mb-8">
        <div className="absolute top-4 left-0 right-0 h-0.5 bg-muted" />
        <div className="absolute top-4 left-0 h-0.5 bg-primary transition-all duration-300" style={{ width: `${progress}%` }} />
        <div className="relative flex justify-between">
          {JOB_WIZARD_STEPS.map((step) => {
            const isCompleted = completedSteps.includes(step.id);
            const isCurrent = currentStep === step.id;
            const isPast = step.id < currentStep;
            const isClickable = onStepClick && (allowAllSteps || isCompleted || isPast || isCurrent);

            return (
              <button
                key={step.id}
                type="button"
                onClick={() => isClickable && onStepClick?.(step.id)}
                disabled={!isClickable}
                className={cn("flex flex-col items-center gap-2 group", isClickable && "cursor-pointer")}
              >
                <div className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all border-2",
                  (isCurrent || isCompleted || isPast) && "border-primary bg-primary text-primary-foreground",
                  !isCurrent && !isCompleted && !isPast && "border-muted bg-background text-muted-foreground"
                )}>
                  {isCompleted ? <Check className="h-4 w-4" /> : step.id}
                </div>
                <div className="hidden sm:flex flex-col items-center">
                  <span className={cn("text-sm font-medium", isCurrent ? "text-foreground" : "text-muted-foreground")}>
                    {step.title}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
      <div className="sm:hidden text-center mb-4">
        <p className="text-sm text-muted-foreground">Passo {currentStep} de {JOB_WIZARD_STEPS.length}</p>
        <p className="font-medium">{JOB_WIZARD_STEPS[currentStep - 1]?.title}</p>
      </div>
    </div>
  );
}
