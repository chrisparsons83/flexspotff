type Props = {
  user: {
    discordName: string;
    discordUsername?: string | null;
  };
  className?: string;
};

/**
 * A member's name as the Discord server shows it. Nicknames change often, so
 * hovering shows their @username, which changes far less.
 */
export default function MemberName({ user, className }: Props) {
  const handle = user.discordUsername;
  const title =
    handle && handle !== user.discordName ? `@${handle}` : undefined;

  return (
    <span title={title} className={className}>
      {user.discordName}
    </span>
  );
}
