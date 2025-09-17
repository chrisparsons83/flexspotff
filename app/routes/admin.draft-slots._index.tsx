import type { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/node';
import { Link } from '@remix-run/react';
import {
  typedjson,
  useTypedActionData,
  useTypedLoaderData,
} from 'remix-typedjson';
import z from 'zod';
import DraftSlotRow from '~/components/layout/admin/DraftSlotRow';
import Alert from '~/components/ui/Alert';
import Button from '~/components/ui/FlexSpotButton';
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
  draftDateTime: z.string().min(1, 'Draft date and time is required'),
  season: z.string().min(1, 'Season is required').transform(Number),
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

  const { id, draftDateTime, season, action } = submission.data;

  try {
    switch (action) {
      case 'create':
        await createDraftSlot({
          draftDateTime: new Date(draftDateTime),
          season,
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
        await updateDraftSlot({
          id,
          draftDateTime: new Date(draftDateTime),
          season,
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
    <>
      <h2>Draft Slots Management</h2>
      <p>
        <Link to='/admin/draft-slots/new'>
          <Button type='button'>Add New Draft Slot</Button>
        </Link>
      </p>
      <p>
        {uniqueUsersCount} unique{' '}
        {uniqueUsersCount === 1 ? 'person has' : 'people have'} entered their
        draft time preferences.
      </p>
      {isSuccessWithMessage(actionData) && (
        <Alert message={actionData.message} />
      )}
      {isErrorResponse(actionData) && (
        <Alert
          message={
            ('general' in actionData.error && actionData.error.general?.[0]) ||
            'An error occurred. Please try again.'
          }
        />
      )}
      <table className='w-full'>
        <thead>
          <tr>
            <th>Season</th>
            <th>Draft Date & Time</th>
            <th>Available People</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {draftSlots.length === 0 ? (
            <tr>
              <td colSpan={4} style={{ textAlign: 'center', padding: '20px' }}>
                No draft slots found. Create your first draft slot to get
                started.
              </td>
            </tr>
          ) : (
            draftSlots.map((slot: any) => (
              <DraftSlotRow key={slot.id} slot={slot} />
            ))
          )}
        </tbody>
      </table>
    </>
  );
}
