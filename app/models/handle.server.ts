import { prisma } from '~/db.server';

/**
 * The handle a name would get before any clash is settled: lowercase, runs of
 * spaces become a hyphen, and anything a URL would have to escape is dropped.
 * A Discord @username is already in this shape and passes through as is, bar a
 * leading or trailing dot.
 *
 * Mirrors the backfill in the add_user_handle migration - change both or
 * neither.
 */
export function toHandleBase(name: string) {
  const base = name
    .toLowerCase()
    .replace(/[\s-]+/g, '-')
    .replace(/[^a-z0-9_.-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '');

  // A name that is all emoji or punctuation leaves nothing behind.
  return base || 'member';
}

/**
 * Sheet-only placeholders, made up for names on old sheets so their history has
 * somewhere to live. They can never log in, so nobody links to them by handle.
 */
const isPlaceholder = (discordId: string) => discordId.startsWith('legacy:');

/**
 * The first of base, base-2, base-3... that nobody else holds. The member's own
 * handle does not count, so re-claiming leaves them where they are.
 */
async function nextFreeHandle(base: string, userId?: string) {
  const taken = new Set(
    (
      await prisma.user.findMany({
        where: {
          handle: { startsWith: base },
          ...(userId ? { id: { not: userId } } : {}),
        },
        select: { handle: true },
      })
    ).map(user => user.handle),
  );

  let candidate = base;
  for (let n = 2; taken.has(candidate); n++) {
    candidate = `${base}-${n}`;
  }
  return candidate;
}

/**
 * The handle for a member: their Discord @username if we know it, else their
 * server name, with -2, -3... added when it is already taken.
 *
 * A handle made from a server name is provisional - the member has no
 * discordUsername yet. The first time Discord reports one, applyDiscordProfile
 * claims the @username handle in its place, and from then on it never changes,
 * so renames cannot break a link.
 *
 * An @username outranks a placeholder: if a sheet-only stub got there first, it
 * is moved to the next free number and the real member gets the name. Nobody
 * else is ever bumped.
 *
 * `userId` is the member claiming it, so their own current handle does not
 * count as taken.
 */
export async function claimHandle(name: {
  username?: string | null;
  displayName: string;
  userId?: string;
}) {
  // ?? rather than ||, to match the coalesce() in the migration's backfill.
  const base = toHandleBase(name.username ?? name.displayName);

  const holder = await prisma.user.findUnique({
    where: { handle: base },
    select: { id: true, discordId: true },
  });

  if (!holder || holder.id === name.userId) return base;

  if (name.username && isPlaceholder(holder.discordId)) {
    await prisma.user.update({
      where: { id: holder.id },
      data: { handle: await nextFreeHandle(base) },
    });
    return base;
  }

  return nextFreeHandle(base, name.userId);
}

const isHandleClash = (error: unknown) =>
  typeof error === 'object' &&
  error !== null &&
  'code' in error &&
  error.code === 'P2002' &&
  'meta' in error &&
  JSON.stringify((error as { meta?: unknown }).meta ?? '').includes('handle');

/**
 * Runs a write that claims a handle, trying again if another write took the
 * same handle between claimHandle reading it and this write saving it - two
 * new members with the same name logging in at once.
 */
export async function withHandleRetry<T>(write: () => Promise<T>) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await write();
    } catch (error) {
      if (attempt >= 3 || !isHandleClash(error)) throw error;
    }
  }
}
