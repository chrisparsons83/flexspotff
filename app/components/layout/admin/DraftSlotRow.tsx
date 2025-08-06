import { ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/outline';
import { Form, Link } from '@remix-run/react';
import { useState } from 'react';
import Button from '~/components/ui/Button';

type User = {
  id: string;
  discordName: string;
};

type DraftSlot = {
  id: string;
  season: number;
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
        <td>{slot.season}</td>
        <td className='flex items-center gap-3'>
          {new Date(slot.draftDateTime).toLocaleString(undefined, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            timeZoneName: 'short'
          })}
          {slot.availableCount > 0 && (
            <>
              {' '}
              {showDetails ? (
                <ChevronUpIcon
                  width={20}
                  height={20}
                  onClick={handleAccordion}
                  className='cursor-pointer'
                  aria-label='Hide Available Users'
                />
              ) : (
                <ChevronDownIcon
                  width={20}
                  height={20}
                  onClick={handleAccordion}
                  className='cursor-pointer'
                  aria-label='Show Available Users'
                />
              )}
            </>
          )}
        </td>
        <td style={{ textAlign: 'center', fontWeight: 'bold' }}>
          {slot.availableCount}
        </td>
        <td className='not-prose'>
          <Link to={`/admin/draft-slots/${slot.id}/edit`}>
            <Button type="button">Edit</Button>
          </Link>
          {' '}
          <Form method="post" style={{ display: 'inline' }}>
            <input type="hidden" name="id" value={slot.id} />
            <input type="hidden" name="action" value="delete" />
            <Button
              type="submit"
              onClick={(e) => {
                if (!confirm('Are you sure you want to delete this draft slot?')) {
                  e.preventDefault();
                }
              }}
            >
              Delete
            </Button>
          </Form>
        </td>
      </tr>
      {showDetails && (
        <tr className='bg-gray-800'>
          <td></td>
          <td colSpan={3}>
            <div style={{ padding: '1rem' }}>
              {slot.availableUsers.length === 0 ? (
                <div style={{ fontStyle: 'italic', color: '#666' }}>
                  No users have selected this time slot yet.
                </div>
              ) : (
                <div 
                  style={{ 
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                    gap: '0.5rem',
                    maxWidth: '100%'
                  }}
                >
                  {slot.availableUsers
                    .sort((a, b) => a.discordName.localeCompare(b.discordName))
                    .map(user => (
                      <div key={user.id} style={{ padding: '0.25rem 0' }}>
                        {user.discordName}
                      </div>
                    ))}
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
