import React from 'react';
import { Home, Compass, ArrowLeft } from 'lucide-react';
import { useSettings } from '../context/SettingsContext';

interface NotFoundPageProps {
  onNavigate: (path: string) => void;
}

export const NotFoundPage: React.FC<NotFoundPageProps> = ({ onNavigate }) => {
  const { settings } = useSettings();
  const logoSrc = settings.logoUrl || '/assets/aistudio/WhatsApp_Image_2026-08-24_at_3.13.47_PM_75b34fce.jpeg';

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-16 text-center">
      <div className="max-w-md w-full bg-white border border-[#E5DFD7] rounded-3xl p-8 sm:p-10 shadow-xs space-y-6">
        <div className="flex justify-center">
          <img
            src={logoSrc}
            alt={settings.storeName}
            className="h-16 w-auto object-contain"
          />
        </div>

        <div className="space-y-2">
          <span className="text-4xl sm:text-5xl font-black text-[#C85A32]">404</span>
          <h1 className="text-xl sm:text-2xl font-extrabold text-[#1A1E1C]">
            Page Not Found
          </h1>
          <p className="text-xs sm:text-sm text-[#626C66] leading-relaxed">
            The page you are looking for might have been removed, had its name changed, or is temporarily unavailable.
          </p>
        </div>

        <div className="pt-2 flex flex-col sm:flex-row gap-3">
          <button
            onClick={() => onNavigate('/')}
            className="flex-1 py-3 px-4 bg-[#1E3A2F] hover:bg-[#162B23] text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <Home className="w-4 h-4" />
            <span>Go to Homepage</span>
          </button>

          <button
            onClick={() => onNavigate('/shop')}
            className="flex-1 py-3 px-4 bg-[#FAF8F5] hover:bg-stone-100 border border-[#E5DFD7] text-[#1A1E1C] rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <Compass className="w-4 h-4 text-[#C85A32]" />
            <span>Browse Shop</span>
          </button>
        </div>
      </div>
    </div>
  );
};
