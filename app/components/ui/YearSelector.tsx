import { useNavigate } from '@remix-run/react';

type Props = {
  year: number;
  years: number[];
  buildUrl: (year: number) => string;
};

export default function YearSelector({ year, years, buildUrl }: Props) {
  const navigate = useNavigate();

  if (years.length <= 1) return null;

  return (
    <select
      value={year}
      onChange={e => navigate(buildUrl(Number(e.target.value)))}
      className='rounded border border-gray-600 bg-gray-800 px-2 py-1 text-white text-sm'
    >
      {years.map(y => (
        <option key={y} value={y}>
          {y}
        </option>
      ))}
    </select>
  );
}
