import React from 'react';
import { cn } from '../../lib/utils/cn';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'elevated' | 'glass';
}

export const Card: React.FC<CardProps> = ({
  className,
  variant = 'default',
  children,
  ...props
}) => {
  const variants = {
    default: 'bg-slate-850 border border-slate-800 shadow-sm',
    elevated: 'bg-slate-800/90 border border-slate-700 shadow-md',
    glass: 'bg-slate-800/50 backdrop-blur-md border border-slate-700/60'
  };

  return (
    <div
      className={cn(
        'rounded-xl p-4 sm:p-5 text-slate-100',
        variants[variant],
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};
