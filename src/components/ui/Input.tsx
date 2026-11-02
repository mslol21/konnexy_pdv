import React from 'react';
import { cn } from '../../lib/utils/cn';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, icon, type = 'text', id, ...props }, ref) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label htmlFor={inputId} className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {icon && (
            <div className="absolute left-3.5 pointer-events-none text-slate-400">
              {icon}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            type={type}
            className={cn(
              'w-full min-h-[44px] rounded-lg bg-slate-800/80 border border-slate-700 px-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all disabled:opacity-50 disabled:bg-slate-900',
              icon && 'pl-10',
              error && 'border-rose-500 focus:ring-rose-500',
              className
            )}
            {...props}
          />
        </div>
        {error && <p className="text-xs text-rose-400 font-medium">{error}</p>}
      </div>
    );
  }
);
Input.displayName = 'Input';
