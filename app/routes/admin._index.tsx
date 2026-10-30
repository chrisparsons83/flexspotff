import type { LoaderFunctionArgs } from '@remix-run/node';
import { typedjson, useTypedLoaderData } from 'remix-typedjson';
import { EmptyState } from '~/components/ui/empty-state';
import { Link } from '~/components/ui/link';
import { Section } from '~/components/ui/section';
import { Table } from '~/components/ui/table';
import { getAdminTasks } from '~/libs/admin/home.server';
import { authenticator, isAdmin } from '~/services/auth.server';

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const user = await authenticator.isAuthenticated(request, {
    failureRedirect: '/login',
  });
  // Podcast editors see the admin home too, but none of this is theirs.
  if (!(await isAdmin(user))) {
    return typedjson({ isAdmin: false, week: null, tasks: [] });
  }
  return typedjson({ isAdmin: true, ...(await getAdminTasks()) });
};

export default function AdminHome() {
  const { isAdmin, week, tasks } = useTypedLoaderData<typeof loader>();

  if (!isAdmin) {
    return (
      <EmptyState
        title='Nothing waiting'
        action={<Link to='/admin/podcasts'>Podcasts</Link>}
      >
        Podcast episodes are managed from the podcasts page.
      </EmptyState>
    );
  }

  return (
    <Section title={week ? `Week ${week}` : 'This Week'}>
      {tasks.length === 0 ? (
        <EmptyState title='Nothing needs doing this week' />
      ) : (
        <Table headers={['Task', 'Where It Stands']} primaryColumns={[1]}>
          {tasks.map(task => (
            <tr key={task.href + task.title}>
              <td className='font-semibold'>
                <Link to={task.href}>{task.title}</Link>
              </td>
              <td className='text-muted-foreground'>{task.detail}</td>
            </tr>
          ))}
        </Table>
      )}
    </Section>
  );
}
