import React from 'react';
import { Room } from '../../types';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

interface RoomSelectorProps {
  rooms: Room[];
  selectedRoomId: string;
  onChange: (roomId: string) => void;
  expectedStudents: number;
  requiredRoomType?: string;
  disabled?: boolean;
}

export const RoomSelector: React.FC<RoomSelectorProps> = ({
  rooms,
  selectedRoomId,
  onChange,
  expectedStudents,
  requiredRoomType,
  disabled = false,
}) => {
  // Only active rooms
  const activeRooms = rooms
    .filter((r) => r.is_active)
    .sort((a, b) => a.code.localeCompare(b.code));

  const selectedRoom = activeRooms.find((r) => r.id === selectedRoomId);

  const isCapacitySufficient = selectedRoom ? selectedRoom.capacity >= expectedStudents : true;
  const isTypeMatched =
    selectedRoom && requiredRoomType
      ? (selectedRoom.room_type || '').toLowerCase().trim() === requiredRoomType.toLowerCase().trim()
      : true;

  return (
    <div className="space-y-2">
      <label className="block text-xs font-semibold text-slate-700">
        Pilih Ruangan <span className="text-rose-500">*</span>
      </label>

      <select
        value={selectedRoomId}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={`w-full px-3 py-2 text-xs border rounded-xl bg-white focus:outline-none transition-colors ${
          !isCapacitySufficient || !isTypeMatched
            ? 'border-rose-300 focus:border-rose-500 focus:ring-1 focus:ring-rose-500/20'
            : 'border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20'
        }`}
      >
        <option value="" disabled>
          -- Pilih Ruangan Kelas --
        </option>
        {activeRooms.map((room) => {
          const capOk = room.capacity >= expectedStudents;
          const typeOk = requiredRoomType
            ? (room.room_type || '').toLowerCase().trim() === requiredRoomType.toLowerCase().trim()
            : true;

          return (
            <option key={room.id} value={room.id}>
              {room.code} – {room.name} ({room.room_type || 'Teori'}, {room.capacity} kursi)
              {!capOk ? ' [Kapasitas Kurang]' : ''}
              {!typeOk ? ' [Tipe Beda]' : ''}
            </option>
          );
        })}
      </select>

      {/* Selected room validation badges */}
      {selectedRoom && (
        <div className="flex flex-wrap gap-2 text-3xs mt-1">
          {isCapacitySufficient ? (
            <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
              Kapasitas mencukupi ({selectedRoom.capacity} kursi vs {expectedStudents} peserta)
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200 font-semibold">
              <AlertCircle className="w-3 h-3 text-rose-600" />
              Kapasitas tidak mencukupi ({selectedRoom.capacity} kursi &lt; {expectedStudents} peserta)
            </span>
          )}

          {requiredRoomType && (
            isTypeMatched ? (
              <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                Tipe ruangan sesuai ({selectedRoom.room_type})
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200 font-semibold">
                <AlertCircle className="w-3 h-3 text-rose-600" />
                Tipe ruangan berbeda (Dibutuhkan: {requiredRoomType})
              </span>
            )
          )}
        </div>
      )}
    </div>
  );
};
