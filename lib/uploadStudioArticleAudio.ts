import { supabase } from './supabaseClient';

export async function uploadStudioArticleAudio(file: File, articleIdOrSlug: string) {
  const ext = file.name.split('.').pop()?.toLowerCase() || 'mp3';
  const path = `${articleIdOrSlug}/${Date.now()}.${ext}`;

  const { error: upErr } = await supabase.storage
    .from('studio-articles-audio')
    .upload(path, file, {
      cacheControl: '3600',
      upsert: true,
      contentType: file.type || undefined,
    });

  if (upErr) throw upErr;

  const { data } = supabase.storage.from('studio-articles-audio').getPublicUrl(path);
  if (!data?.publicUrl) throw new Error('Could not create public URL');

  return {
    publicUrl: data.publicUrl,
    mime: file.type || null,
  };
}
