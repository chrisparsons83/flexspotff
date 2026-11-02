import { errorPage } from './error-page';
import { describe, expect, it } from 'vitest';

const response = (status: number, data: unknown) => ({
  status,
  statusText: '',
  internal: false,
  data,
});

describe('errorPage', () => {
  it('uses a loader’s own message for a 404, as a sentence', () => {
    expect(errorPage(response(404, 'League not found'))).toEqual({
      title: 'Page Not Found',
      message: 'League not found.',
    });
  });

  it('replaces a message that only repeats the status', () => {
    expect(errorPage(response(404, 'Not Found')).message).toBe(
      'There is no page at this address.',
    );
    expect(
      errorPage(response(404, 'Error: No route matches URL "/x"')).message,
    ).toBe('There is no page at this address.');
  });

  it('explains a 403', () => {
    expect(errorPage(response(403, 'Forbidden')).title).toBe('No Access');
  });

  it('keeps a thrown error’s text as the detail', () => {
    const page = errorPage(new Error('Week missing'));
    expect(page.title).toBe('Something Went Wrong');
    expect(page.detail).toBe('Week missing');
  });
});
