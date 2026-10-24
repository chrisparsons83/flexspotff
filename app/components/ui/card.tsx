import { type LeagueFill } from './fills';
import * as React from 'react';
import { cn } from '~/utils';

/** Each league's tint, written out whole for Tailwind. */
const TINTS: Record<LeagueFill, string> = {
  'league-admiral':
    'bg-league-admiral-tint [--surface:var(--league-admiral-tint)]',
  'league-champions':
    'bg-league-champions-tint [--surface:var(--league-champions-tint)]',
  'league-dragon':
    'bg-league-dragon-tint [--surface:var(--league-dragon-tint)]',
  'league-galaxy':
    'bg-league-galaxy-tint [--surface:var(--league-galaxy-tint)]',
  'league-monarch':
    'bg-league-monarch-tint [--surface:var(--league-monarch-tint)]',
};

/** A league's colour as a solid band, for a card's header. */
const BANDS: Record<LeagueFill, string> = {
  'league-admiral': 'bg-league-admiral text-league-admiral-foreground',
  'league-champions': 'bg-league-champions text-league-champions-foreground',
  'league-dragon': 'bg-league-dragon text-league-dragon-foreground',
  'league-galaxy': 'bg-league-galaxy text-league-galaxy-foreground',
  'league-monarch': 'bg-league-monarch text-league-monarch-foreground',
};

const CardContext = React.createContext<{
  inCard: boolean;
  league?: LeagueFill;
}>({ inCard: false });

type CardProps = React.HTMLAttributes<HTMLDivElement> & {
  /** Wears the league's tint, and its colour on the header. */
  league?: LeagueFill;
  /**
   * The orange halo, for the one card that asks for it by name, such as a
   * live game. The card keeps its edge under the glow.
   */
  glow?: boolean;
};

/**
 * A panel: a solid area one step up from the page, set off by a hairline
 * edge (the depth tokens, which can add a top line and a shadow).
 * Use one where a block needs to stand apart, not around every block; space
 * and the grid separate the rest. Cards do not go inside cards.
 */
const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, league, glow = false, ...props }, ref) => {
    const { inCard } = React.useContext(CardContext);
    // Once per card, when it mounts, rather than on every render.
    React.useEffect(() => {
      if (inCard && process.env.NODE_ENV !== 'production') {
        console.error('A Card is inside another Card. Use space instead.');
      }
    }, [inCard]);
    return (
      <CardContext.Provider value={{ inCard: true, league }}>
        <div
          ref={ref}
          className={cn(
            // --surface tells what sits on the card, such as a table's
            // sticky header, which colour it is on.
            'bg-card text-card-foreground [--surface:var(--card)]',
            glow ? 'shadow-card-glow' : 'shadow-card-edge',
            league && TINTS[league],
            className,
          )}
          {...props}
        />
      </CardContext.Provider>
    );
  },
);
Card.displayName = 'Card';

/**
 * The card's title row. On a league card it is a band of the league's
 * colour; otherwise it sits on the card, or on a band of the secondary
 * surface if the depth tokens say so.
 */
const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => {
  const { league } = React.useContext(CardContext);
  return (
    <div
      ref={ref}
      className={cn(
        'flex items-center justify-between gap-4 px-5',
        league
          ? cn('py-3', BANDS[league])
          : 'bg-header bg-header-fill pb-[var(--header-pad-bottom)] pt-[var(--header-pad-top)] text-secondary-foreground',
        className,
      )}
      {...props}
    />
  );
});
CardHeader.displayName = 'CardHeader';

const CardTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3 ref={ref} className={cn('font-bold', className)} {...props} />
));
CardTitle.displayName = 'CardTitle';

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('p-5', className)} {...props} />
));
CardContent.displayName = 'CardContent';

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('flex items-center gap-3 px-5 pb-5', className)}
    {...props}
  />
));
CardFooter.displayName = 'CardFooter';

export { Card, CardHeader, CardTitle, CardContent, CardFooter };
