import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  User,
  Lock,
  Save,
  Upload,
  Trash2,
  Image as ImageIcon,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { Profile } from '../../../types';
import { supabase, isSupabaseConfigured } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';
import { toast } from '../../ui/Toast';
import { getInitials } from '../../../lib/utils';
import {
  avatarStorageService,
  validateAvatarFile,
} from '../../../services/avatarStorage.service';

interface AdminEditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: Profile | null;
  userEmail?: string;
  onSaved: (updatedName: string, avatarUrl: string) => void;
}

export const AdminEditProfileModal: React.FC<AdminEditProfileModalProps> = ({
  isOpen,
  onClose,
  profile,
  userEmail,
  onSaved,
}) => {
  const { refreshProfile } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState<string>('');
  const [currentAvatarUrl, setCurrentAvatarUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>('');

  // Sync state whenever modal opens or profile changes
  useEffect(() => {
    if (isOpen) {
      const initialName = profile?.full_name || profile?.name || 'Administrator';
      const initialAvatar = profile?.avatar_url || null;
      setName(initialName);
      setCurrentAvatarUrl(initialAvatar);
      setSelectedFile(null);
      setPreviewUrl(initialAvatar);
      setIsDragging(false);
      setSaving(false);
      setStatusMessage('');
    }
  }, [isOpen, profile]);

  // Clean up object URLs to prevent memory leaks
  useEffect(() => {
    return () => {
      if (previewUrl && previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  if (!isOpen) return null;

  const handleFileChange = (file: File) => {
    const validation = validateAvatarFile(file);
    if (!validation.valid) {
      toast.error(validation.error || 'File tidak valid.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    // Revoke previous blob URL if exists
    if (previewUrl && previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl);
    }

    const objectUrl = URL.createObjectURL(file);
    setSelectedFile(file);
    setPreviewUrl(objectUrl);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileChange(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileChange(file);
    }
  };

  const handleRemovePhoto = () => {
    if (previewUrl && previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl);
    }
    setSelectedFile(null);
    setPreviewUrl(null);
    setCurrentAvatarUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.id) {
      toast.error('Data profil tidak ditemukan.');
      return;
    }

    const cleanName = name.trim() || 'Administrator';
    setSaving(true);
    setStatusMessage('Menyimpan perubahan profil...');

    try {
      let finalAvatarUrl: string | null = currentAvatarUrl;
      let newUploadedUrl: string | null = null;

      // 1. Upload new photo to Supabase Storage if file was selected
      if (selectedFile) {
        setStatusMessage('Mengunggah foto profil...');
        const uploadResult = await avatarStorageService.uploadAvatar(
          profile.id,
          selectedFile,
          profile.avatar_url
        );

        if (uploadResult.error || !uploadResult.publicUrl) {
          throw new Error(uploadResult.error || 'Gagal mengunggah foto. Silakan coba lagi.');
        }

        finalAvatarUrl = uploadResult.publicUrl;
        newUploadedUrl = uploadResult.publicUrl;
      } else if (previewUrl === null && profile.avatar_url) {
        // User clicked Remove Photo
        finalAvatarUrl = null;
        if (isSupabaseConfigured()) {
          avatarStorageService.deleteOldAvatar(profile.avatar_url).catch(() => {});
        }
      }

      // 2. Persist updated full_name and avatar_url to public.profiles
      setStatusMessage('Menyimpan data profil...');
      if (isSupabaseConfigured()) {
        const { error } = await supabase
          .from('profiles')
          .update({
            full_name: cleanName,
            avatar_url: finalAvatarUrl,
            updated_at: new Date().toISOString(),
          })
          .eq('id', profile.id);

        if (error) {
          if (newUploadedUrl) {
            avatarStorageService.deleteOldAvatar(newUploadedUrl).catch(() => {});
          }
          throw error;
        }
      }

      // 3. Update cached profile and global context state
      try {
        await refreshProfile();
      } catch (refreshErr) {
        console.warn('Profile refresh notice:', refreshErr);
      }

      toast.success('Profil administrator berhasil diperbarui.');
      onSaved(cleanName, finalAvatarUrl || '');
      onClose();
    } catch (err: any) {
      console.error('Error updating admin profile:', err);
      toast.error(err.message || 'Gagal menyimpan perubahan profil.');
    } finally {
      setSaving(false);
      setStatusMessage('');
    }
  };

  const displayName = name || 'Administrator';
  const hasAvatar = Boolean(previewUrl);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-lg w-full max-h-[92vh] overflow-y-auto shadow-2xl border border-slate-200">
        {/* Modal Header */}
        <div className="p-6 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white/95 backdrop-blur-xs z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Ubah Profil Administrator</h3>
              <p className="text-2xs text-slate-500">
                Perbarui nama tampilan dan foto profil akun administrator Anda
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* SECTION: Foto Profil Direct File Upload */}
          <div className="space-y-3">
            <label className="block text-xs font-bold text-slate-700">
              Foto Profil
            </label>

            {/* Hidden native file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleInputChange}
              className="hidden"
            />

            {/* Drag & Drop / Upload Card */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`p-5 rounded-2xl border-2 transition-all flex flex-col items-center justify-center text-center ${
                isDragging
                  ? 'border-blue-500 bg-blue-50/50'
                  : 'border-dashed border-slate-200 bg-slate-50/70 hover:bg-slate-50 hover:border-slate-300'
              }`}
            >
              {/* Circular Avatar Preview (1:1 aspect ratio, object-fit cover) */}
              <div className="relative mb-3.5 group">
                {hasAvatar ? (
                  <img
                    src={previewUrl!}
                    alt={displayName}
                    className="w-20 h-20 rounded-full object-cover ring-4 ring-white shadow-md border border-slate-200"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="w-20 h-20 rounded-full bg-linear-to-br from-blue-600 to-indigo-700 text-white font-bold text-2xl flex items-center justify-center ring-4 ring-white shadow-md">
                    {getInitials(displayName)}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 flex-wrap justify-center mb-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 transition-colors cursor-pointer disabled:opacity-50"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>{hasAvatar ? 'Ganti Foto' : 'Pilih Foto'}</span>
                </button>

                {hasAvatar && (
                  <button
                    type="button"
                    onClick={handleRemovePhoto}
                    disabled={saving}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Hapus Foto</span>
                  </button>
                )}
              </div>

              <p className="text-3xs text-slate-500 font-medium">
                JPG, PNG, atau WEBP • Maks. 2 MB
              </p>
              <p className="text-3xs text-slate-400 mt-0.5 hidden sm:block">
                atau seret & lepas file foto langsung ke area ini
              </p>
            </div>
          </div>

          {/* SECTION: Editable Display Name */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Nama Lengkap / Tampilan
            </label>
            <div className="relative">
              <User className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                required
                disabled={saving}
                placeholder="Nama Lengkap Administrator"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full pl-9 pr-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-800 transition-all font-medium disabled:opacity-60"
              />
            </div>
          </div>

          {/* SECTION: Locked System Data Notice (READ ONLY) */}
          <div className="p-3.5 rounded-2xl bg-blue-50/60 border border-blue-100 space-y-2 text-xs">
            <div className="flex items-center gap-1.5 font-bold text-blue-900 text-2xs">
              <Lock className="w-3.5 h-3.5 text-blue-600" />
              <span>Informasi Akses Sistem Terkunci</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-2xs">
              <div className="bg-white/80 p-2 rounded-xl border border-blue-100">
                <span className="text-3xs text-slate-400 block font-bold">Email Login</span>
                <span className="font-mono text-slate-800 truncate block mt-0.5">{userEmail || '—'}</span>
              </div>
              <div className="bg-white/80 p-2 rounded-xl border border-blue-100">
                <span className="text-3xs text-slate-400 block font-bold">Role Akses</span>
                <span className="font-bold text-blue-700 block mt-0.5">ADMIN</span>
              </div>
            </div>
            <p className="text-3xs text-slate-500">
              * Perubahan hak akses peran (Role) hanya dapat dikelola melalui menu <strong>Manajemen Akun</strong>.
            </p>
          </div>

          {/* Modal Actions */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
            <div className="text-2xs text-slate-500 font-medium truncate">
              {statusMessage && (
                <span className="inline-flex items-center gap-1.5 text-blue-600 animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />
                  {statusMessage}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer disabled:opacity-50"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
              >
                <Save className="w-4 h-4" />
                <span>{saving ? 'Menyimpan...' : 'Simpan Profil'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
