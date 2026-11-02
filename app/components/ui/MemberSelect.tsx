import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from './command';
import { Popover, PopoverContent, PopoverTrigger } from './popover';
import { CONTROL, FOCUS_RING } from './styles';
import { CheckIcon, ChevronDownIcon } from '@radix-ui/react-icons';
import { useMemo, useState } from 'react';
import { cn } from '~/utils';

export type SelectableMember = {
  id: string;
  discordName: string;
  discordUsername?: string | null;
  /** Names they went by before, so an old nickname still finds them. */
  pastNames?: string[];
};

/**
 * What a member picker needs to find someone: their current name, plus their
 * @username and past names, since the name an admin remembers may be one they
 * have since changed.
 */
export function toSelectableMember(user: {
  id: string;
  discordName: string;
  discordUsername: string | null;
  nameHistory?: { name: string }[];
}): SelectableMember {
  return {
    id: user.id,
    discordName: user.discordName,
    discordUsername: user.discordUsername,
    pastNames: (user.nameHistory ?? [])
      .map(entry => entry.name)
      .filter(name => name !== user.discordName),
  };
}

type Props = {
  name: string;
  members: SelectableMember[];
  defaultValue?: string;
  placeholder?: string;
  className?: string;
};

/**
 * A searchable member picker. The member list runs into the hundreds, so a
 * plain select is unusable. The selection is mirrored into a hidden input so
 * this drops straight into a regular Remix Form.
 */
export default function MemberSelect({
  name,
  members,
  defaultValue = '',
  placeholder = 'Choose a member',
  className,
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedId, setSelectedId] = useState(defaultValue);

  // cmdk filters on the item value, and the value here is the member ID so that
  // members sharing a Discord name stay distinguishable. That means the filter
  // has to look the name back up itself.
  const namesById = useMemo(
    () => new Map(members.map(member => [member.id, member.discordName])),
    [members],
  );

  // Everything a member can be searched by: nicknames change often, so their
  // @username and past names find them too.
  const searchTextById = useMemo(
    () =>
      new Map(
        members.map(member => [
          member.id,
          [
            member.discordName,
            member.discordUsername ?? '',
            ...(member.pastNames ?? []),
          ]
            .join('\n')
            .toLowerCase(),
        ]),
      ),
    [members],
  );

  const selectedName = namesById.get(selectedId);

  return (
    <>
      <input type='hidden' name={name} value={selectedId} />
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <button
            type='button'
            className={cn(
              'inline-flex h-10 w-56 items-center justify-between gap-2 px-3 text-base',
              CONTROL,
              FOCUS_RING,
              className,
            )}
          >
            <span
              className={cn(
                'truncate',
                !selectedName && 'text-muted-foreground',
              )}
            >
              {selectedName ?? placeholder}
            </span>
            <ChevronDownIcon aria-hidden className='size-4 shrink-0' />
          </button>
        </PopoverTrigger>
        <PopoverContent className='w-72 p-0'>
          <Command
            filter={(value, search) =>
              (searchTextById.get(value) ?? '').includes(search.toLowerCase())
                ? 1
                : 0
            }
          >
            <CommandInput placeholder='Search members' />
            <CommandList>
              <CommandEmpty>No members match.</CommandEmpty>
              <CommandGroup>
                {members.map(member => (
                  <CommandItem
                    key={member.id}
                    value={member.id}
                    onSelect={() => {
                      setSelectedId(member.id);
                      setIsOpen(false);
                    }}
                  >
                    <CheckIcon
                      aria-hidden
                      className={cn(
                        member.id === selectedId ? 'opacity-100' : 'opacity-0',
                      )}
                    />
                    <span className='truncate'>
                      {member.discordName}
                      {member.discordUsername &&
                        member.discordUsername !== member.discordName && (
                          <span className='ml-2 text-sm text-muted-foreground'>
                            @{member.discordUsername}
                          </span>
                        )}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </>
  );
}
