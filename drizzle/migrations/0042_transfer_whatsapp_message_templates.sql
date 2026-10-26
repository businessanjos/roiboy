ALTER TABLE public.sales_transfer_whatsapp_settings
  ADD COLUMN IF NOT EXISTS private_message_template text,
  ADD COLUMN IF NOT EXISTS group_message_template text;
COMMENT ON COLUMN public.sales_transfer_whatsapp_settings.private_message_template IS 'Account message template for private transfer notices. NULL uses the standard message.';
COMMENT ON COLUMN public.sales_transfer_whatsapp_settings.group_message_template IS 'Account message template for group transfer notices. NULL uses the standard message.';