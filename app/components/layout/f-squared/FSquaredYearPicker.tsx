import GoBox from '~/components/ui/GoBox';

type Props = {
  years: number[];
};

export default function FSquaredYearPicker({ years }: Props) {
  return (
    <div className='float-right mb-4'>
      <GoBox
        options={years.map(year => ({
          label: `${year}`,
          url: `/games/f-squared/standings/${year}`,
        }))}
        buttonText='Choose Year'
      />
    </div>
  );
}
