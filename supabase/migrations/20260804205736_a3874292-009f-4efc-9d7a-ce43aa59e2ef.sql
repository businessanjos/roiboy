CREATE OR REPLACE FUNCTION public.zapp_can_transfer_sector(_auth_user_id uuid, _sector_id text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT COALESCE(public.zapp_sector_role(_auth_user_id, _sector_id), '') IN ('admin','manager','member');
$function$;