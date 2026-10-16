import { cn } from '~/utils';

type AlertStatus = 'success' | 'warning' | 'error';

type Props = {
  message: string;
  status?: AlertStatus;
  className?: string;
};

/**
 * The message says what happened; the colour, each state's text-safe one on
 * a card, only repeats it. No strip down the side.
 */
const statusClasses: Record<AlertStatus, string> = {
  success: 'text-positive',
  warning: 'text-warning',
  error: 'text-negative',
};

/** The result of a form post, set above the form. */
export default function Alert({
  message,
  status = 'success',
  className,
}: Props) {
  return (
    <div
      role={status === 'error' ? 'alert' : 'status'}
      className={cn(
        'bg-card px-4 py-3 font-semibold',
        statusClasses[status] ?? statusClasses.success,
        className,
      )}
    >
      {message}
    </div>
  );
}
