import { splitDiscordMessage } from './admin-alerts';
import { describe, expect, it } from 'vitest';

describe('splitDiscordMessage', () => {
  it('leaves a short message whole', () => {
    expect(splitDiscordMessage('one\ntwo')).toEqual(['one\ntwo']);
  });

  it('breaks between lines and keeps every message under the limit', () => {
    const lines = Array.from({ length: 300 }, (_, i) => `QB number ${i}`);
    const messages = splitDiscordMessage(lines.join('\n'));

    expect(messages.length).toBeGreaterThan(1);
    for (const message of messages) {
      expect(message.length).toBeLessThanOrEqual(2000);
    }
    expect(messages.join('\n').split('\n')).toEqual(lines);
  });

  it('hard-splits a single line longer than the limit', () => {
    const messages = splitDiscordMessage('x'.repeat(25), 10);

    expect(messages).toEqual(['x'.repeat(10), 'x'.repeat(10), 'x'.repeat(5)]);
  });
});
