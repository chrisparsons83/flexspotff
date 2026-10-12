/**
 * The /design reference mocks (#191) are for building the redesign, not for
 * members, so they only exist in development.
 */
export const requireDesignMocks = () => {
  if (process.env.NODE_ENV !== 'development') {
    throw new Response('Not found', { status: 404 });
  }
  return null;
};
