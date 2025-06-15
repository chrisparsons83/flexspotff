type AlertStatus = 'success' | 'warning' | 'error';

type Props = {
  message: string;
  status?: AlertStatus;
};

const statusClasses: Record<AlertStatus, string> = {
  success: 'border-green-500 bg-green-100 text-green-700',
  warning: 'border-yellow-500 bg-yellow-100 text-yellow-700',
  error: 'border-red-500 bg-red-100 text-red-700',
};

export default function Alert({ message, status = 'success' }: Props) {
  // Get the specific classes for the status, or default to success
  const specificClasses = statusClasses[status] || statusClasses.success;
  const alertClasses = `border-l-4 p-4 ${specificClasses}`;

  return (
    <div className={alertClasses} role='alert'>
      {message}
    </div>
  );
}
