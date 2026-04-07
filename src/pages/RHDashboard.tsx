import { 
  UsersRound, Users, Brain, Star, MessageCircle, FileCheck, 
  GraduationCap, FileText, BookOpen, ClipboardList, ScrollText, 
  ArrowRight, Briefcase 
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";

const rhModules = [
  { 
    icon: UsersRound, label: "Colaboradores", route: "/rh/collaborators",
    description: "Cadastro e gestão de colaboradores",
    color: "text-rose-600", bg: "bg-rose-500/10"
  },
  { 
    icon: Users, label: "Equipes", route: "/rh/teams",
    description: "Organização e gestão de equipes",
    color: "text-blue-600", bg: "bg-blue-500/10"
  },
  { 
    icon: Brain, label: "Testes Comportamentais", route: "/rh/tests",
    description: "DISC, Big Five, Eneagrama e Temperamento",
    color: "text-violet-600", bg: "bg-violet-500/10"
  },
  { 
    icon: Star, label: "Avaliações de Desempenho", route: "/rh/performance",
    description: "Avaliações periódicas e metas",
    color: "text-amber-600", bg: "bg-amber-500/10"
  },
  { 
    icon: MessageCircle, label: "Sessões de Feedback", route: "/rh/feedback",
    description: "Feedbacks 1:1 e em grupo",
    color: "text-green-600", bg: "bg-green-500/10"
  },
  { 
    icon: FileCheck, label: "Avaliações de Candidatos", route: "/rh/evaluations",
    description: "Processo seletivo e avaliações",
    color: "text-cyan-600", bg: "bg-cyan-500/10"
  },
  { 
    icon: GraduationCap, label: "Desenvolvimento", route: "/rh/development",
    description: "Planos de desenvolvimento individual",
    color: "text-indigo-600", bg: "bg-indigo-500/10"
  },
  { 
    icon: FileText, label: "Descrição de Cargos", route: "/rh/job-descriptions",
    description: "Cargos, competências e requisitos",
    color: "text-slate-600", bg: "bg-slate-500/10"
  },
  { 
    icon: BookOpen, label: "Banco de Currículos", route: "/rh/resumes",
    description: "Gestão de currículos e candidatos",
    color: "text-orange-600", bg: "bg-orange-500/10"
  },
  { 
    icon: ClipboardList, label: "Procedimentos", route: "/rh/procedures",
    description: "Processos e procedimentos internos",
    color: "text-teal-600", bg: "bg-teal-500/10"
  },
  { 
    icon: ScrollText, label: "Scripts de Entrevista", route: "/rh/interview-scripts",
    description: "Roteiros para entrevistas",
    color: "text-pink-600", bg: "bg-pink-500/10"
  },
];

export default function RHDashboard() {
  const navigate = useNavigate();

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-rose-500/10">
          <Briefcase className="h-7 w-7 text-rose-600" strokeWidth={1.5} />
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-foreground tracking-tight">
            Recursos Humanos
          </h1>
          <p className="text-sm text-muted-foreground">
            Gestão de pessoas, testes comportamentais e desenvolvimento organizacional
          </p>
        </div>
      </div>

      {/* Module Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {rhModules.map((mod) => (
          <Card
            key={mod.route}
            className="group cursor-pointer border hover:shadow-lg hover:shadow-black/5 hover:-translate-y-0.5 transition-all duration-300"
            onClick={() => navigate(mod.route)}
          >
            <CardContent className="p-5">
              <div className="flex items-start gap-4">
                <div className={`p-2.5 rounded-lg ${mod.bg} flex-shrink-0`}>
                  <mod.icon className={`h-5 w-5 ${mod.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-foreground text-sm">{mod.label}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">{mod.description}</p>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground/0 group-hover:text-muted-foreground transition-all duration-300 flex-shrink-0 mt-1" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Coming Soon Notice */}
      <div className="text-center py-8">
        <p className="text-sm text-muted-foreground">
          Os módulos estão sendo importados do projeto <strong>Liderança Ryka</strong>. 
          Novas funcionalidades serão adicionadas progressivamente.
        </p>
      </div>
    </div>
  );
}
