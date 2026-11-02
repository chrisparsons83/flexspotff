import { FOCUS_RING } from './styles';
import * as CollapsiblePrimitive from '@radix-ui/react-collapsible';
import { ChevronDownIcon } from '@radix-ui/react-icons';
import * as React from 'react';
import { cn } from '~/utils';

/** Shows and hides a block in place, such as the rest of a long list. */
const Collapsible = CollapsiblePrimitive.Root;

/**
 * A full-width row naming what opens, with a chevron that turns over when it
 * is open. Pass `asChild` to use a control of your own instead.
 */
const CollapsibleTrigger = React.forwardRef<
  React.ElementRef<typeof CollapsiblePrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof CollapsiblePrimitive.Trigger>
>(({ className, children, asChild, ...props }, ref) =>
  asChild ? (
    <CollapsiblePrimitive.Trigger ref={ref} asChild {...props}>
      {children}
    </CollapsiblePrimitive.Trigger>
  ) : (
    <CollapsiblePrimitive.Trigger
      ref={ref}
      className={cn(
        'group flex w-full items-center justify-between gap-4 py-3 text-left font-semibold',
        FOCUS_RING,
        className,
      )}
      {...props}
    >
      {children}
      <ChevronDownIcon
        aria-hidden
        className='size-4 shrink-0 transition-transform duration-fast group-data-[state=open]:rotate-180'
      />
    </CollapsiblePrimitive.Trigger>
  ),
);
CollapsibleTrigger.displayName = CollapsiblePrimitive.Trigger.displayName;

const CollapsibleContent = CollapsiblePrimitive.Content;

export { Collapsible, CollapsibleTrigger, CollapsibleContent };
