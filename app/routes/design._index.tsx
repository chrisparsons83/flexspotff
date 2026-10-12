import { Link } from '@remix-run/react';
import { MockShell } from '~/components/mocks/MockShell';
import { requireDesignMocks } from '~/services/design.server';

export const loader = () => requireDesignMocks();

const MOCKS = [
  { to: '/design/home', name: 'Home', about: 'The week at a glance.' },
  {
    to: '/design/standings',
    name: 'Standings',
    about: 'One league, with the shared game sub-navigation.',
  },
  {
    to: '/design/profile',
    name: 'Profile',
    about: 'A member’s honours and seasons.',
  },
];

export default function DesignIndex() {
  return (
    <MockShell current=''>
      <h1 className='text-3xl font-semibold'>Reference mocks</h1>
      <p className='mt-4 max-w-prose text-muted-foreground'>
        Built only from the design tokens, with sample data. Development only.
        Switch themes from the top right.
      </p>
      <table className='mt-12 w-full text-left'>
        <tbody>
          {MOCKS.map(mock => (
            <tr key={mock.to} className='border-t border-border'>
              <td className='py-3 pr-6 font-semibold'>
                <Link to={mock.to} className='underline underline-offset-4'>
                  {mock.name}
                </Link>
              </td>
              <td className='py-3 text-muted-foreground'>{mock.about}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </MockShell>
  );
}
