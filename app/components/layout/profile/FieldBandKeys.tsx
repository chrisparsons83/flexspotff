import { ChartKey } from '~/components/ui/chart';

/**
 * The key for the field's band that sits behind every season chart, after the
 * member's own line: the middle half, the whole spread, and the median.
 */
export function FieldBandKeys({ rangeLabel }: { rangeLabel: string }) {
  return (
    <>
      <ChartKey>
        <span className='inline-block h-2.5 w-4 bg-muted-foreground/30' />
        Middle half of the field
      </ChartKey>
      <ChartKey>
        <span className='inline-block h-2.5 w-4 bg-muted-foreground/10' />
        {rangeLabel}
      </ChartKey>
      <ChartKey>
        <span className='inline-block w-4 border-t border-dashed border-muted-foreground' />
        Median
      </ChartKey>
    </>
  );
}
