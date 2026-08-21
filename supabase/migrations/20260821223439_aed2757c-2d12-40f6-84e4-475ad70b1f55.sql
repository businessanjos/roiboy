GRANT SELECT, INSERT, UPDATE, DELETE ON public.practice_areas TO authenticated;

CREATE POLICY "CS users manage practice areas"
ON public.practice_areas
FOR ALL
TO authenticated
USING (public.user_has_sector_access(auth.uid(), 'operacoes'))
WITH CHECK (public.user_has_sector_access(auth.uid(), 'operacoes'));