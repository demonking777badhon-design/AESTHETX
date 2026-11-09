import React, { useState } from 'react';
import { X, Ruler } from 'lucide-react';

interface SizeChartModalProps {
  isOpen: boolean;
  onClose: () => void;
  category?: string;
}

export const SizeChartModal: React.FC<SizeChartModalProps> = ({ isOpen, onClose, category = 'T-Shirts & Tops' }) => {
  const [unit, setUnit] = useState<'inches' | 'cm'>('inches');

  if (!isOpen) return null;

  const sizeData = [
    { size: 'S', chestIn: '38', lengthIn: '27', sleeveIn: '8', chestCm: '96', lengthCm: '68', sleeveCm: '20' },
    { size: 'M', chestIn: '40', lengthIn: '28', sleeveIn: '8.5', chestCm: '101', lengthCm: '71', sleeveCm: '21.5' },
    { size: 'L', chestIn: '42', lengthIn: '29', sleeveIn: '9', chestCm: '106', lengthCm: '74', sleeveCm: '23' },
    { size: 'XL', chestIn: '44', lengthIn: '30', sleeveIn: '9.5', chestCm: '112', lengthCm: '76', sleeveCm: '24' },
    { size: 'XXL', chestIn: '46', lengthIn: '31', sleeveIn: '10', chestCm: '117', lengthCm: '79', sleeveCm: '25.5' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-[#E5DFD7] max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-4 border-b border-[#E5DFD7]">
          <div className="flex items-center gap-2 text-[#1E3A2F]">
            <Ruler className="w-5 h-5 text-[#C85A32]" />
            <h3 className="text-lg font-bold text-[#1A1E1C]">Size Chart & Sizing Guide</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-[#FAF8F5] text-[#626C66] hover:text-[#1A1E1C] cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="py-4">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#626C66]">
              Garment Measurements ({category})
            </span>
            <div className="flex items-center gap-1 bg-[#FAF8F5] p-1 rounded-lg border border-[#E5DFD7] text-xs">
              <button
                onClick={() => setUnit('inches')}
                className={`px-3 py-1 rounded-md font-medium transition-all ${
                  unit === 'inches'
                    ? 'bg-[#1E3A2F] text-[#F9F6F0]'
                    : 'text-[#626C66] hover:text-[#1A1E1C]'
                }`}
              >
                Inches
              </button>
              <button
                onClick={() => setUnit('cm')}
                className={`px-3 py-1 rounded-md font-medium transition-all ${
                  unit === 'cm'
                    ? 'bg-[#1E3A2F] text-[#F9F6F0]'
                    : 'text-[#626C66] hover:text-[#1A1E1C]'
                }`}
              >
                CM
              </button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border border-[#E5DFD7]">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#FAF8F5] text-xs uppercase text-[#626C66] border-b border-[#E5DFD7]">
                <tr>
                  <th className="py-3 px-4 font-bold">Size</th>
                  <th className="py-3 px-4 font-bold">Chest ({unit === 'inches' ? 'in' : 'cm'})</th>
                  <th className="py-3 px-4 font-bold">Length ({unit === 'inches' ? 'in' : 'cm'})</th>
                  <th className="py-3 px-4 font-bold">Sleeve ({unit === 'inches' ? 'in' : 'cm'})</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EFEBE5]">
                {sizeData.map((row) => (
                  <tr key={row.size} className="hover:bg-[#FAF8F5]/60 transition-colors">
                    <td className="py-3 px-4 font-bold text-[#1E3A2F]">{row.size}</td>
                    <td className="py-3 px-4 text-[#1A1E1C]">
                      {unit === 'inches' ? row.chestIn : row.chestCm}
                    </td>
                    <td className="py-3 px-4 text-[#1A1E1C]">
                      {unit === 'inches' ? row.lengthIn : row.lengthCm}
                    </td>
                    <td className="py-3 px-4 text-[#1A1E1C]">
                      {unit === 'inches' ? row.sleeveIn : row.sleeveCm}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-5 p-4 rounded-xl bg-[#FAF8F5] border border-[#E5DFD7] text-xs text-[#626C66] space-y-2">
            <h4 className="font-bold text-[#1A1E1C]">How to Measure:</h4>
            <p><strong className="text-[#1A1E1C]">Chest:</strong> Measure across the fullest part of your chest, keeping the tape horizontal.</p>
            <p><strong className="text-[#1A1E1C]">Length:</strong> Measure from the highest point of the shoulder down to the bottom hem.</p>
            <p><strong className="text-[#1A1E1C]">Sleeve:</strong> Measure from the shoulder seam down to the cuff.</p>
            <p className="text-[#C85A32] italic">Note: Bangladesh standard fit. If you prefer a loose relaxed or oversized look, we recommend sizing up one size.</p>
          </div>
        </div>

        <div className="pt-3 border-t border-[#E5DFD7] flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-[#1E3A2F] text-[#F9F6F0] rounded-lg text-sm font-semibold hover:bg-[#162B23] transition-colors"
          >
            Close Guide
          </button>
        </div>
      </div>
    </div>
  );
};
