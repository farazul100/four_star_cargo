import React from 'react';

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export const Logo: React.FC<LogoProps> = ({ className = '', size = 'md' }) => {
  const dimensions = {
    sm: 'w-8 h-8',
    md: 'w-12 h-12',
    lg: 'w-20 h-20',
    xl: 'w-28 h-28',
  };

  return (
    <div className={`relative flex items-center justify-center shrink-0 ${dimensions[size]} ${className}`}>
      <img
        src="/logo.png"
        alt="Four Star Cargo Logo"
        className="w-full h-full object-contain filter drop-shadow-lg"
      />
    </div>
  );
};
