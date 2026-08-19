import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from './command';
import { Popover, PopoverContent, PopoverTrigger } from './popover';
import { CaretSortIcon, CheckIcon } from '@radix-ui/react-icons';
import { useMemo, useState } from 'react';
import { cn } from '~/utils';

export type SelectableMember = {
  id: string;
  discordName: string;
};

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
  placeholder = 'Select member...',
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

  const selectedName = namesById.get(selectedId);

  return (
    <>
      <input type='hidden' name={name} value={selectedId} />
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <button
            type='button'
            className={cn(
              'inline-flex w-56 items-center justify-between gap-2 rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100 hover:bg-slate-700',
              className,
            )}
          >
            <span className={cn('truncate', !selectedName && 'text-slate-400')}>
              {selectedName ?? placeholder}
            </span>
            <CaretSortIcon className='h-4 w-4 shrink-0 opacity-50' />
          </button>
        </PopoverTrigger>
        <PopoverContent className='w-56 border-slate-600 bg-slate-700 p-0 text-slate-100'>
          <Command
            className='bg-slate-700 text-slate-100'
            filter={(value, search) =>
              (namesById.get(value) ?? '')
                .toLowerCase()
                .includes(search.toLowerCase())
                ? 1
                : 0
            }
          >
            <CommandInput placeholder='Search members...' className='h-9' />
            <CommandList>
              <CommandEmpty>No members found.</CommandEmpty>
              <CommandGroup>
                {members.map(member => (
                  <CommandItem
                    key={member.id}
                    value={member.id}
                    onSelect={() => {
                      setSelectedId(member.id);
                      setIsOpen(false);
                    }}
                    className='data-[selected=true]:bg-slate-600 data-[selected=true]:text-slate-50'
                  >
                    <CheckIcon
                      className={cn(
                        'h-4 w-4',
                        member.id === selectedId ? 'opacity-100' : 'opacity-0',
                      )}
                    />
                    {member.discordName}
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
