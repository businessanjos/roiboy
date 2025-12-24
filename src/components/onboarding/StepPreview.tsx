import { motion, AnimatePresence } from "framer-motion";
import { 
  User, 
  Mail, 
  Phone, 
  Package, 
  DollarSign, 
  Calendar, 
  MapPin, 
  Video,
  Building2,
  Users,
  Sparkles,
  CheckCircle
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface StepPreviewProps {
  step: number;
  data: any;
  className?: string;
}

export function StepPreview({ step, data, className }: StepPreviewProps) {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={step}
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -20 }}
        transition={{ duration: 0.3 }}
        className={cn("w-full", className)}
      >
        {step === 1 && <AccountPreview data={data} />}
        {step === 2 && <AIPreview data={data} />}
        {step === 3 && <ClientPreview data={data} />}
        {step === 4 && <ProductPreview data={data} />}
        {step === 5 && <EventPreview data={data} />}
        {step === 6 && <TeamPreview data={data} />}
      </motion.div>
    </AnimatePresence>
  );
}

function AccountPreview({ data }: { data: any }) {
  const hasData = data.accountName;

  return (
    <Card className="p-4 bg-gradient-to-br from-blue-500/5 to-blue-500/10 border-blue-500/20">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center">
          <Building2 className="h-6 w-6 text-blue-500" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Sua empresa</p>
          <motion.p 
            key={data.accountName}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="font-semibold text-lg"
          >
            {data.accountName || "Nome da Empresa"}
          </motion.p>
        </div>
      </div>

      {data.welcomeMessage && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="mt-3 p-3 rounded-lg bg-background/50 border"
        >
          <p className="text-xs text-muted-foreground mb-1">Mensagem de boas-vindas:</p>
          <p className="text-sm italic">"{data.welcomeMessage}"</p>
        </motion.div>
      )}

      <PreviewStatus filled={hasData} label="Informações básicas" />
    </Card>
  );
}

function AIPreview({ data }: { data: any }) {
  return (
    <Card className="p-4 bg-gradient-to-br from-purple-500/5 to-purple-500/10 border-purple-500/20">
      <div className="flex items-center gap-3 mb-4">
        <motion.div 
          animate={{ rotate: data.enableAI ? [0, 360] : 0 }}
          transition={{ duration: 2, repeat: data.enableAI ? Infinity : 0, ease: "linear" }}
          className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center"
        >
          <Sparkles className="h-6 w-6 text-purple-500" />
        </motion.div>
        <div>
          <p className="text-xs text-muted-foreground">Inteligência Artificial</p>
          <p className="font-semibold text-lg">
            {data.enableAI ? "Ativada" : "Desativada"}
          </p>
        </div>
      </div>

      {data.enableAI && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-2"
        >
          <FeatureItem icon="🎯" label="Detecção de ROI" />
          <FeatureItem icon="⚠️" label="Alertas de risco" />
          <FeatureItem icon="💡" label="Recomendações" />
          <FeatureItem icon="📊" label="Eventos de vida" />
        </motion.div>
      )}

      <PreviewStatus filled={true} label="Configuração de IA" />
    </Card>
  );
}

function ClientPreview({ data }: { data: any }) {
  const hasData = data.clientName && data.clientPhone;
  const initials = data.clientName
    ? data.clientName.split(" ").map((n: string) => n[0]).slice(0, 2).join("").toUpperCase()
    : "??";

  return (
    <Card className="p-4 bg-gradient-to-br from-green-500/5 to-green-500/10 border-green-500/20">
      <div className="flex items-center gap-3 mb-3">
        <Avatar className="h-12 w-12 bg-green-500/20">
          <AvatarFallback className="bg-green-500/20 text-green-700 dark:text-green-400 font-semibold">
            {initials}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <motion.p 
            key={data.clientName}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="font-semibold truncate"
          >
            {data.clientName || "Nome do Cliente"}
          </motion.p>
          <Badge variant="outline" className="text-xs bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/30">
            Ativo
          </Badge>
        </div>
      </div>

      <div className="space-y-2 text-sm">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Phone className="h-3.5 w-3.5" />
          <span>{data.clientPhone || "(00) 00000-0000"}</span>
        </div>
        {data.clientEmail && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-2 text-muted-foreground"
          >
            <Mail className="h-3.5 w-3.5" />
            <span className="truncate">{data.clientEmail}</span>
          </motion.div>
        )}
      </div>

      <PreviewStatus filled={hasData} label="Cadastro de cliente" />
    </Card>
  );
}

