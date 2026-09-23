type Props = {
  label: string;
  value: string;
};

export default function StatTile({ label, value }: Props) {
  return (
    <div className='rounded-md bg-slate-900/50 px-4 py-3 text-center'>
      <div className='text-xs text-slate-400'>{label}</div>
      <div className='mt-1 text-xl font-bold text-white'>{value}</div>
    </div>
  );
}
