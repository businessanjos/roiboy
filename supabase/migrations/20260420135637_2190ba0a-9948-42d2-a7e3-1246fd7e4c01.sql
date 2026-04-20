-- 1. Adiciona colunas de controle de pagamento
ALTER TABLE public.spiff_spins
  ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS paid_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS payment_notes text;

ALTER TABLE public.spiff_spins
  DROP CONSTRAINT IF EXISTS spiff_spins_payment_status_check;

ALTER TABLE public.spiff_spins
  ADD CONSTRAINT spiff_spins_payment_status_check
  CHECK (payment_status IN ('pending', 'paid'));

CREATE INDEX IF NOT EXISTS idx_spiff_spins_payment_status
  ON public.spiff_spins (account_id, payment_status);

-- 2. Função SECURITY DEFINER que verifica se o usuário pode marcar pagamento
CREATE OR REPLACE FUNCTION public.can_manage_spiff_payments(_auth_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.users u
    LEFT JOIN public.team_roles tr ON tr.id = u.team_role_id
    WHERE u.auth_user_id = _auth_user_id
      AND (
        u.role IN ('admin', 'head', 'gestor', 'leader', 'mentor')
        OR LOWER(COALESCE(tr.area, '')) IN ('financeiro', 'finance')
        OR LOWER(COALESCE(tr.cargo, '')) IN ('financeiro', 'finance', 'cfo', 'analista financeiro')
        OR (
          LOWER(COALESCE(tr.area, '')) IN ('comercial', 'vendas', 'sales')
          AND LOWER(COALESCE(tr.seniority, '')) IN ('head', 'líder', 'lider', 'gerente', 'gestor', 'manager', 'diretor', 'director')
        )
      )
  );
$$;

-- 3. Política de UPDATE restrita
DROP POLICY IF EXISTS "Authorized roles can update spiff payments" ON public.spiff_spins;

CREATE POLICY "Authorized roles can update spiff payments"
ON public.spiff_spins
FOR UPDATE
USING (
  account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid())
  AND public.can_manage_spiff_payments(auth.uid())
)
WITH CHECK (
  account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid())
  AND public.can_manage_spiff_payments(auth.uid())
);