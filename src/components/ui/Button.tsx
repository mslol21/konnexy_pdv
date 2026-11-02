import React from 'react';
import { cn } from '../../lib/utils/cn';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline' | 'success';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  isLoading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', isLoading = false, children, disabled, ...props }, ref) => {
    const baseStyles = 'inline-flex items-center justify-center font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 active:scale-95 disabled:opacity-50 disabled:pointer-events-none disabled:active:scale-100 min-h-[44px] cursor-pointer';

    const variants = {
      primary: 'bg-emerald-600 text-white hover:bg-emerald-500 focus:ring-emerald-500 shadow-sm',
      secondary: 'bg-slate-700 text-slate-100 hover:bg-slate-600 focus:ring-slate-500 border border-slate-600',
      danger: 'bg-rose-600 text-white hover:bg-rose-500 focus:ring-rose-500',
      ghost: 'bg-transparent text-slate-300 hover:bg-slate-800 hover:text-white focus:ring-slate-400',
      outline: 'bg-transparent text-emerald-400 border border-emerald-500/50 hover:bg-emerald-950/30 focus:ring-emerald-500',
      success: 'bg-teal-600 text-white hover:bg-teal-500 focus:ring-teal-500'
    };

    const sizes = {
      sm: 'px-3 py-1.5 text-xs',
      md: 'px-4 py-2.5 text-sm',
      lg: 'px-6 py-3.5 text-base font-semibold',
      xl: 'px-8 py-4 text-lg font-bold'
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        {...props}
      >
        {isLoading ? (
          <span className="inline-flex items-center gap-2">
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            Carregando...
          </span>
        ) : (
          children
        )}
      </button>
    );
  }
);
Button.displayName = 'Button';
