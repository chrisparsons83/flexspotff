import { FOCUS_RING, LABEL } from './styles';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { cn } from '~/utils';

/**
 * Flat by default: the primary button filled with the accent gradient, the
 * secondary outlined on whatever it sits on. The depth tokens can set them
 * on a short solid drop in a darker shade of themselves, like keys that
 * press down into it. Ghost and link buttons never have a drop.
 */
const buttonVariants = cva(
  cn(
    'inline-flex items-center justify-center gap-2 whitespace-nowrap border font-semibold',
    'transition-[background-color,color,transform,box-shadow] duration-fast',
    'disabled:pointer-events-none disabled:opacity-50 disabled:shadow-none',
    '[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
    LABEL,
    FOCUS_RING,
  ),
  {
    variants: {
      variant: {
        primary:
          'border-primary-edge bg-primary bg-primary-fill text-primary-foreground shadow-press hover:bg-primary-hover hover:bg-primary-fill-hover active:translate-y-[var(--press-drop)] active:shadow-none',
        secondary:
          'border-control-edge bg-control text-secondary-foreground shadow-press-secondary hover:bg-accent active:translate-y-[var(--press-drop)] active:shadow-none',
        destructive:
          'border-transparent bg-destructive text-destructive-foreground shadow-press-destructive active:translate-y-[var(--press-drop)] active:shadow-none',
        // Discord's own colour, for the buttons that go there. Pair it with
        // DiscordLogoIcon.
        discord:
          'border-discord bg-discord text-discord-foreground shadow-press-discord hover:bg-discord-hover active:translate-y-[var(--press-drop)] active:shadow-none',
        ghost:
          'border-transparent text-foreground hover:bg-secondary hover:text-secondary-foreground',
        link: 'border-transparent px-0 text-brand underline underline-offset-4 hover:decoration-2',
      },
      size: {
        sm: 'h-8 px-3 text-sm',
        md: 'h-10 px-4 text-base',
        lg: 'h-12 px-6 text-lg',
        icon: 'size-10',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  /** Styles the one child as the button, e.g. a Link that looks like one. */
  asChild?: boolean;
}

/**
 * The type defaults to `button`, so a button in a form only submits when it
 * says so.
 */
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, type, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        // Marks a button however it renders, for the Storybook check that
        // keeps shadows to buttons and overlays.
        data-slot='button'
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        type={asChild ? type : type ?? 'button'}
        {...props}
      />
    );
  },
);
Button.displayName = 'Button';

export { Button, buttonVariants };
