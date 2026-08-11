import { type MouseEvent } from 'react';
import { cn } from '~/utils';

type ButtonProps = {
  children: string;
  type: 'submit' | 'reset' | 'button';
  disabled?: boolean;
  name?: string;
  value?: string;
  onClick?: (e: MouseEvent<HTMLButtonElement>) => void;
  className?: string;
};

export default function Button({
  children,
  type,
  disabled = false,
  name = 'systemButton',
  value = 'systemValue',
  onClick,
  className,
}: ButtonProps) {
  return (
    <button
      // cn (twMerge) rather than clsx so a caller-supplied color actually wins:
      // clsx only concatenates, leaving the defaults below to take the cascade.
      className={cn(
        'focus-visible:ring-offset-2zd inline-flex justify-center rounded-md border border-transparent bg-blue-100 px-4 py-2 text-sm font-medium text-blue-900 hover:bg-blue-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-25',
        className,
      )}
      type={type}
      disabled={disabled}
      name={name}
      value={value}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
