import clsx from 'clsx';
import { useEffect, useRef, useState } from 'react';
import { avatarCandidates } from '~/utils/discord';

type Props = {
  user: {
    discordId: string;
    discordAvatar: string;
    discordUserAvatar?: string | null;
  };
  /** Rendered size in CSS pixels. */
  size?: number;
  className?: string;
  alt?: string;
};

/** Discord serves avatars at powers of two; ask for one sharp on 2x screens. */
const cdnSize = (size: number) =>
  Math.min(4096, 2 ** Math.ceil(Math.log2(Math.max(16, size * 2))));

/**
 * A member's avatar as the Discord server shows it.
 *
 * A stored avatar stops loading as soon as the member uploads a new one, and
 * stays broken until the next sync notices. Rather than show a broken image,
 * this steps down to their account avatar and then to Discord's default one.
 */
export default function MemberAvatar({
  user,
  size = 32,
  className,
  alt = '',
}: Props) {
  const candidates = avatarCandidates(user, cdnSize(size));
  const [index, setIndex] = useState(0);
  const imgRef = useRef<HTMLImageElement>(null);
  const first = candidates[0];

  // A different member (or a freshly synced avatar) starts from the top again.
  useEffect(() => {
    setIndex(0);
  }, [first]);

  const next = () =>
    setIndex(current => Math.min(current + 1, candidates.length - 1));

  // An image that failed while the page was still server-rendered HTML fired its
  // error before React was listening, so check for that once hydrated.
  useEffect(() => {
    const img = imgRef.current;
    if (img?.complete && img.naturalWidth === 0) {
      next();
    }
    // Only on mount and when the member changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [first]);

  return (
    <img
      ref={imgRef}
      src={candidates[Math.min(index, candidates.length - 1)]}
      alt={alt}
      width={size}
      height={size}
      loading='lazy'
      onError={next}
      className={clsx('rounded-full bg-slate-700 object-cover', className)}
      style={{ width: size, height: size }}
    />
  );
}
