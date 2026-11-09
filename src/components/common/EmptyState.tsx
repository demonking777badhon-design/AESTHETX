import React from 'react';
import { PackageOpen, ArrowRight } from 'lucide-react';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  actionText?: string;
  onAction?: () => void;
  actionHref?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  actionText,
  onAction,
  actionHref
}) => {
  return (
    <div className="flex flex-col items-center justify-center p-8 sm:p-12 text-center bg-white border border-[#E5DFD7] rounded-xl my-6">
      <div className="w-16 h-16 rounded-full bg-[#FAF8F5] border border-[#E5DFD7] flex items-center justify-center text-[#1E3A2F] mb-4">
        {icon || <PackageOpen className="w-8 h-8 opacity-75" />}
      </div>
      <h3 className="text-xl font-bold text-[#1A1E1C] mb-2">{title}</h3>
      <p className="text-[#626C66] max-w-md text-sm mb-6 leading-relaxed">{description}</p>
      
      {actionText && (
        <>
          {actionHref ? (
            <a
              href={actionHref}
              className="inline-flex items-center gap-2 bg-[#1E3A2F] hover:bg-[#162B23] text-[#F9F6F0] px-6 py-2.5 rounded-lg text-sm font-semibold transition-all shadow-sm"
            >
              <span>{actionText}</span>
              <ArrowRight className="w-4 h-4" />
            </a>
          ) : (
            <button
              onClick={onAction}
              className="inline-flex items-center gap-2 bg-[#1E3A2F] hover:bg-[#162B23] text-[#F9F6F0] px-6 py-2.5 rounded-lg text-sm font-semibold transition-all shadow-sm cursor-pointer"
            >
              <span>{actionText}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </>
      )}
    </div>
  );
};
