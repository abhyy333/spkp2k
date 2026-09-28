import React from 'react';

interface UnramLogoProps {
  className?: string;
  size?: number;
}

export const UnramLogo: React.FC<UnramLogoProps> = ({ className = 'w-9 h-9', size = 36 }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Logo Universitas Mataram"
    >
      {/* Outer golden rim */}
      <circle cx="50" cy="50" r="48" fill="#FBBF24" stroke="#D97706" strokeWidth="2" />
      {/* Dark green circular background */}
      <circle cx="50" cy="50" r="43" fill="#047857" />
      {/* Inner subtle decorative ring */}
      <circle cx="50" cy="50" r="39" stroke="#FDE68A" strokeWidth="1.5" strokeDasharray="3 2" />
      
      {/* Lotus / Padma petals */}
      <path
        d="M50 16 C53 28 66 36 74 44 C66 48 58 45 50 54 C42 45 34 48 26 44 C34 36 47 28 50 16 Z"
        fill="#F59E0B"
      />
      <path
        d="M50 22 C52 30 62 36 68 42 C62 45 56 43 50 50 C44 43 38 45 32 42 C38 36 48 30 50 22 Z"
        fill="#FEF08A"
      />

      {/* Center Gear / Engineering element */}
      <circle cx="50" cy="62" r="16" fill="#D97706" />
      <circle cx="50" cy="62" r="14" fill="#B45309" />
      <circle cx="50" cy="62" r="9" fill="#047857" />
      <circle cx="50" cy="62" r="5" fill="#FEF08A" />

      {/* Gear teeth */}
      {[0, 45, 90, 135, 180, 225, 270, 315].map((angle, i) => {
        const rad = (angle * Math.PI) / 180;
        const x = 50 + 15 * Math.cos(rad);
        const y = 62 + 15 * Math.sin(rad);
        return (
          <circle key={i} cx={x} cy={y} r="2.5" fill="#F59E0B" />
        );
      })}

      {/* University Torch Flame */}
      <path
        d="M50 30 C53 38 56 46 50 56 C44 46 47 38 50 30 Z"
        fill="#EF4444"
      />
      <path
        d="M50 36 C52 42 54 48 50 54 C46 48 48 42 50 36 Z"
        fill="#FDE047"
      />
    </svg>
  );
};
