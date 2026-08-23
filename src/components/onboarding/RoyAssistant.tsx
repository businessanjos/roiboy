import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, X, ChevronRight, Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";

interface RoyMessage {
  text: string;
  tips?: string[];
  emoji?: string;
}

interface RoyAssistantProps {
  step: number;
  messages: Record<number, RoyMessage>;
  onDismiss?: () => void;
  minimized?: boolean;
  onToggle?: () => void;
}

export function RoyAssistant({ 
  step, 
  messages, 
  onDismiss,
  minimized = false,
  onToggle
}: RoyAssistantProps) {
  const [isTyping, setIsTyping] = useState(true);
  const [displayedText, setDisplayedText] = useState("");
  const [showTips, setShowTips] = useState(false);
  const [currentTipIndex, setCurrentTipIndex] = useState(0);

  const currentMessage = messages[step] || { text: "Vamos continuar!", emoji: "🚀" };

  useEffect(() => {
    setIsTyping(true);
    setDisplayedText("");
    setShowTips(false);
    setCurrentTipIndex(0);

    let index = 0;
    const text = currentMessage.text;
    
    const timer = setInterval(() => {
      if (index < text.length) {
        setDisplayedText(text.slice(0, index + 1));
        index++;
      } else {
        setIsTyping(false);
        if (currentMessage.tips?.length) {
          setTimeout(() => setShowTips(true), 300);
        }
        clearInterval(timer);
      }
    }, 25);

    return () => clearInterval(timer);
  }, [step, currentMessage.text]);

  const nextTip = () => {
    if (currentMessage.tips && currentTipIndex < currentMessage.tips.length - 1) {
      setCurrentTipIndex(prev => prev + 1);
    }
  };

  if (minimized) {
    return (
      <motion.button
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        onClick={onToggle}
        className="fixed bottom-6 right-6 z-50 flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-lg hover:shadow-xl transition-shadow"
      >
        <Sparkles className="h-6 w-6" />
        <span className="absolute -top-1 -right-1 flex h-4 w-4">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
          <span className="relative inline-flex rounded-full h-4 w-4 bg-success"></span>
        </span>
      </motion.button>
    );
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={step}
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -20, scale: 0.95 }}
        transition={{ duration: 0.3 }}
        className="relative"
      >
        {/* Assistant bubble */}
        <div className="relative bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 rounded-2xl p-4 shadow-lg">
          {/* Header with avatar */}
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0">
              <motion.div 
                animate={{ 
                  rotate: isTyping ? [0, -5, 5, -5, 0] : 0 
                }}
                transition={{ 
                  repeat: isTyping ? Infinity : 0, 
                  duration: 0.5 
                }}
                className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center text-primary-foreground shadow-md"
              >
                <Sparkles className="h-5 w-5" />
              </motion.div>
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-semibold text-primary">Roy</span>
                <div className="flex items-center gap-1">
                  {onToggle && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-muted-foreground hover:text-foreground"
                      onClick={onToggle}
                    >
                      <span className="text-xs">−</span>
                    </Button>
                  )}
                  {onDismiss && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-muted-foreground hover:text-foreground"
                      onClick={onDismiss}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>
              
              <p className="text-sm text-foreground leading-relaxed">
                {currentMessage.emoji && (
                  <span className="mr-1.5">{currentMessage.emoji}</span>
                )}
                {displayedText}
                {isTyping && (
                  <motion.span
                    animate={{ opacity: [1, 0] }}
                    transition={{ repeat: Infinity, duration: 0.5 }}
                    className="inline-block w-1 h-4 bg-primary ml-0.5 align-middle"
                  />
                )}
              </p>
            </div>
          </div>

          {/* Tips section */}
          <AnimatePresence>
            {showTips && currentMessage.tips && currentMessage.tips.length > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-3 pt-3 border-t border-primary/10"
              >
                <div className="flex items-start gap-2 bg-warning/10 rounded-lg p-2.5">
                  <Lightbulb className="h-4 w-4 text-warning flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-xs font-medium text-warning-strong dark:text-warning mb-0.5">
                      Dica {currentTipIndex + 1}/{currentMessage.tips.length}
                    </p>
                    <motion.p 
                      key={currentTipIndex}
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="text-xs text-muted-foreground"
                    >
                      {currentMessage.tips[currentTipIndex]}
                    </motion.p>
                  </div>
                  {currentMessage.tips.length > 1 && currentTipIndex < currentMessage.tips.length - 1 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-warning hover:text-warning"
                      onClick={nextTip}
                    >
                      <ChevronRight className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Speech bubble arrow */}
        <div className="absolute -bottom-2 left-6 w-4 h-4 rotate-45 bg-gradient-to-br from-primary/10 to-primary/5 border-r border-b border-primary/20" />
      </motion.div>
    </AnimatePresence>
  );
}

export const ONBOARDING_MESSAGES: Record<number, RoyMessage> = {
  1: {
    text: "Olá! Eu sou o Roy, seu assistente de sucesso do cliente. Vamos configurar sua conta juntos? É rapidinho!",
    emoji: "👋",
    tips: [
      "O nome da conta aparecerá em e-mails e notificações para seus clientes.",
      "Você pode alterar essas informações depois em Configurações."
    ]
  },
  2: {
    text: "Agora vamos configurar a inteligência artificial. Ela analisa conversas para identificar oportunidades e riscos automaticamente!",
    emoji: "🤖",
    tips: [
      "A IA detecta quando clientes mencionam resultados positivos (ROI).",
      "Ela também identifica sinais de insatisfação para você agir antes do churn."
    ]
  },
  3: {
    text: "Conecte seu WhatsApp para monitorar conversas e receber análises automáticas. Esta é a principal fonte de dados do Roy!",
    emoji: "📱",
    tips: [
      "Você pode usar QR Code ou código de pareamento para conectar.",
      "As mensagens são analisadas por IA para detectar ROI e riscos.",
      "Você pode pular e conectar depois em Integrações."
    ]
  },
  4: {
    text: "Hora de cadastrar seu primeiro cliente! Esse é o começo do seu relacionamento gerenciado pelo Roy.",
    emoji: "🎯",
    tips: [
      "O WhatsApp é o canal principal de comunicação do Roy.",
      "Você pode importar clientes em massa depois via CSV.",
      "O e-mail é usado para notificações e convites para eventos."
    ]
  },
  5: {
    text: "Excelente! Agora cadastre um produto ou serviço que você oferece. Isso ajuda a organizar contratos e métricas.",
    emoji: "📦",
    tips: [
      "Produtos aparecem nos contratos e relatórios financeiros.",
      "Você pode ter múltiplos produtos com preços diferentes.",
      "Use templates prontos para começar mais rápido!"
    ]
  },
  6: {
    text: "Que tal agendar seu primeiro evento? Lives e encontros são ótimos para engajar clientes!",
    emoji: "🗓️",
    tips: [
      "Eventos geram notificações automáticas para participantes.",
      "O Roy rastreia presença e participação automaticamente.",
      "Use o check-in para controlar quem compareceu."
    ]
  },
  7: {
    text: "Última etapa! Convide sua equipe para colaborar. Quanto mais mãos, melhor o atendimento!",
    emoji: "🚀",
    tips: [
      "Membros da equipe terão acesso baseado em permissões.",
      "Você pode definir quem vê quais clientes.",
      "Convites são enviados por e-mail automaticamente."
    ]
  }
};
