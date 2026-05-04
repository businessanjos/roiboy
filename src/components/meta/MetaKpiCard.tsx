import { motion } from 'framer-motion';
import { Eye, Users, Repeat, MousePointer, TrendingUp, Heart, MessageCircle, Play, PlayCircle, DollarSign, Wallet, Receipt, CreditCard, Calculator, CheckCircle, UserPlus, ShoppingCart, Banknote, Layout, LucideIcon } from 'lucide-react';
import type { MetaKpi } from '@/hooks/useMetaKpiPreferences';

const iconMap: Record<string, LucideIcon> = { Eye, Users, Repeat, MousePointer, TrendingUp, Heart, MessageCircle, Play, PlayCircle, DollarSign, Wallet, Receipt, CreditCard, Calculator, CheckCircle, UserPlus, ShoppingCart, Banknote, Layout };

const colorClasses: Record<string, { bg: string; border: string; text: string }> = {
  blue: { bg: 'bg-blue-500/5', border: 'border-blue-500/20', text: 'text-blue-500' },
  emerald: { bg: 'bg-emerald-500/5', border: 'border-emerald-500/20', text: 'text-emerald-500' },
  amber: { bg: 'bg-amber-500/5', border: 'border-amber-500/20', text: 'text-amber-500' },
  purple: { bg: 'bg-purple-500/5', border: 'border-purple-500/20', text: 'text-purple-500' },
};

interface Props { kpi: MetaKpi; value: number | null | undefined; index: number; }

function formatValue(v: number | null | undefined, format: MetaKpi['format']) {
  if (v == null) return '-';
  switch (format) {
    case 'number': return v.toLocaleString('pt-BR');
    case 'currency': return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    case 'percentage': return `${v.toFixed(2)}%`;
    case 'decimal': return v.toFixed(2);
    default: return String(v);
  }
}

export function MetaKpiCard({ kpi, value, index }: Props) {
  const Icon = iconMap[kpi.icon] || Eye;
  const colors = colorClasses[kpi.color] || colorClasses.blue;
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      className={`p-4 rounded-lg ${colors.bg} border ${colors.border}`}
    >
      <div className={`flex items-center gap-2 ${colors.text} mb-2`}>
        <Icon className="w-4 h-4" />
        <span className="text-xs font-medium">{kpi.label}</span>
      </div>
      <p className="text-2xl font-bold text-foreground">{formatValue(value, kpi.format)}</p>
    </motion.div>
  );
}
