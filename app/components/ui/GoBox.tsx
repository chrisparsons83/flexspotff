import { Menu, Transition } from '@headlessui/react';
import clsx from 'clsx';
import { Fragment } from 'react';

export type GoBoxMenuItem = {
  label: string;
  url: string;
};

type Props = {
  buttonText: string;
  options: GoBoxMenuItem[];
  disabled?: boolean;
};

export default function GoBox({ buttonText, options, disabled }: Props) {
  return (
    <Menu as='div' className='relative inline-block text-left'>
      <Menu.Button
        type='button'
        disabled={disabled}
        className={clsx(
          'inline-flex justify-center rounded-md bg-black bg-opacity-20 px-4 py-2 text-sm font-medium text-white hover:bg-opacity-30 focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-opacity-75',
          disabled && 'cursor-not-allowed opacity-50',
        )}
      >
        {buttonText}
      </Menu.Button>
      <Transition
        as={Fragment}
        enter='transition ease-out duration-100'
        enterFrom='transform opacity-0 scale-95'
        enterTo='transform opacity-100 scale-100'
        leave='transition ease-in duration-75'
        leaveFrom='transform opacity-100 scale-100'
        leaveTo='transform opacity-0 scale-95'
      >
        <Menu.Items className='absolute right-0 mt-2 w-36 origin-top-right rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none p-1'>
          {options.map(option => (
            <Menu.Item key={option.label}>
              {({ active }) => (
                <a
                  href={option.url}
                  className={clsx(
                    active ? 'bg-gray-800 text-white' : 'text-gray-900',
                    'group flex items-center rounded-md px-2 py-2 text-sm no-underline',
                  )}
                >
                  {option.label}
                </a>
              )}
            </Menu.Item>
          ))}
        </Menu.Items>
      </Transition>
    </Menu>
  );
}
