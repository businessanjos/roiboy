import { createClient } from 'npm:@supabase/supabase-js@2';
import { fetchContentArchive, archivePrompt } from './contentArchive.ts';
import { buildKnowledgeBlock } from './aiKnowledge.ts';

export async function buildContentArchiveContext(req: Request, query = '') {
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_ANON_KEY');
  const authorization = req.headers.get('Authorization');
  if (!url || !key || !authorization) throw new Error('Sessão necessária para consultar os conteúdos.');
  const client = createClient(url, key, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } });
  const { data: auth, error } = await client.auth.getUser();
  if (error || !auth.user) throw new Error('Sessão inválida.');
  const { data: user, error: userError } = await client.from('users').select('account_id').eq('auth_user_id', auth.user.id).maybeSingle();
  if (userError || !user?.account_id) throw new Error('Conta não encontrada.');
  const [posts, knowledge] = await Promise.all([fetchContentArchive(client, user.account_id), buildKnowledgeBlock(req)]);
  return archivePrompt(posts, query) + knowledge;
}