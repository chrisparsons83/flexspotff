import { CONTROL, FOCUS_RING } from './styles';
import * as React from 'react';
import { cn } from '~/utils';

const FIELD = cn('w-full px-3 text-base', CONTROL, FOCUS_RING);

const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, type = 'text', ...props }, ref) => (
  <input
    ref={ref}
    type={type}
    className={cn(
      FIELD,
      'h-10',
      'file:mr-3 file:border-0 file:bg-secondary file:px-3 file:py-1 file:text-sm file:font-semibold file:text-secondary-foreground',
      className,
    )}
    {...props}
  />
));
Input.displayName = 'Input';

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, rows = 4, ...props }, ref) => (
  <textarea
    ref={ref}
    rows={rows}
    className={cn(FIELD, 'py-2', className)}
    {...props}
  />
));
Textarea.displayName = 'Textarea';

/**
 * The browser's own select, styled like the other fields. For a form that
 * submits as soon as it changes, or a long plain list, where the Select's
 * popover is more than the job needs.
 */
const NativeSelect = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, ...props }, ref) => (
  <select ref={ref} className={cn(FIELD, 'h-10 pr-8', className)} {...props} />
));
NativeSelect.displayName = 'NativeSelect';

/**
 * The browser's own checkbox in the accent colour. Wrap it in a label with
 * its text beside it, or give it an aria-label in a table row.
 */
const Checkbox = React.forwardRef<
  HTMLInputElement,
  Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'>
>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    type='checkbox'
    className={cn(
      'size-4 shrink-0 cursor-pointer accent-[oklch(var(--primary))] disabled:cursor-not-allowed disabled:opacity-50',
      FOCUS_RING,
      className,
    )}
    {...props}
  />
));
Checkbox.displayName = 'Checkbox';

export { Checkbox, Input, NativeSelect, Textarea };
