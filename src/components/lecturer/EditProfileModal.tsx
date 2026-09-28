import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  User,
  Phone,
  Building,
  Lock,
  Save,
  Upload,
  Trash2,
} from 'lucide-react';
import { Lecturer, Profile } from '../../types';
import { lecturersService } from '../../services/lecturers.service';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from '../ui/Toast';
import { getInitials } from '../../lib/utils';
import {
  avatarStorageService,
  validateAvatarFile,
} from '../../services/avatarStorage.service';

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  lecturer: Lecturer;
  profile?: Profile | null;
  onSaved: (updatedLecturer: Lecturer) => void;
}

export const EditProfileModal: React.FC<EditProfileModalProps> = ({
  isOpen,
  onClose,
  lecturer,
  profile,
  onSaved,
}) => {
  const { refreshProfile } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [phone, setPhone] = useState<string>('');
  const [expertise, setExpertise] = useState<string>('');
  const [roomOffice, setRoomOffice] = useState<string>('');
  const [currentAvatarUrl, setCurrentAvatarUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      setPhone(lecturer.phone || '');
      setExpertise(lecturer.expertise || '');
      setRoomOffice(lecturer.room_office || '');
      const initialAvatar = (lecturer as any).avatar_url || profile?.avatar_url || null;
      setCurrentAvatarUrl(initialAvatar);
      setSelectedFile(null);
      setPreviewUrl(initialAvatar);
      setIsDragging(false);
      setSaving(false);
      setStatusMessage('');
    }
  }, [isOpen, lecturer, profile]);

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
    setSaving(true);
    setStatusMessage('Menyimpan perubahan profil...');

    try {
      let finalAvatarUrl: string | null = currentAvatarUrl;

      // 1. Upload photo if selected
      if (selectedFile) {
        setStatusMessage('Mengunggah foto profil...');
        const targetUserId = profile?.id || lecturer.id;
        const uploadResult = await avatarStorageService.uploadAvatar(
          targetUserId,
          selectedFile,
          currentAvatarUrl
        );

        if (uploadResult.error || !uploadResult.publicUrl) {
          throw new Error(uploadResult.error || 'Gagal mengunggah foto. Silakan coba lagi.');
        }

        finalAvatarUrl = uploadResult.publicUrl;
      } else if (previewUrl === null && currentAvatarUrl) {
        finalAvatarUrl = null;
        if (isSupabaseConfigured()) {
          avatarStorageService.deleteOldAvatar(currentAvatarUrl).catch(() => {});
        }
      }

      // 2. Update lecturer table
      setStatusMessage('Menyimpan data dosen...');
      const updatedLecturer = await lecturersService.updateLecturerSelfProfile(lecturer.id, {
        phone: phone.trim(),
        expertise: expertise.trim(),
        room_office: roomOffice.trim(),
      });

      // 3. Update profile avatar_url
      if (profile?.id && isSupabaseConfigured()) {
        await supabase
          .from('profiles')
          .update({
            avatar_url: finalAvatarUrl,
            updated_at: new Date().toISOString(),
          })
          .eq('id', profile.id);

        try {
          await refreshProfile();
        } catch {
          // ignore
        }
      }

      toast.success('Informasi profil dan kontak berhasil diperbarui.');
      onSaved({
        ...lecturer,
        ...updatedLecturer,
        phone: phone.trim(),
        expertise: expertise.trim(),
        room_office: roomOffice.trim(),
        avatar_url: finalAvatarUrl,
      } as any);
      onClose();
    } catch (err: any) {
      console.error('Error updating lecturer profile:', err);
      toast.error(err.message || 'Gagal menyimpan perubahan kontak profil.');
    } finally {
      setSaving(false);
      setStatusMessage('');
    }
  };

  const displayName = lecturer.name || profile?.name || 'Dosen';
  const nip = lecturer.nip || '-';
  const code = lecturer.lecturer_code || lecturer.code || '-';
  const kbkName = lecturer.kbk?.name || 'Teknik Elektro';
  const hasAvatar = Boolean(previewUrl);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200">
        {/* Modal Header */}
        <div className="p-6 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white/95 backdrop-blur-xs z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Edit Profil & Kontak Dosen</h3>
              <p className="text-2xs text-slate-500">
                Perbarui foto profil, nomor kontak, dan fokus keahlian mandiri Anda
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

        {/* Modal Body / Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Section: Foto Profil Direct File Upload */}
          <div className="space-y-3">
            <label className="block text-xs font-bold text-slate-700">
              Foto Profil
            </label>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleInputChange}
              className="hidden"
            />

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
              <div className="relative mb-3.5">
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
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-colors cursor-pointer disabled:opacity-50"
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

          {/* Locked Official Academic Data Notice */}
          <div className="p-4 rounded-2xl bg-blue-50/50 border border-blue-100 space-y-3">
            <div className="flex items-center justify-between text-2xs font-bold text-blue-900">
              <div className="flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-blue-600" />
                <span>Identitas Akademik Resmi (Terkunci)</span>
              </div>
              <span className="text-3xs font-semibold text-blue-600">Dikelola Tata Usaha</span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="bg-white/80 p-2.5 rounded-xl border border-blue-100/60">
                <span className="text-3xs text-slate-400 uppercase font-bold block">Nama Lengkap</span>
                <span className="font-bold text-slate-800 text-2xs truncate block mt-0.5">{displayName}</span>
              </div>
              <div className="bg-white/80 p-2.5 rounded-xl border border-blue-100/60">
                <span className="text-3xs text-slate-400 uppercase font-bold block">NIP</span>
                <span className="font-mono font-bold text-slate-800 text-2xs block mt-0.5">{nip}</span>
              </div>
              <div className="bg-white/80 p-2.5 rounded-xl border border-blue-100/60">
                <span className="text-3xs text-slate-400 uppercase font-bold block">Kode Dosen</span>
                <span className="font-mono font-bold text-blue-700 text-2xs block mt-0.5">{code}</span>
              </div>
              <div className="bg-white/80 p-2.5 rounded-xl border border-blue-100/60">
                <span className="text-3xs text-slate-400 uppercase font-bold block">Program Studi / KBK</span>
                <span className="font-bold text-slate-800 text-2xs block mt-0.5">{kbkName}</span>
              </div>
            </div>
          </div>

          {/* Editable Fields */}
          <div className="space-y-4">
            {/* Phone */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Nomor Telepon / WhatsApp
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="+62 812-3456-7890"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full pl-9 pr-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-800 transition-all font-mono"
                />
              </div>
              <p className="text-3xs text-slate-400 mt-1">
                Nomor kontak aktif untuk koordinasi jadwal dan komunikasi jurusan.
              </p>
            </div>

            {/* Room Office */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Ruang Kantor / Ruang Dosen
              </label>
              <div className="relative">
                <Building className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Contoh: Gedung Elektro Lt. 2 Ruang Dosen 03"
                  value={roomOffice}
                  onChange={(e) => setRoomOffice(e.target.value)}
                  className="w-full pl-9 pr-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-800 transition-all"
                />
              </div>
            </div>

            {/* Expertise */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Bidang Minat Riset & Keahlian
              </label>
              <textarea
                rows={3}
                placeholder="Contoh: Sistem Kendali, Otomasi Industri, Instrumentasi, PLC, IoT, Smart Grid"
                value={expertise}
                onChange={(e) => setExpertise(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-800 transition-all resize-none"
              />
              <p className="text-3xs text-slate-400 mt-1">
                Pisahkan kata kunci keahlian dengan tanda koma (,) agar otomatis terformat menjadi tags di profil.
              </p>
            </div>
          </div>

          {/* Modal Footer */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-2.5">
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
                className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 shadow-xs transition-all flex items-center gap-2 cursor-pointer disabled:opacity-60"
              >
                <Save className="w-4 h-4" />
                <span>{saving ? 'Menyimpan...' : 'Simpan Perubahan'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
