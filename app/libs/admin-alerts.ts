/** Discord rejects a message whose content is longer than this. */
export const DISCORD_MESSAGE_LIMIT = 2000;

/**
 * Splits text into messages Discord will accept, breaking between lines so a
 * list never has an entry cut in half. A single line longer than the limit is
 * hard-split, since there is nowhere better to break it.
 */
export function splitDiscordMessage(
  text: string,
  limit = DISCORD_MESSAGE_LIMIT,
): string[] {
  const messages: string[] = [];
  let current = '';

  for (const line of text.split('\n')) {
    const pieces: string[] = [];
    for (let start = 0; start < line.length || pieces.length === 0; ) {
      pieces.push(line.slice(start, start + limit));
      start += limit;
    }

    for (const piece of pieces) {
      const next = current ? `${current}\n${piece}` : piece;
      if (next.length <= limit) {
        current = next;
      } else {
        messages.push(current);
        current = piece;
      }
    }
  }

  if (current.trim()) messages.push(current);
  return messages.map(message => message.trim()).filter(Boolean);
}
