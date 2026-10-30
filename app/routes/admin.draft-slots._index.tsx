import type { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/node';
import {
  typedjson,
  useTypedActionData,
  useTypedLoaderData,
} from 'remix-typedjson';
import z from 'zod';
import DraftSlotRow from '~/components/layout/admin/DraftSlotRow';
import Alert from '~/components/ui/Alert';
import { Button } from '~/components/ui/button';
import { Link } from '~/components/ui/link';
import { Section } from '~/components/ui/section';
import { Table } from '~/components/ui/table';
import {
  createDraftSlot,
  deleteDraftSlot,
  getDraftSlotsWithPreferenceCounts,
  getUniqueUsersWithPreferences,
  updateDraftSlot,
} from '~/models/draftSlot.server';
import { authenticator, requireAdmin } from '~/services/auth.server';
import { isSuccessWithMessage, isErrorResponse } from '~/utils/types';

const draftSlotSchema = z.object({
  id: z.string().optional(),
  draftDateTime: z.string().optional(),
  seasonId: z.string().optional(),
  action: z.enum(['create', 'update', 'delete']),
});

export const action = async ({ request }: ActionFunctionArgs) => {
  const user = await authenticator.isAuthenticated(request, {
    failureRedirect: '/login',
  });
  requireAdmin(user);

  const formData = await request.formData();
  const submission = draftSlotSchema.safeParse(Object.fromEntries(formData));

  if (!submission.success) {
    return typedjson(
      { success: false, error: submission.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const { id, draftDateTime, seasonId, action } = submission.data;

  try {
    switch (action) {
      case 'create':
        if (!draftDateTime || !seasonId) {
          return typedjson(
            {
              success: false,
              error: {
                general: ['Draft date/time and season are required'],
              },
            },
            { status: 400 },
          );
        }
        await createDraftSlot({
          draftDateTime: new Date(draftDateTime),
          seasonId,
        });
        return typedjson({
          success: true,
          message: 'Draft slot created successfully',
        });

      case 'update':
        if (!id) {
          return typedjson(
            {
              success: false,
              error: { general: ['ID is required for update'] },
            },
            { status: 400 },
          );
        }
        if (!draftDateTime || !seasonId) {
          return typedjson(
            {
              success: false,
              error: {
                general: ['Draft date/time and season are required'],
              },
            },
            { status: 400 },
          );
        }
        await updateDraftSlot({
          id,
          draftDateTime: new Date(draftDateTime),
          seasonId,
        });
        return typedjson({
          success: true,
          message: 'Draft slot updated successfully',
        });

      case 'delete':
        if (!id) {
          return typedjson(
            {
              success: false,
              error: { general: ['ID is required for delete'] },
            },
            { status: 400 },
          );
        }
        await deleteDraftSlot({ id });
        return typedjson({
          success: true,
          message: 'Draft slot deleted successfully',
        });

      default:
        return typedjson(
          { success: false, error: { general: ['Invalid action'] } },
          { status: 400 },
        );
    }
  } catch (error) {
    console.error('Draft slot operation error:', error);
    return typedjson(
      {
        success: false,
        error: { general: ['Operation failed. Please try again.'] },
      },
      { status: 500 },
    );
  }
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const user = await authenticator.isAuthenticated(request, {
    failureRedirect: '/login',
  });
  requireAdmin(user);

  const [draftSlots, uniqueUsersCount] = await Promise.all([
    getDraftSlotsWithPreferenceCounts(),
    getUniqueUsersWithPreferences(),
  ]);

  return typedjson({ draftSlots, uniqueUsersCount });
};

export default function DraftSlotsAdmin() {
  const { draftSlots, uniqueUsersCount } = useTypedLoaderData<typeof loader>();
  const actionData = useTypedActionData<typeof action>();

  return (
    <Section
      title='Draft Slots'
      description={`${uniqueUsersCount} ${
        uniqueUsersCount === 1 ? 'member has' : 'members have'
      } entered their draft time preferences.`}
      action={
        <Button asChild>
          <Link to='/admin/draft-slots/new' variant='quiet'>
            Add Draft Slot
          </Link>
        </Button>
      }
    >
      {isSuccessWithMessage(actionData) && (
        <Alert message={actionData.message} className='mb-6' />
      )}
      {isErrorResponse(actionData) && (
        <Alert
          message={
            ('general' in actionData.error && actionData.error.general?.[0]) ||
            'Something went wrong. Try again.'
          }
          status='error'
          className='mb-6'
        />
      )}
      <Table
        headers={['Season', 'Draft Time', 'Available', 'Actions']}
        numericColumns={[2]}
      >
        {draftSlots.length === 0 ? (
          <tr>
            <td colSpan={4} className='text-muted-foreground'>
              No draft slots yet.
            </td>
          </tr>
        ) : (
          draftSlots.map((slot: any) => (
            <DraftSlotRow key={slot.id} slot={slot} />
          ))
        )}
      </Table>
    </Section>
  );
}
