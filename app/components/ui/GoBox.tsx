import { Button } from './button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './dropdown-menu';
import { ChevronDownIcon } from '@radix-ui/react-icons';

export type GoBoxMenuItem = {
  label: string;
  url: string;
};

type Props = {
  buttonText: string;
  options: GoBoxMenuItem[];
  disabled?: boolean;
};

/**
 * A button that opens a list of pages to go to, such as past seasons. Plain
 * links, so each choice loads the page afresh: the pages it serves keep
 * state (rows opened, filters) that should not carry over to another week
 * or year.
 */
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
            <a href={option.url}>{option.label}</a>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
