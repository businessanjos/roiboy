import { 
  UsersRound, Brain, Star, MessageCircle, 
  GraduationCap, FileText, BookOpen, ClipboardList, ScrollText, 
  ArrowRight, Briefcase, UserCircle, ScanFace, Target, CircleDot,
  LayoutDashboard, Network, Building, UserPlus, UserMinus,
  Palmtree, Heart, Clock, Handshake, Crown, Sparkles, type LucideIcon
} from "lucide-react";
import { useNavigate, Navigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { useCurrentUser } from "@/hooks/useCurrentUser";

interface RHModule {
  icon: LucideIcon;
  label: string;
  route: string;
  description: string;
  color: string;
  bg: string;
}

const rhGroups: { title: string; modules: RHModule[] }[] = [
  {
    title: "Meu Espaço",
    modules: [
      { icon: UserCircle, label: "Meu Perfil", route: "/rh/my-profile", description: "Seus dados e informações pessoais", color: "text-rose-600", bg: "bg-rose-500/10" },
      { icon: ScanFace, label: "Profiler", route: "/rh/profiler", description: "Perfil comportamental e competências", color: "text-violet-600", bg: "bg-violet-500/10" },
      { icon: Target, label: "Meu PDI", route: "/rh/my-pdi", description: "Plano de desenvolvimento individual", color: "text-indigo-600", bg: "bg-indigo-500/10" },
      { icon: CircleDot, label: "Minhas Avaliações", route: "/rh/my-evaluations", description: "Avaliações recebidas e pendentes", color: "text-amber-600", bg: "bg-amber-500/10" },
    ],
  },
  {
    title: "Gestão de Pessoas",
    modules: [
      { icon: UsersRound, label: "Colaboradores", route: "/rh/collaborators", description: "Cadastro e gestão de colaboradores", color: "text-blue-600", bg: "bg-blue-500/10" },
      { icon: Network, label: "Organograma", route: "/rh/org-chart", description: "Estrutura hierárquica da organização", color: "text-teal-600", bg: "bg-teal-500/10" },
      { icon: Building, label: "Departamentos", route: "/rh/departments", description: "Áreas e departamentos da empresa", color: "text-slate-600", bg: "bg-slate-500/10" },
      { icon: FileText, label: "Cargos", route: "/rh/job-descriptions", description: "Cargos, competências e requisitos", color: "text-cyan-600", bg: "bg-cyan-500/10" },
      { icon: UserPlus, label: "Vagas", route: "/rh/vacancies", description: "Vagas abertas e processo seletivo", color: "text-green-600", bg: "bg-green-500/10" },
      { icon: Sparkles, label: "Cartas-Proposta", route: "/rh/offers", description: "Crie ofertas lindas com link público compartilhável", color: "text-indigo-600", bg: "bg-indigo-500/10" },
      { icon: UserPlus, label: "Admissões", route: "/rh/admissions", description: "Pipeline pós-aceite: exame, documentos e contrato", color: "text-emerald-600", bg: "bg-emerald-500/10" },
      { icon: BookOpen, label: "Banco de Talentos", route: "/rh/resumes", description: "Currículos e candidatos potenciais", color: "text-orange-600", bg: "bg-orange-500/10" },
      { icon: UserMinus, label: "Desligamentos", route: "/rh/offboarding", description: "Processos de desligamento", color: "text-red-600", bg: "bg-red-500/10" },
      { icon: Crown, label: "Quadro Societário", route: "/rh/partners", description: "Sócios e composição societária", color: "text-primary", bg: "bg-primary/10" },
      { icon: Handshake, label: "Prestadores de Serviço", route: "/rh/service-providers", description: "Gestão de parceiros PJ", color: "text-amber-600", bg: "bg-amber-500/10" },
    ],
  },
  {
    title: "Desenvolvimento",
    modules: [
      { icon: Star, label: "Avaliação de Desempenho", route: "/rh/performance", description: "Avaliações periódicas e metas", color: "text-amber-600", bg: "bg-amber-500/10" },
      { icon: MessageCircle, label: "Feedbacks", route: "/rh/feedback", description: "Feedbacks 1:1 e em grupo", color: "text-green-600", bg: "bg-green-500/10" },
      { icon: Palmtree, label: "Gestão de Férias", route: "/rh/vacation", description: "Controle de férias e afastamentos", color: "text-emerald-600", bg: "bg-emerald-500/10" },
      { icon: Heart, label: "Cultura", route: "/rh/culture", description: "Valores, missão e cultura organizacional", color: "text-pink-600", bg: "bg-pink-500/10" },
      { icon: Clock, label: "Gestão de Ponto", route: "/rh/time-tracking", description: "Registro e controle de ponto", color: "text-slate-600", bg: "bg-slate-500/10" },
    ],
  },
  {
    title: "Extras",
    modules: [
      { icon: Brain, label: "Testes Comportamentais", route: "/rh/tests", description: "DISC, Big Five, Eneagrama e Temperamento", color: "text-violet-600", bg: "bg-violet-500/10" },
      { icon: GraduationCap, label: "Desenvolvimento", route: "/rh/development", description: "Treinamentos e capacitações", color: "text-indigo-600", bg: "bg-indigo-500/10" },
      { icon: ClipboardList, label: "Procedimentos", route: "/rh/procedures", description: "Processos e procedimentos internos", color: "text-teal-600", bg: "bg-teal-500/10" },
      { icon: ScrollText, label: "Entrevistas", route: "/rh/interview-scripts", description: "Roteiros para entrevistas", color: "text-pink-600", bg: "bg-pink-500/10" },
    ],
  },
];

const RH_ALLOWED_EMAIL = "m.quintana@me.com";

export default function RHDashboard() {
  const navigate = useNavigate();
  const { currentUser } = useCurrentUser();

  if (currentUser && currentUser.email !== RH_ALLOWED_EMAIL) {
    return <Navigate to="/" replace />;
  }
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

      {/* Groups */}
      {rhGroups.map((group) => (
        <div key={group.title} className="space-y-3">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            {group.title}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {group.modules.map((mod) => (
              <Card
                key={mod.route}
                className="group cursor-pointer border hover:shadow-lg hover:shadow-black/5 hover:-translate-y-0.5 transition-all duration-300"
                onClick={() => navigate(mod.route)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg ${mod.bg} flex-shrink-0`}>
                      <mod.icon className={`h-4 w-4 ${mod.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-foreground text-sm">{mod.label}</h3>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{mod.description}</p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground/0 group-hover:text-muted-foreground transition-all duration-300 flex-shrink-0 mt-1" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
