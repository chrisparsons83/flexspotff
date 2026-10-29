import { FOCUS_RING } from './styles';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import * as React from 'react';
import { cn } from '~/utils';

/**
 * Switches between views of the same thing on one page. For moving between
 * pages, use SubNav, whose items are links.
 */
const Tabs = TabsPrimitive.Root;

/** A strip along a rule; scrolls sideways on a phone rather than wrapping. */
const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      'relative flex overflow-x-auto border-b border-border text-muted-foreground',
      className,
    )}
    {...props}
  />
));
TabsList.displayName = TabsPrimitive.List.displayName;

/** The current tab stands on the rule in the accent. */
const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      '-mb-px whitespace-nowrap border-b-[3px] border-transparent px-4 py-2.5 text-base font-semibold transition-colors duration-fast hover:text-foreground disabled:pointer-events-none disabled:opacity-50 data-[state=active]:border-primary data-[state=active]:text-foreground',
      FOCUS_RING,
      className,
    )}
    {...props}
  />
));
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn('mt-6', FOCUS_RING, className)}
    {...props}
  />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;

export { Tabs, TabsList, TabsTrigger, TabsContent };
