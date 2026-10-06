import SegmentedControl from './SegmentedControl';

/**
 * Year buttons plus "All", for narrowing a log to one season. `showAll={false}`
 * drops "All" for views that only make sense one season at a time.
 *
 * Every log opens on the latest season, so the year to pass in first is the
 * newest one.
 */
export default function YearFilter({
  years,
  value,
  onChange,
  showAll = true,
}: {
  years: number[];
  value: number | 'all';
  onChange: (value: number | 'all') => void;
  showAll?: boolean;
}) {
  return (
    <SegmentedControl<number | 'all'>
      label='Season'
      value={value}
      onChange={onChange}
      options={[
        ...years.map(year => ({ value: year, label: String(year) })),
        ...(showAll ? [{ value: 'all' as const, label: 'All' }] : []),
      ]}
    />
  );
}
