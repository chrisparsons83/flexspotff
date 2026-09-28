import MemberAvatar from './MemberAvatar';
import MemberName from './MemberName';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

const member = {
  discordId: '214093545747906562',
  discordAvatar: 'guilds/1/users/214093545747906562/avatars/guild.webp',
  discordUserAvatar: 'account',
};

describe('MemberAvatar', () => {
  it('shows the server avatar first', () => {
    render(<MemberAvatar user={member} alt='Panda' />);

    expect(screen.getByAltText('Panda')).toHaveAttribute(
      'src',
      'https://cdn.discordapp.com/guilds/1/users/214093545747906562/avatars/guild.webp?size=64',
    );
  });

  it('steps down to the account avatar, then the default, as images fail', () => {
    render(<MemberAvatar user={member} alt='Panda' />);
    const img = screen.getByAltText('Panda');

    fireEvent.error(img);
    expect(img.getAttribute('src')).toContain(
      '/avatars/214093545747906562/account.webp',
    );

    fireEvent.error(img);
    expect(img.getAttribute('src')).toMatch(/\/embed\/avatars\/\d\.png$/);

    // Nothing left to try: it stays on the default rather than looping.
    fireEvent.error(img);
    expect(img.getAttribute('src')).toMatch(/\/embed\/avatars\/\d\.png$/);
  });

  it('uses the default avatar for someone who never set one', () => {
    render(
      <MemberAvatar
        user={{ discordId: 'legacy:someone', discordAvatar: '' }}
        alt='Someone'
      />,
    );

    expect(screen.getByAltText('Someone')).toHaveAttribute(
      'src',
      'https://cdn.discordapp.com/embed/avatars/0.png',
    );
  });
});

describe('MemberName', () => {
  it('shows the @username on hover', () => {
    render(
      <MemberName
        user={{ discordName: 'Panda', discordUsername: 'pandabair' }}
      />,
    );

    expect(screen.getByText('Panda')).toHaveAttribute('title', '@pandabair');
  });

  it('has no tooltip when there is nothing more to say', () => {
    render(
      <MemberName
        user={{ discordName: 'pandabair', discordUsername: 'pandabair' }}
      />,
    );

    expect(screen.getByText('pandabair')).not.toHaveAttribute('title');
  });
});
