import { Button } from './button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './dropdown-menu';
import { ChevronDownIcon } from '@radix-ui/react-icons';
import { Link } from '@remix-run/react';

export type GoBoxMenuItem = {
  label: string;
  url: string;
};

type Props = {
  buttonText: string;
  options: GoBoxMenuItem[];
  disabled?: boolean;
};

/** A button that opens a list of pages to go to, such as past seasons. */
export default function GoBox({ buttonText, options, disabled }: Props) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild disabled={disabled}>
        <Button variant='secondary' size='sm'>
          {buttonText}
          <ChevronDownIcon aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className='max-h-80 overflow-y-auto'>
        {options.map(option => (
          <DropdownMenuItem key={option.label} asChild>
            <Link to={option.url}>{option.label}</Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
