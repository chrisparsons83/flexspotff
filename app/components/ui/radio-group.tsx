import { FOCUS_RING } from './styles';
import * as RadioGroupPrimitive from '@radix-ui/react-radio-group';
import * as React from 'react';
import { cn } from '~/utils';

/** Picks one of a few options, all in view. Posts with a Form by `name`. */
const RadioGroup = React.forwardRef<
  React.ElementRef<typeof RadioGroupPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Root>
>(({ className, ...props }, ref) => (
  <RadioGroupPrimitive.Root
    className={cn('grid gap-3', className)}
    {...props}
    ref={ref}
  />
));
RadioGroup.displayName = RadioGroupPrimitive.Root.displayName;

/**
 * A square, like every other shape on the site. Chosen, it fills with a
 * smaller accent square, which reads without the colour.
 */
const RadioGroupItem = React.forwardRef<
  React.ElementRef<typeof RadioGroupPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Item>
>(({ className, ...props }, ref) => (
  <RadioGroupPrimitive.Item
    ref={ref}
    className={cn(
      'peer flex size-5 shrink-0 items-center justify-center border border-input bg-background data-[state=checked]:border-primary-edge disabled:cursor-not-allowed disabled:opacity-50',
      FOCUS_RING,
      className,
    )}
    {...props}
  >
    <RadioGroupPrimitive.Indicator className='size-2.5 bg-primary' />
  </RadioGroupPrimitive.Item>
));
RadioGroupItem.displayName = RadioGroupPrimitive.Item.displayName;

export { RadioGroup, RadioGroupItem };
