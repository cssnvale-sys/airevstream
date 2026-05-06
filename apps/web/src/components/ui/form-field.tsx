'use client';

import { cn } from '@/lib/utils';
import { AlertCircle } from 'lucide-react';

interface FormFieldProps {
  label: string;
  htmlFor: string;
  required?: boolean;
  helperText?: string;
  error?: string;
  children: React.ReactNode;
  className?: string;
}

export function FormField({
  label,
  htmlFor,
  required = false,
  helperText,
  error,
  children,
  className,
}: FormFieldProps) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <label htmlFor={htmlFor} className="block text-sm font-medium text-text-primary">
        {label}
        {required && (
          <span className="text-accent-red ml-1" aria-label="required">*</span>
        )}
      </label>

      <div>{children}</div>

      {error ? (
        <p className="text-sm text-accent-red flex items-center gap-1" role="alert">
          <AlertCircle size={14} aria-hidden="true" />
          {error}
        </p>
      ) : helperText ? (
        <p className="text-sm text-text-secondary">{helperText}</p>
      ) : null}
    </div>
  );
}

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string;
}

export function FormInput({ className, error, ...props }: InputProps) {
  return (
    <input
      className={cn(
        'input w-full',
        error && 'border-accent-red focus:ring-accent-red/50 focus:border-accent-red',
        className
      )}
      aria-invalid={error ? 'true' : 'false'}
      {...props}
    />
  );
}

interface TextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: string;
}

export function FormTextArea({ className, error, ...props }: TextAreaProps) {
  return (
    <textarea
      className={cn(
        'input w-full min-h-[100px] resize-y',
        error && 'border-accent-red focus:ring-accent-red/50 focus:border-accent-red',
        className
      )}
      aria-invalid={error ? 'true' : 'false'}
      {...props}
    />
  );
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  error?: string;
  options: { value: string; label: string }[];
}

export function FormSelect({ className, error, options, ...props }: SelectProps) {
  return (
    <select
      className={cn(
        'input w-full',
        error && 'border-accent-red focus:ring-accent-red/50 focus:border-accent-red',
        className
      )}
      aria-invalid={error ? 'true' : 'false'}
      {...props}
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}
