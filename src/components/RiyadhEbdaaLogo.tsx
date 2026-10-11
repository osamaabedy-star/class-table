import React from 'react';

interface RiyadhEbdaaLogoProps {
  className?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  showText?: boolean;
  inverted?: boolean;
}

export const RiyadhEbdaaLogo: React.FC<RiyadhEbdaaLogoProps> = ({
  className = '',
  size = 'md',
  showText = true,
  inverted = true
}) => {
  const iconSizes = {
    xs: 'w-6 h-6',
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-14 h-14'
  };

  const textSizes = {
    xs: 'text-xs',
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg'
  };

  return (
    <div className={`inline-flex items-center gap-2.5 select-none ${className}`}>
      {/* Sunburst Open Book Icon */}
      <div className={`relative flex items-center justify-center shrink-0 ${iconSizes[size]}`}>
        <svg viewBox="0 0 120 120" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Sunburst Rays */}
          <path d="M60 70 L60 15" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" />
          <path d="M60 70 L48 18" stroke="#F59E0B" strokeWidth="2.8" strokeLinecap="round" />
          <path d="M60 70 L72 18" stroke="#F59E0B" strokeWidth="2.8" strokeLinecap="round" />
          <path d="M60 70 L37 24" stroke="#D97706" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M60 70 L83 24" stroke="#D97706" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M60 70 L27 33" stroke="#B45309" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M60 70 L93 33" stroke="#B45309" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M60 70 L19 45" stroke="#991B1B" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M60 70 L101 45" stroke="#991B1B" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M60 70 L14 59" stroke="#7F1D1D" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M60 70 L106 59" stroke="#7F1D1D" strokeWidth="2.5" strokeLinecap="round" />

          {/* Sun center semi-circle glow */}
          <circle cx="60" cy="70" r="14" fill="#FBBF24" />

          {/* Layered Book Pages - Left Wing */}
          <path d="M60 72 C45 60 25 58 12 66 C22 56 42 54 60 67 Z" fill="#991B1B" />
          <path d="M60 77 C44 65 24 64 10 73 C20 63 42 61 60 73 Z" fill="#7F1D1D" />
          <path d="M60 83 C43 71 22 70 8 80 C18 70 41 68 60 80 Z" fill="#581424" />

          {/* Layered Book Pages - Right Wing */}
          <path d="M60 72 C75 60 95 58 108 66 C98 56 78 54 60 67 Z" fill="#991B1B" />
          <path d="M60 77 C76 65 96 64 110 73 C100 63 78 61 60 73 Z" fill="#7F1D1D" />
          <path d="M60 83 C77 71 98 70 112 80 C102 70 79 68 60 80 Z" fill="#581424" />
        </svg>
      </div>

      {/* Brand Typography */}
      {showText && (
        <div className="flex flex-col text-right leading-tight">
          <div className="flex items-center gap-1">
            <span className="text-[10px] sm:text-xs font-bold text-amber-500">مدارس</span>
            <span className={`font-black tracking-tight ${textSizes[size]} ${inverted ? 'text-white' : 'text-[#581424]'}`}>
              رياض الإبداع
            </span>
          </div>
          <span className="text-[8px] sm:text-[9px] font-semibold text-slate-400 font-sans tracking-wider dir-ltr text-left">
            <span className="text-amber-500 font-bold">Riyadh Al Ebdaa</span> Schools
          </span>
        </div>
      )}
    </div>
  );
};
