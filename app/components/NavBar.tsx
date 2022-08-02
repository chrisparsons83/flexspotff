/* This example requires Tailwind CSS v2.0+ */
import { Fragment } from "react";
import { Disclosure, Menu, Transition } from "@headlessui/react";
import { MenuIcon, UserIcon, XIcon } from "@heroicons/react/outline";
import clsx from "clsx";
import { Form } from "@remix-run/react";
import type { User } from "~/models/user.server";

const navigation = [
  { name: "Home", href: "/", current: true },
  { name: "Standings", href: "/standings", current: false },
  { name: "Leaderboard", href: "/leaderboard", current: false },
  { name: "ADP", href: "/adp", current: false },
  { name: "Records", href: "/records", current: false },
  { name: "Podcast", href: "/podcast", current: false },
];

interface Props {
  user: User | null;
  userIsAdmin: boolean;
}

export default function NavBar({ user, userIsAdmin }: Props) {
  const avatarImage =
    user &&
    user.discordAvatar &&
    `https://cdn.discordapp.com/${user.discordAvatar}`;

  return (
    <Disclosure as="nav" className="bg-gray-800">
      {({ open }) => (
        <>
          <div className="mx-auto max-w-7xl px-2 sm:px-6 lg:px-8">
            <div className="relative flex h-16 items-center justify-between">
              <div className="absolute inset-y-0 left-0 flex items-center sm:hidden">
                {/* Mobile menu button*/}
                <Disclosure.Button className="inline-flex items-center justify-center rounded-md p-2 text-gray-400 hover:bg-gray-700 hover:text-white focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white">
                  <span className="sr-only">Open main menu</span>
                  {open ? (
                    <XIcon className="block h-6 w-6" aria-hidden="true" />
                  ) : (
                    <MenuIcon className="block h-6 w-6" aria-hidden="true" />
                  )}
                </Disclosure.Button>
              </div>
              <div className="flex flex-1 items-center justify-center sm:items-stretch sm:justify-start">
                <div className="flex flex-shrink-0 items-center">
                  <img
                    className="h-8 w-auto"
                    src="/theflexspotlogo.svg"
                    alt="The Flex Spot"
                  />
                </div>
                <div className="hidden sm:ml-6 sm:block">
                  <div className="flex space-x-4">
                    {navigation.map((item) => (
                      <a
                        key={item.name}
                        href={item.href}
                        className={clsx(
                          item.current
                            ? "bg-gray-900 text-white"
                            : "text-gray-300 hover:bg-gray-700 hover:text-white",
                          "rounded-md px-3 py-2 text-sm font-medium"
                        )}
                        aria-current={item.current ? "page" : undefined}
                      >
                        {item.name}
                      </a>
                    ))}
                  </div>
                </div>
              </div>
              <div className="absolute inset-y-0 right-0 flex items-center pr-2 sm:static sm:inset-auto sm:ml-6 sm:pr-0">
                {/* Profile dropdown */}
                <Menu as="div" className="relative ml-3">
                  <div>
                    <Menu.Button className="flex rounded-full bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-gray-800">
                      <span className="sr-only">Open user menu</span>
                      {user ? (
                        <img
                          src={avatarImage!}
                          className="block h-8 w-8"
                          alt={user.discordName}
                        />
                      ) : (
                        <UserIcon className="block h-8 w-8" />
                      )}
                    </Menu.Button>
                  </div>
                  <Transition
                    as={Fragment}
                    enter="transition ease-out duration-100"
                    enterFrom="transform opacity-0 scale-95"
                    enterTo="transform opacity-100 scale-100"
                    leave="transition ease-in duration-75"
                    leaveFrom="transform opacity-100 scale-100"
                    leaveTo="transform opacity-0 scale-95"
                  >
                    <Menu.Items className="absolute right-0 z-10 mt-2 w-48 origin-top-right rounded-md bg-white py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                      {!user && (
                        <Menu.Item>
                          {({ active }) => (
                            <Form action={`/auth/discord`} method="post">
                              <button
                                className={clsx(
                                  active ? "bg-gray-100" : "",
                                  "block w-full px-4 py-2 text-left text-sm text-gray-700"
                                )}
                                tabIndex={-1}
                                role="menuitem"
                              >
                                Login via Discord
                              </button>
                            </Form>
                          )}
                        </Menu.Item>
                      )}
                      {user && (
                        <>
                          <Menu.Item>
                            {({ active }) => (
                              <a
                                href="/dashboard"
                                className={clsx(
                                  active ? "bg-gray-100" : "",
                                  "block px-4 py-2 text-sm text-gray-700"
                                )}
                              >
                                User Dashboard
                              </a>
                            )}
                          </Menu.Item>
                          {userIsAdmin && (
                            <Menu.Item>
                              {({ active }) => (
                                <a
                                  href="/admin"
                                  className={clsx(
                                    active ? "bg-gray-100" : "",
                                    "block px-4 py-2 text-sm text-gray-700"
                                  )}
                                >
                                  Admin Dashboard
                                </a>
                              )}
                            </Menu.Item>
                          )}
                          <Menu.Item>
                            {({ active }) => (
                              <Form action="/logout" method="post">
                                <button
                                  className={clsx(
                                    active ? "bg-gray-100" : "",
                                    "block w-full px-4 py-2 text-left text-sm text-gray-700"
                                  )}
                                  tabIndex={-1}
                                  role="menuitem"
                                >
                                  Logout
                                </button>
                              </Form>
                            )}
                          </Menu.Item>
                        </>
                      )}
                    </Menu.Items>
                  </Transition>
                </Menu>
              </div>
            </div>
          </div>

          <Disclosure.Panel className="sm:hidden">
            <div className="space-y-1 px-2 pt-2 pb-3">
              {navigation.map((item) => (
                <Disclosure.Button
                  key={item.name}
                  as="a"
                  href={item.href}
                  className={clsx(
                    item.current
                      ? "bg-gray-900 text-white"
                      : "text-gray-300 hover:bg-gray-700 hover:text-white",
                    "block rounded-md px-3 py-2 text-base font-medium"
                  )}
                  aria-current={item.current ? "page" : undefined}
                >
                  {item.name}
                </Disclosure.Button>
              ))}
            </div>
          </Disclosure.Panel>
        </>
      )}
    </Disclosure>
  );
}
