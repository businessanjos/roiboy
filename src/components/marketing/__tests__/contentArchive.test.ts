import { describe, expect, it } from 'vitest';
import { fetchContentArchive, mergeArchivePosts, archivePrompt, type ArchivePost } from '../../../../supabase/functions/_shared/contentArchive';
const row: ArchivePost = { id: '1', platform: 'instagram', profile: '@perfil', title: '', caption: 'Legenda real', date: '2026-11-09', url: 'https://instagram.com/p/abc/', thumbnail: null, details: { likes: 79 } };
describe('content archive', () => {
  it('deduplicates source copies by publication link while retaining additional fields', () => {
    const result = mergeArchivePosts([row, { ...row, id: '2', url: 'https://www.instagram.com/p/abc/?x=1', details: { hook: 'Hook real' } }]);
    expect(result).toHaveLength(1);
    expect(result[0].details).toEqual({ likes: 79, hook: 'Hook real' });
  });
  it('provides original captions and metrics to AI with all-platform totals', () => {
    const prompt = archivePrompt([row, { ...row, id: 'yt', platform: 'youtube', url: null }]);
    expect(prompt).toContain('Legenda real');
    expect(prompt).toContain('"likes":79');
    expect(prompt).toContain('"youtube":1');
  });
  it('reads past the first 500 records without querying another account', async () => {
    const scopes: string[] = [];
    const client = { from: (table: string) => ({ select: () => ({ eq: (_: string, id: string) => { scopes.push(id); return { order: () => ({ range: async (offset: number) => ({ data: table === 'content_pieces' ? offset === 0 ? Array.from({length: 500}, (_, i) => ({ id: String(i), platform: 'instagram' })) : [{ id: '500', platform: 'instagram' }] : [], error: null }) }) }; } }) }) };
    expect(await fetchContentArchive(client, 'own-account')).toHaveLength(501);
    expect(scopes.every(s => s === 'own-account')).toBe(true);
  });
});