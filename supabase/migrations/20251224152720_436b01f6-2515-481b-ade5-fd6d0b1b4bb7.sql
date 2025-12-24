-- Create system settings table for global configurations
CREATE TABLE public.system_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  value JSONB NOT NULL DEFAULT '{}',
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Only super admins can read/write system settings
CREATE POLICY "Super admins can manage system settings"
ON public.system_settings
FOR ALL
USING (public.is_super_admin())
WITH CHECK (public.is_super_admin());

-- Create trigger for updated_at
CREATE TRIGGER update_system_settings_updated_at
BEFORE UPDATE ON public.system_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default support whatsapp setting
INSERT INTO public.system_settings (key, value, description)
VALUES (
  'support_whatsapp',
  '{"instance_name": null, "phone": null, "status": "disconnected", "qr_code": null}'::jsonb,
  'Configuração do WhatsApp dedicado para suporte ao cliente'
);