function ProductPreview({ data }: { data: any }) {
  const hasData = data.productName;

  return (
    <Card className="p-4 bg-gradient-to-br from-orange-500/5 to-orange-500/10 border-orange-500/20">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-12 h-12 rounded-xl bg-orange-500/20 flex items-center justify-center">
          <Package className="h-6 w-6 text-orange-500" />
        </div>
        <div className="flex-1">
          <motion.p 
            key={data.productName}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="font-semibold"
          >
            {data.productName || "Nome do Produto"}
          </motion.p>
          {data.productPrice && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center gap-1 text-green-600 dark:text-green-400 font-medium"
            >
              <DollarSign className="h-3.5 w-3.5" />
              <span>{data.productPrice}</span>
            </motion.div>
          )}
        </div>
      </div>

      {data.productDescription && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-sm text-muted-foreground line-clamp-2"
        >
          {data.productDescription}
        </motion.p>
      )}

      <PreviewStatus filled={hasData} label="Cadastro de produto" />
    </Card>
  );
}

function EventPreview({ data }: { data: any }) {
  const hasData = data.eventTitle && data.eventDate;

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "DD/MM/AAAA";
    const date = new Date(dateStr + "T00:00:00");
    return date.toLocaleDateString("pt-BR", { 
      weekday: "short", 
      day: "numeric", 
      month: "short" 
    });
  };

  return (
    <Card className="p-4 bg-gradient-to-br from-indigo-500/5 to-indigo-500/10 border-indigo-500/20">
      <div className="flex items-start gap-3 mb-3">
        <div className="w-12 h-12 rounded-xl bg-indigo-500/20 flex items-center justify-center">
          <Calendar className="h-6 w-6 text-indigo-500" />
        </div>
        <div className="flex-1">
          <motion.p 
            key={data.eventTitle}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="font-semibold"
          >
            {data.eventTitle || "Título do Evento"}
          </motion.p>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="outline" className="text-xs capitalize">
              {data.eventType || "live"}
            </Badge>
            <Badge variant="outline" className="text-xs capitalize">
              {data.eventModality === "presential" ? "Presencial" : data.eventModality === "hybrid" ? "Híbrido" : "Online"}
            </Badge>
          </div>
        </div>
      </div>

      <div className="space-y-2 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <Calendar className="h-3.5 w-3.5" />
          <span>{formatDate(data.eventDate)} {data.eventTime ? `às ${data.eventTime}` : ""}</span>
        </div>
        
        {data.eventModality !== "presential" && data.eventMeetingUrl && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-2"
          >
            <Video className="h-3.5 w-3.5" />
            <span className="truncate">{data.eventMeetingUrl}</span>
          </motion.div>
        )}
        
        {data.eventModality !== "online" && data.eventAddress && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-2"
          >
            <MapPin className="h-3.5 w-3.5" />
            <span className="truncate">{data.eventAddress}</span>
          </motion.div>
        )}
      </div>

      <PreviewStatus filled={hasData} label="Cadastro de evento" />
    </Card>
  );
}

function TeamPreview({ data }: { data: any }) {
  const emails = data.inviteEmails
    ? data.inviteEmails.split(",").map((e: string) => e.trim()).filter(Boolean)
    : [];

  return (
    <Card className="p-4 bg-gradient-to-br from-cyan-500/5 to-cyan-500/10 border-cyan-500/20">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-12 h-12 rounded-xl bg-cyan-500/20 flex items-center justify-center">
          <Users className="h-6 w-6 text-cyan-500" />
        </div>
        <div>
          <p className="font-semibold">Sua Equipe</p>
          <p className="text-sm text-muted-foreground">
            {emails.length > 0 ? `${emails.length} convite(s)` : "Nenhum convite ainda"}
          </p>
        </div>
      </div>

      {emails.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="space-y-1.5"
        >
          {emails.slice(0, 3).map((email: string, i: number) => (
            <div key={i} className="flex items-center gap-2 text-sm">
              <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center">
                <User className="h-3 w-3" />
              </div>
              <span className="text-muted-foreground truncate">{email}</span>
            </div>
          ))}
          {emails.length > 3 && (
            <p className="text-xs text-muted-foreground pl-8">
              +{emails.length - 3} mais...
            </p>
          )}
        </motion.div>
      )}

      <PreviewStatus filled={emails.length > 0} label="Convites de equipe" optional />
    </Card>
  );
}

function FeatureItem({ icon, label }: { icon: string; label: string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span>{icon}</span>
      <span className="text-muted-foreground">{label}</span>
      <CheckCircle className="h-3.5 w-3.5 text-green-500 ml-auto" />
    </div>
  );
}

function PreviewStatus({ 
  filled, 
  label, 
  optional = false 
}: { 
  filled: boolean; 
  label: string;
  optional?: boolean;
}) {
  return (
    <div className="flex items-center justify-between mt-4 pt-3 border-t border-border/50">
      <span className="text-xs text-muted-foreground">{label}</span>
      {filled ? (
        <Badge className="bg-green-500/20 text-green-700 dark:text-green-400 border-green-500/30 text-xs">
          <CheckCircle className="h-3 w-3 mr-1" />
          Preenchido
        </Badge>
      ) : (
        <Badge variant="outline" className="text-xs">
          {optional ? "Opcional" : "Pendente"}
        </Badge>
      )}
    </div>
  );
}
