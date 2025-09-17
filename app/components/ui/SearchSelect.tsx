import { Button } from './button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from './command';
import { Popover, PopoverContent, PopoverTrigger } from './popover';
import type { Player } from '@prisma/client';
import clsx from 'clsx';
import { useState, useEffect, useRef, useCallback } from 'react';

type SearchSelectProps = {
  options: string[];
  positionPlayersFull: Player[];
  className?: string;
  onOptionSelect: (option: string) => void;
  onOptionSelectedChange: (value: string) => void;
  value?: string;
  disabled?: boolean;
  playerMatchups: Record<string, string>;
  allSelectedPlayers: Map<
    string,
    { weekId: string; weekNumber: number; position: string; playerName: string }
  >;
};

export default function SearchSelect({
  options,
  className,
  onOptionSelect,
  onOptionSelectedChange,
  value = '',
  disabled = false,
  playerMatchups,
  allSelectedPlayers,
  positionPlayersFull,
}: SearchSelectProps) {
  // Initialize state with the value prop to ensure consistency between server and client
  const [query, setQuery] = useState(value);
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [selectedOption, setSelectedOption] = useState<string>(value);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLUListElement>(null);
  const isDeleting = useRef(false);

  // Update query and selected option when value prop changes
  useEffect(() => {
    // Only update if we're not actively deleting and value is different
    if (!isDeleting.current && value !== query) {
      setQuery(value);
      setSelectedOption(value);
    }
  }, [value, query]);

  console.log({ allSelectedPlayers, positionPlayersFull, options });

  // Handle option selection from dropdown
  const handleOptionSelect = useCallback(
    (option: string) => {
      if (disabled) return;

      isDeleting.current = false;
      setQuery(option);
      setSelectedOption(option);
      onOptionSelect(option);
      onOptionSelectedChange(option);
      setIsPopoverOpen(false);
    },
    [disabled, onOptionSelect, onOptionSelectedChange],
  );

  // Handle click outside
  useEffect(() => {
    // Only add event listener on the client side
    if (typeof window === 'undefined') return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        // Only revert if not actively deleting and there's a query
        if (
          !isDeleting.current &&
          query.trim() &&
          !options.find(opt => opt.toLowerCase() === query.toLowerCase())
        ) {
          setQuery(selectedOption);
          onOptionSelectedChange(selectedOption);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [options, query, selectedOption, onOptionSelectedChange]);

  const playerValue = options.find(option => option === value);

  return (
    <div className={clsx(className, 'relative')}>
      <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
        <PopoverTrigger asChild>
          <Button
            variant='outline'
            role='combobox'
            aria-expanded={isPopoverOpen}
            className='w-[200px] justify-between'
          >
            {playerValue
              ? `${playerValue} ${playerMatchups[playerValue]}`
              : 'Select player...'}
          </Button>
        </PopoverTrigger>
        <PopoverContent className='w-[200px] p-0 bg-slate-700'>
          <Command>
            <CommandInput placeholder='Search...' className='h-9' />
            <CommandList>
              <CommandEmpty>No players found.</CommandEmpty>
              <CommandGroup>
                {positionPlayersFull.map(player => (
                  <CommandItem
                    key={player.fullName}
                    value={player.fullName}
                    onSelect={() => handleOptionSelect(player.fullName)}
                    disabled={
                      allSelectedPlayers.has(player.id) &&
                      player.fullName !== value
                    }
                  >
                    {player.fullName} {playerMatchups[player.fullName]}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
