import { FOCUS_RING } from './styles';
import { Link as RemixLink, type LinkProps } from '@remix-run/react';
import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { cn } from '~/utils';

/**
 * `inline` is a link in running text: accent text, underlined. `quiet` is a
 * link that is already known to be one from where it sits, like a member's
 * name in a table: plain text, underlined under the pointer.
 */
const linkVariants = cva(cn('underline-offset-4', FOCUS_RING), {
  variants: {
    variant: {
      inline: 'text-brand underline hover:decoration-2',
      quiet: 'text-inherit no-underline hover:underline',
    },
  },
  defaultVariants: { variant: 'inline' },
});

type Props = LinkProps & VariantProps<typeof linkVariants>;

/** Remix's Link, styled. Use it for every link inside the site. */
const Link = React.forwardRef<HTMLAnchorElement, Props>(
  ({ className, variant, ...props }, ref) => (
    <RemixLink
      ref={ref}
      className={cn(linkVariants({ variant }), className)}
      {...props}
    />
  ),
);
Link.displayName = 'Link';

type ExternalProps = React.AnchorHTMLAttributes<HTMLAnchorElement> &
  VariantProps<typeof linkVariants>;

/** A link off the site, such as the Discord invite. Opens in place. */
const ExternalLink = React.forwardRef<HTMLAnchorElement, ExternalProps>(
  ({ className, variant, rel = 'noreferrer', children, ...props }, ref) => (
    <a
      ref={ref}
      rel={rel}
      className={cn(linkVariants({ variant }), className)}
      {...props}
    >
      {children}
    </a>
  ),
);
ExternalLink.displayName = 'ExternalLink';

export { Link, ExternalLink, linkVariants };
