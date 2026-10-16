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
};

/**
 * A panel: a flat, solid area one step up from the page. No edge, no shadow.
 * Use one where a block needs to stand apart, not around every block; space
 * and the grid separate the rest. Cards do not go inside cards.
 */
const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, league, ...props }, ref) => {
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
 * A band across the top of the card: the secondary surface, or the league's
 * own colour on a league card.
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
        'flex items-center justify-between gap-4 px-5 py-3',
        league ? BANDS[league] : 'bg-secondary text-secondary-foreground',
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
