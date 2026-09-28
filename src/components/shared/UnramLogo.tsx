import React from 'react';

interface UnramLogoProps {
  className?: string;
  size?: number;
  alt?: string;
}

export const UnramLogo: React.FC<UnramLogoProps> = ({
  className = '',
  size = 36,
  alt = 'Logo Universitas Mataram',
}) => {
  return (
    <img
      src="/logo-unram.png"
      alt={alt}
      width={size}
      height={size}
      style={{
        width: size ? `${size}px` : undefined,
        height: size ? `${size}px` : undefined,
        objectFit: 'contain',
      }}
      className={`shrink-0 ${className}`}
    />
  );
};
