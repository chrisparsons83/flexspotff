import { ChevronDownIcon, ChevronUpIcon } from '@radix-ui/react-icons';
import { Form } from '@remix-run/react';
import { useState } from 'react';
import LocalDateTime from '~/components/ui/LocalDateTime';
import { Button } from '~/components/ui/button';
import { Link } from '~/components/ui/link';
import { FOCUS_RING } from '~/components/ui/styles';
import { cn } from '~/utils';

type User = {
  id: string;
  discordName: string;
};

type DraftSlot = {
  id: string;
  season: { year: number };
  draftDateTime: Date;
  availableCount: number;
  availableUsers: User[];
};

type Props = {
  slot: DraftSlot;
};

export default function DraftSlotRow({ slot }: Props) {
  const [showDetails, setShowDetails] = useState(false);

  const handleAccordion = () => {
    setShowDetails(prevState => !prevState);
  };

  return (
    <>
      <tr>
        <td>{slot.season.year}</td>
        <td>
          <div className='flex items-center gap-3'>
            <LocalDateTime
              value={slot.draftDateTime}
              options={{
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
                timeZoneName: 'short',
              }}
            />
            {slot.availableCount > 0 && (
              <button
                type='button'
                onClick={handleAccordion}
                aria-expanded={showDetails}
                aria-label={
                  showDetails
                    ? 'Hide Available Members'
                    : 'Show Available Members'
                }
                className={cn(
                  'inline-flex size-8 items-center justify-center text-muted-foreground hover:bg-secondary hover:text-foreground',
                  FOCUS_RING,
                )}
              >
                {showDetails ? (
                  <ChevronUpIcon aria-hidden />
                ) : (
                  <ChevronDownIcon aria-hidden />
                )}
              </button>
            )}
          </div>
        </td>
        <td className='text-right font-semibold'>{slot.availableCount}</td>
        <td>
          <div className='flex flex-wrap gap-2'>
            <Button asChild variant='secondary' size='sm'>
              <Link to={`/admin/draft-slots/${slot.id}/edit`} variant='quiet'>
                Edit
              </Link>
            </Button>
            <Form method='post'>
              <input type='hidden' name='id' value={slot.id} />
              <input type='hidden' name='action' value='delete' />
              <Button
                type='submit'
                variant='secondary'
                size='sm'
                onClick={e => {
                  if (!confirm('Delete this draft slot?')) {
                    e.preventDefault();
                  }
                }}
              >
                Delete
              </Button>
            </Form>
          </div>
        </td>
      </tr>
      {showDetails && (
        <tr className='bg-muted'>
          <td></td>
          <td colSpan={3}>
            {slot.availableUsers.length === 0 ? (
              <p className='text-muted-foreground'>
                No members have picked this slot yet.
              </p>
            ) : (
              <ul className='grid gap-1 sm:grid-cols-2 lg:grid-cols-3'>
                {slot.availableUsers
                  .sort((a, b) => a.discordName.localeCompare(b.discordName))
                  .map(user => (
                    <li key={user.id}>{user.discordName}</li>
                  ))}
              </ul>
            )}
          </td>
        </tr>
      )}
    </>
  );
}
