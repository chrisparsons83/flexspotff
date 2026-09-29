import { z } from 'zod';
import {
  createStubMemberForAlias,
  deleteMemberAlias,
  upsertMemberAlias,
} from '~/models/memberAlias.server';
import { getUser } from '~/models/user.server';

/** The form actions of `SheetNamesTable`, shared by every sheet import. */
export const SHEET_NAME_ACTIONS = ['matchName', 'createStub', 'unmatch'];

const zName = z.string().trim().min(1, 'No sheet name was submitted.');

type Result = { message: string; status: 'success' | 'error' };

/**
 * Handles a Match, Create stub member or Unmatch press from the names table.
 * The caller checks for an admin first.
 */
export async function handleSheetNameAction(
  formData: FormData,
): Promise<Result> {
  const fail = (message: string): Result => ({ message, status: 'error' });

  const name = zName.safeParse(formData.get('name'));
  if (!name.success) return fail(name.error.issues[0].message);

  switch (formData.get('_action')) {
    case 'matchName': {
      const userId = z
        .string()
        .min(1, 'Pick a member to match this name to.')
        .safeParse(formData.get('userId'));
      if (!userId.success) return fail(userId.error.issues[0].message);

      const member = await getUser(userId.data);
      if (!member) return fail('Member not found.');
      // The picker only lists live members, so a merged-away one came from a
      // form loaded before the merge.
      if (member.mergedIntoId) {
        return fail(
          `${member.discordName} was merged into another member. Reload the page and pick the member they were merged into.`,
        );
      }

      await upsertMemberAlias(name.data, member.id);
      return {
        message: `${name.data} is now matched to ${member.discordName}.`,
        status: 'success',
      };
    }
    case 'createStub': {
      await createStubMemberForAlias(name.data);
      return {
        message: `Created a stub member for ${name.data}. Merge it into their real account if they ever join.`,
        status: 'success',
      };
    }
    case 'unmatch': {
      await deleteMemberAlias(name.data);
      return {
        message: `${name.data} is no longer matched to anyone.`,
        status: 'success',
      };
    }
  }

  return fail('Unknown action.');
}
