import { supabase, isSupabaseConfigured } from '../lib/supabase';

export const AVATAR_BUCKET_NAME = 'profile-avatars';
export const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB
export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

export interface FileValidationResult {
  valid: boolean;
  error?: string;
}

export function validateAvatarFile(file: File): FileValidationResult {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type.toLowerCase())) {
    return {
      valid: false,
      error: 'Gunakan file JPG, PNG, atau WEBP.',
    };
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return {
      valid: false,
      error: 'Ukuran foto maksimal 2 MB.',
    };
  }

  return { valid: true };
}

export const avatarStorageService = {
  /**
   * Upload an avatar file to Supabase Storage and returns its public URL
   */
  async uploadAvatar(
    userId: string,
    file: File,
    oldAvatarUrl?: string | null
  ): Promise<{ publicUrl: string; error?: string }> {
    const validation = validateAvatarFile(file);
    if (!validation.valid) {
      return { publicUrl: '', error: validation.error };
    }

    if (!isSupabaseConfigured()) {
      // In offline/unconfigured environment, generate temporary preview URL
      const tempUrl = URL.createObjectURL(file);
      return { publicUrl: tempUrl };
    }

    try {
      const fileExt = file.name.split('.').pop()?.toLowerCase() || 'webp';
      const timestamp = Date.now();
      const filePath = `${userId}/avatar_${timestamp}.${fileExt}`;

      // Upload file to Supabase Storage
      const { data, error: uploadError } = await supabase.storage
        .from(AVATAR_BUCKET_NAME)
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true,
          contentType: file.type,
        });

      if (uploadError) {
        // Fallback try with generic 'avatars' bucket if 'profile-avatars' is not created
        const { data: fallbackData, error: fallbackError } = await supabase.storage
          .from('avatars')
          .upload(filePath, file, {
            cacheControl: '3600',
            upsert: true,
            contentType: file.type,
          });

        if (fallbackError) {
          console.error('Storage upload error:', uploadError, fallbackError);
          return {
            publicUrl: '',
            error: 'Gagal mengunggah foto. Silakan coba lagi.',
          };
        }

        const { data: urlData } = supabase.storage
          .from('avatars')
          .getPublicUrl(fallbackData.path || filePath);

        // Delete old avatar if applicable
        if (oldAvatarUrl) {
          this.deleteOldAvatar(oldAvatarUrl, 'avatars').catch(() => {});
        }

        return { publicUrl: urlData.publicUrl };
      }

      const { data: urlData } = supabase.storage
        .from(AVATAR_BUCKET_NAME)
        .getPublicUrl(data.path || filePath);

      // Clean up old avatar if exists and belongs to storage
      if (oldAvatarUrl) {
        this.deleteOldAvatar(oldAvatarUrl, AVATAR_BUCKET_NAME).catch(() => {});
      }

      return { publicUrl: urlData.publicUrl };
    } catch (err: any) {
      console.error('Unexpected avatar upload error:', err);
      return {
        publicUrl: '',
        error: err.message || 'Gagal mengunggah foto. Silakan coba lagi.',
      };
    }
  },

  /**
   * Attempts to delete old avatar file from bucket if it belongs to Supabase Storage
   */
  async deleteOldAvatar(avatarUrl: string, bucket: string = AVATAR_BUCKET_NAME): Promise<void> {
    if (!isSupabaseConfigured() || !avatarUrl) return;

    try {
      if (!avatarUrl.includes(bucket)) return;

      const parts = avatarUrl.split(`/${bucket}/`);
      if (parts.length > 1) {
        const path = parts[1].split('?')[0];
        await supabase.storage.from(bucket).remove([decodeURIComponent(path)]);
      }
    } catch (err) {
      console.warn('Notice: Could not delete old avatar file:', err);
    }
  },
};
