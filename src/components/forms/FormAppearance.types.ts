export interface FormAppearance {
  // Logo/Imagem
  logo_url?: string;
  logo_position?: 'left' | 'center' | 'right';
  
  // Cores
  background_type?: 'solid' | 'gradient';
  background_color?: string;
  gradient_start?: string;
  gradient_end?: string;
  card_background?: string;
  primary_color?: string;
  text_color?: string;
  
  // Dimensionamento
  card_width?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  border_radius?: 'none' | 'sm' | 'md' | 'lg' | 'xl';
  
  // Cabeçalho
  show_title?: boolean;
  title_alignment?: 'left' | 'center' | 'right';
  
  // Rodapé
  footer_text?: string;
  show_footer?: boolean;
}

export const DEFAULT_APPEARANCE: FormAppearance = {
  logo_url: undefined,
  logo_position: 'center',
  background_type: 'solid',
  background_color: '#f5f5f5',
  gradient_start: '#D2AE6D',
  gradient_end: '#9b8044',
  card_background: '#ffffff',
  primary_color: '#D2AE6D',
  text_color: '#1a1a1a',
  card_width: 'md',
  border_radius: 'lg',
  show_title: true,
  title_alignment: 'center',
  footer_text: 'Powered by ROY',
  show_footer: true,
};

export const THEME_PRESETS = {
  roy: {
    name: 'ROY Dourado',
    appearance: {
      background_type: 'solid' as const,
      background_color: '#1a1a1a',
      card_background: '#ffffff',
      primary_color: '#D2AE6D',
      text_color: '#1a1a1a',
    }
  },
  light: {
    name: 'Claro Minimalista',
    appearance: {
      background_type: 'solid' as const,
      background_color: '#f5f5f5',
      card_background: '#ffffff',
      primary_color: '#3b82f6',
      text_color: '#1a1a1a',
    }
  },
  dark: {
    name: 'Escuro Elegante',
    appearance: {
      background_type: 'solid' as const,
      background_color: '#1a1a1a',
      card_background: '#262626',
      primary_color: '#f5f5f5',
      text_color: '#f5f5f5',
    }
  },
  gradient_warm: {
    name: 'Gradiente Quente',
    appearance: {
      background_type: 'gradient' as const,
      gradient_start: '#D2AE6D',
      gradient_end: '#f59e0b',
      card_background: '#ffffff',
      primary_color: '#D2AE6D',
      text_color: '#1a1a1a',
    }
  },
  gradient_cool: {
    name: 'Gradiente Frio',
    appearance: {
      background_type: 'gradient' as const,
      gradient_start: '#3b82f6',
      gradient_end: '#8b5cf6',
      card_background: '#ffffff',
      primary_color: '#3b82f6',
      text_color: '#1a1a1a',
    }
  },
};

export const CARD_WIDTH_OPTIONS = {
  sm: { label: 'Pequeno', class: 'max-w-sm' },
  md: { label: 'Médio', class: 'max-w-md' },
  lg: { label: 'Grande', class: 'max-w-lg' },
  xl: { label: 'Extra Grande', class: 'max-w-xl' },
  full: { label: 'Tela Cheia', class: 'max-w-2xl' },
};

export const BORDER_RADIUS_OPTIONS = {
  none: { label: 'Sem bordas', class: 'rounded-none' },
  sm: { label: 'Pequeno', class: 'rounded-sm' },
  md: { label: 'Médio', class: 'rounded-md' },
  lg: { label: 'Grande', class: 'rounded-lg' },
  xl: { label: 'Extra Grande', class: 'rounded-xl' },
};
