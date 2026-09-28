import React from 'react';
import { UnramLogo } from '../shared/UnramLogo';

export const AppLoader: React.FC = () => {
  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center p-4 select-none">
      <div className="flex flex-col items-center text-center max-w-xs animate-in fade-in duration-300">
        <div className="mb-4 drop-shadow-sm">
          <UnramLogo size={56} />
        </div>
        <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mb-3" />
        <h3 className="text-sm font-bold text-slate-800 tracking-tight">
          SPK Penjadwalan Perkuliahan
        </h3>
        <p className="text-2xs text-slate-400 font-medium mt-0.5">
          Teknik Elektro Universitas Mataram
        </p>
      </div>
    </div>
  );
};
