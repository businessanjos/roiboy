import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentUser } from './useCurrentUser';
import { toast } from 'sonner';

export type PlaybookContentType = 'text' | 'audio' | 'image' | 'video' | 'document' | 'sticker' | 'list';

export interface PlaybookFolder {
  id: string;
  account_id: string;
  name: string;
  position: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface PlaybookItem {
  id: string;
  account_id: string;
  folder_id: string | null;
  name: string;
  content_type: PlaybookContentType;
  text_content: string | null;
  media_url: string | null;
  media_filename: string | null;
  media_size: number | null;
  media_duration: number | null;
  list_items: any[] | null;
  position: number;
  is_favorite: boolean;
  usage_count: number;
  last_used_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreatePlaybookItemInput {
  folder_id?: string | null;
  name: string;
  content_type: PlaybookContentType;
  text_content?: string | null;
  media_url?: string | null;
  media_filename?: string | null;
  media_size?: number | null;
  media_duration?: number | null;
  list_items?: any[] | null;
}

export interface CreatePlaybookFolderInput {
  name: string;
}

export interface PlaybookOptions {
  sectorId?: string | null;
}

export function usePlaybook(options: PlaybookOptions = {}) {
  const { sectorId } = options;
  const { currentUser } = useCurrentUser();
  const queryClient = useQueryClient();
  const [uploadProgress, setUploadProgress] = useState<number>(0);

  const accountId = currentUser?.account_id;

  // Fetch folders filtered by sector
  const {
    data: folders = [],
    isLoading: foldersLoading,
    refetch: refetchFolders,
  } = useQuery({
    queryKey: ['playbook-folders', accountId, sectorId],
    queryFn: async () => {
      if (!accountId) return [];
      let query = supabase
        .from('playbook_folders')
        .select('*')
        .eq('account_id', accountId);
      
      if (sectorId) {
        query = query.eq('sector_id', sectorId);
      }
      
      const { data, error } = await query.order('position', { ascending: true });
      if (error) throw error;
      return data as PlaybookFolder[];
    },
    enabled: !!accountId,
  });

  // Fetch items filtered by sector
  const {
    data: items = [],
    isLoading: itemsLoading,
    refetch: refetchItems,
  } = useQuery({
    queryKey: ['playbook-items', accountId, sectorId],
    queryFn: async () => {
      if (!accountId) return [];
      let query = supabase
        .from('playbook_items')
        .select('*')
        .eq('account_id', accountId);
      
      if (sectorId) {
        query = query.eq('sector_id', sectorId);
      }
      
      const { data, error } = await query
        .order('is_favorite', { ascending: false })
        .order('position', { ascending: true });
      if (error) throw error;
      return data as PlaybookItem[];
    },
    enabled: !!accountId,
  });

  // Create folder mutation
  const createFolderMutation = useMutation({
    mutationFn: async (input: CreatePlaybookFolderInput) => {
      if (!accountId || !currentUser?.id) throw new Error('User not authenticated');
      const maxPosition = folders.reduce((max, f) => Math.max(max, f.position), 0);
      const { data, error } = await supabase
        .from('playbook_folders')
        .insert({
          account_id: accountId,
          name: input.name,
          position: maxPosition + 1,
          created_by: currentUser.id,
          sector_id: sectorId || null,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['playbook-folders', accountId, sectorId] });
      toast.success('Pasta criada com sucesso');
    },
    onError: (error: any) => {
      toast.error('Erro ao criar pasta: ' + error.message);
    },
  });

  // Update folder mutation
  const updateFolderMutation = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const { data, error } = await supabase
        .from('playbook_folders')
        .update({ name })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['playbook-folders'] });
      toast.success('Pasta atualizada');
    },
    onError: (error: any) => {
      toast.error('Erro ao atualizar pasta: ' + error.message);
    },
  });

  // Delete folder mutation
  const deleteFolderMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('playbook_folders')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['playbook-folders'] });
      queryClient.invalidateQueries({ queryKey: ['playbook-items'] });
      toast.success('Pasta excluída');
    },
    onError: (error: any) => {
      toast.error('Erro ao excluir pasta: ' + error.message);
    },
  });

  // Create item mutation
  const createItemMutation = useMutation({
    mutationFn: async (input: CreatePlaybookItemInput) => {
      if (!accountId || !currentUser?.id) throw new Error('User not authenticated');
      const maxPosition = items
        .filter(i => i.folder_id === input.folder_id)
        .reduce((max, i) => Math.max(max, i.position), 0);
      const { data, error } = await supabase
        .from('playbook_items')
        .insert({
          account_id: accountId,
          folder_id: input.folder_id || null,
          name: input.name,
          content_type: input.content_type,
          text_content: input.text_content || null,
          media_url: input.media_url || null,
          media_filename: input.media_filename || null,
          media_size: input.media_size || null,
          media_duration: input.media_duration || null,
          list_items: input.list_items || null,
          position: maxPosition + 1,
          created_by: currentUser.id,
          sector_id: sectorId || null,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['playbook-items', accountId, sectorId] });
      toast.success('Item criado com sucesso');
    },
    onError: (error: any) => {
      toast.error('Erro ao criar item: ' + error.message);
    },
  });

  // Update item mutation
  const updateItemMutation = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<PlaybookItem> & { id: string }) => {
      const { data, error } = await supabase
        .from('playbook_items')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['playbook-items'] });
      toast.success('Item atualizado');
    },
    onError: (error: any) => {
      toast.error('Erro ao atualizar item: ' + error.message);
    },
  });

  // Delete item mutation
  const deleteItemMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('playbook_items')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['playbook-items'] });
      toast.success('Item excluído');
    },
    onError: (error: any) => {
      toast.error('Erro ao excluir item: ' + error.message);
    },
  });

  // Toggle favorite
  const toggleFavorite = useCallback(async (item: PlaybookItem) => {
    await updateItemMutation.mutateAsync({
      id: item.id,
      is_favorite: !item.is_favorite,
    });
  }, [updateItemMutation]);

  // Track usage
  const trackUsage = useCallback(async (itemId: string) => {
    const item = items.find(i => i.id === itemId);
    if (!item) return;
    await supabase
      .from('playbook_items')
      .update({
        usage_count: (item.usage_count || 0) + 1,
        last_used_at: new Date().toISOString(),
      })
      .eq('id', itemId);
    queryClient.invalidateQueries({ queryKey: ['playbook-items'] });
  }, [items, queryClient]);

  // Get MIME type from file extension as fallback
  const getMimeTypeFromExtension = useCallback((filename: string): string => {
    const ext = filename.split('.').pop()?.toLowerCase();
    const mimeMap: Record<string, string> = {
      // Audio
      mp3: 'audio/mpeg',
      m4a: 'audio/mp4',
      aac: 'audio/aac',
      ogg: 'audio/ogg',
      wav: 'audio/wav',
      webm: 'audio/webm',
      // Video
      mp4: 'video/mp4',
      mov: 'video/quicktime',
      avi: 'video/x-msvideo',
      // Images
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
      webp: 'image/webp',
      svg: 'image/svg+xml',
      // Documents
      pdf: 'application/pdf',
      doc: 'application/msword',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      xls: 'application/vnd.ms-excel',
      xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      ppt: 'application/vnd.ms-powerpoint',
      pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    };
    return mimeMap[ext || ''] || 'application/octet-stream';
  }, []);

  // Upload media file
  const uploadMedia = useCallback(async (file: File): Promise<string> => {
    if (!accountId) throw new Error('User not authenticated');
    
    console.log('[Playbook Upload] Starting upload:', {
      name: file.name,
      size: file.size,
      type: file.type,
      accountId,
    });
    
    const fileExt = file.name.split('.').pop()?.toLowerCase() || 'bin';
    const fileName = `${accountId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
    
    // Determine content type - use file.type or fallback to extension-based detection
    const contentType = file.type || getMimeTypeFromExtension(file.name);
    console.log('[Playbook Upload] Using content type:', contentType);
    
    setUploadProgress(0);
    
    const { data, error } = await supabase.storage
      .from('playbook-media')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false,
        contentType,
      });
    
    if (error) {
      console.error('[Playbook Upload] Upload error:', error);
      throw error;
    }
    
    console.log('[Playbook Upload] Upload successful:', data.path);
    
    const { data: urlData } = supabase.storage
      .from('playbook-media')
      .getPublicUrl(data.path);
    
    setUploadProgress(100);
    console.log('[Playbook Upload] Public URL:', urlData.publicUrl);
    return urlData.publicUrl;
  }, [accountId, getMimeTypeFromExtension]);

  // Delete media file
  const deleteMedia = useCallback(async (url: string) => {
    if (!url) return;
    try {
      const path = url.split('/playbook-media/')[1];
      if (path) {
        await supabase.storage.from('playbook-media').remove([path]);
      }
    } catch (e) {
      console.error('Error deleting media:', e);
    }
  }, []);

  // Replace variables in text
  const replaceVariables = useCallback((
    text: string,
    variables: Record<string, string>
  ): string => {
    let result = text;
    Object.entries(variables).forEach(([key, value]) => {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      result = result.replace(regex, value);
    });
    return result;
  }, []);

  return {
    // Data
    folders,
    items,
    isLoading: foldersLoading || itemsLoading,
    uploadProgress,

    // Folder operations
    createFolder: createFolderMutation.mutate,
    updateFolder: updateFolderMutation.mutate,
    deleteFolder: deleteFolderMutation.mutate,
    isCreatingFolder: createFolderMutation.isPending,

    // Item operations
    createItem: createItemMutation.mutate,
    createItemAsync: createItemMutation.mutateAsync,
    updateItem: updateItemMutation.mutate,
    deleteItem: deleteItemMutation.mutate,
    isCreatingItem: createItemMutation.isPending,

    // Actions
    toggleFavorite,
    trackUsage,
    uploadMedia,
    deleteMedia,
    replaceVariables,

    // Refetch
    refetch: () => {
      refetchFolders();
      refetchItems();
    },
  };
}
