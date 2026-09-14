import React from 'react';

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'full' | 'horizontal' | 'mark' | 'badge';
  showTagline?: boolean;
  light?: boolean;
}

export const Logo: React.FC<LogoProps> = ({
  className = '',
  size = 'md',
  variant = 'horizontal',
  showTagline = false,
  light = false,
}) => {
  // Dimension scales
  const dimensions = {
    sm: { markSize: 32, textSize: 'text-sm', subSize: 'text-[9px]' },
    md: { markSize: 42, textSize: 'text-base', subSize: 'text-[10px]' },
    lg: { markSize: 56, textSize: 'text-xl', subSize: 'text-xs' },
    xl: { markSize: 84, textSize: 'text-3xl', subSize: 'text-sm' },
  }[size];

  // SVG Icon Mark: SPM Monogram with Growth Arrow and Integrated Chart Bars
  const SvgMark = ({ s = dimensions.markSize }: { s?: number }) => (
    <svg
      width={s}
      height={s}
      viewBox="0 0 420 360"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="shrink-0 drop-shadow-xs"
    >
      <defs>
        <linearGradient id="spmBlueGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#00BAFF" />
          <stop offset="50%" stopColor="#0066FF" />
          <stop offset="100%" stopColor="#0040E0" />
        </linearGradient>

        <linearGradient id="spmGreenGrad" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#009933" />
          <stop offset="50%" stopColor="#00C853" />
          <stop offset="100%" stopColor="#00E676" />
        </linearGradient>

        <linearGradient id="spmChartGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#00E676" />
          <stop offset="100%" stopColor="#00A844" />
        </linearGradient>
      </defs>

      <g transform="translate(10, 10)">
        {/* Stylized 'S' Ribbon */}
        <path
          d="M 120 40 C 70 40, 32 65, 32 108 C 32 145, 70 158, 115 168 C 152 178, 168 196, 168 218 C 168 245, 132 262, 90 262 C 54 262, 22 244, 8 222 L 0 252 C 22 284, 60 300, 104 300 C 162 300, 206 268, 206 218 C 206 172, 168 154, 126 144 C 86 134, 68 120, 68 102 C 68 82, 92 74, 122 74 C 152 74, 182 86, 200 102 L 216 66 C 190 48, 156 40, 120 40 Z"
          fill="url(#spmBlueGrad)"
        />

        {/* Stylized 'P' Stem and Loop */}
        <path
          d="M 108 32 L 108 300 L 146 300 L 146 195 L 178 195 C 224 195, 260 162, 260 114 C 260 66, 224 32, 178 32 Z M 146 68 L 175 68 C 200 68, 220 86, 220 114 C 220 142, 200 160, 175 160 L 146 160 Z"
          fill="url(#spmBlueGrad)"
        />

        {/* Bar Chart Columns inside 'P' loop */}
        <rect x="165" y="102" width="13" height="44" rx="3.5" fill="url(#spmChartGrad)" />
        <rect x="185" y="84" width="13" height="62" rx="3.5" fill="url(#spmGreenGrad)" />

        {/* Stylized 'M' Left Leg */}
        <rect x="195" y="165" width="35" height="135" rx="3" fill="url(#spmGreenGrad)" />

        {/* Stylized 'M' Middle V and Ascending Growth Arrow */}
        <path
          d="M 230 300 L 268 200 L 302 250 L 358 85 L 340 70 L 395 55 L 380 110 L 362 95 L 315 210 L 282 165 Z"
          fill="url(#spmGreenGrad)"
        />
      </g>
    </svg>
  );

  if (variant === 'mark') {
    return <SvgMark />;
  }

  if (variant === 'badge') {
    return (
      <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-white border border-slate-200/80 shadow-xs ${className}`}>
        <SvgMark s={28} />
        <div>
          <div className="flex items-center gap-0.5 font-black text-xs tracking-tight">
            <span className="text-slate-900">Smart</span>
            <span className="text-emerald-600">Product</span>
            <span className="text-blue-600">Manager</span>
          </div>
          <span className="text-[9px] text-slate-500 font-semibold block leading-none mt-0.5">
            Smart Stock | Smart Business
          </span>
        </div>
      </div>
    );
  }

  if (variant === 'full') {
    return (
      <div className={`flex flex-col items-center text-center ${className}`}>
        <SvgMark s={size === 'xl' ? 120 : size === 'lg' ? 90 : 68} />
        <div className="mt-3">
          <div className="flex items-center justify-center gap-1 font-black tracking-tight text-xl sm:text-2xl">
            <span className={light ? 'text-white' : 'text-slate-900'}>Smart</span>
            <span className="text-emerald-600">Product</span>
            <span className="text-blue-600">Manager</span>
          </div>
          {showTagline && (
            <p className="text-xs font-semibold text-slate-500 tracking-wider mt-1.5 flex items-center justify-center gap-2">
              <span>Smart Stock</span>
              <span className="text-emerald-500 font-bold">|</span>
              <span>Smart Business</span>
            </p>
          )}
        </div>
      </div>
    );
  }

  // Default: Horizontal
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <SvgMark s={dimensions.markSize} />
      <div className="flex flex-col leading-tight">
        <div className={`flex items-center gap-1 font-black tracking-tight ${dimensions.textSize}`}>
          <span className={light ? 'text-white' : 'text-slate-900'}>Smart</span>
          <span className="text-emerald-600">Product</span>
          <span className="text-blue-600">Manager</span>
        </div>
        {showTagline && (
          <div className={`flex items-center gap-1 font-semibold tracking-wide ${dimensions.subSize} ${light ? 'text-slate-300' : 'text-slate-500'}`}>
            <span>Smart Stock</span>
            <span className="text-emerald-500 font-bold">|</span>
            <span>Smart Business</span>
          </div>
        )}
      </div>
    </div>
  );
};

