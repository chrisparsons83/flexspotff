type Props = {
  message: string;
  status?: 'success' | 'warning' | 'error';
};

export default function Alert({ message, status = 'success' }: Props) {
  return (
    <div
      className='border-l-4 border-green-500 bg-green-100 p-4 text-green-700'
      role='dialog'
    >
      {message}
    </div>
  );
}
