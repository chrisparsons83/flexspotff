import { Label } from './label';
import { cloneElement, type ReactElement, useId } from 'react';
import { cn } from '~/utils';

type Props = {
  label: string;
  /** Written under the control, once, in place of a tooltip. */
  description?: string;
  /** Replaces the description while the value is wrong. */
  error?: string;
  className?: string;
  /** One control. Its id and aria links are filled in. */
  children: ReactElement;
};

/**
 * A control with its label, and what it needs explained written under it.
 * The control gets the id the label points at, and is described by the help
 * or the error.
 */
export function Field({
  label,
  description,
  error,
  className,
  children,
}: Props) {
  const id = useId();
  const controlId = children.props.id ?? `${id}-control`;
  const helpId = `${id}-help`;
  const help = error ?? description;

  return (
    <div className={cn('grid gap-2', className)}>
      <Label htmlFor={controlId}>{label}</Label>
      {cloneElement(children, {
        id: controlId,
        'aria-describedby': help ? helpId : undefined,
        'aria-invalid': error ? true : undefined,
      })}
      {help && (
        <p
          id={helpId}
          className={cn(
            'text-sm',
            error ? 'text-negative' : 'text-muted-foreground',
          )}
        >
          {help}
        </p>
      )}
    </div>
  );
}
