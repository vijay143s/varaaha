import { Fragment } from "react";
import { Disclosure, Menu, Transition } from "@headlessui/react";
import { Bars3Icon, ShoppingBagIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { Link, NavLink } from "react-router-dom";

import { useAuth } from "../hooks/use-auth.js";
import { ThemeToggle } from "./theme-toggle.js";
import { useCartStore } from "../store/cart-store.js";

const navigation = [
  { name: "Home", href: "/" },
  { name: "Products", href: "/products" },
  { name: "Orders", href: "/orders" }
];

function classNames(...classes: Array<string | boolean | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

export function Navbar(): JSX.Element {
  const { isAuthenticated, user, logout } = useAuth();
  const cartQuantity = useCartStore((state) =>
    state.items.reduce((total, item) => total + item.quantity, 0)
  );

  return (
    <Disclosure as="header" className="fixed inset-x-0 top-0 z-50 border-b border-white/5 backdrop-blur">
      {({ open }) => (
        <>
          <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4">
            <div className="flex items-center gap-3">
              <Link to="/" className="flex items-center gap-2 text-lg font-semibold tracking-wide text-white">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-brand-600 text-sm font-bold shadow-neon-ring">
                  VM
                </span>
                Varaaha Milk
              </Link>
              <nav className="hidden md:flex items-center gap-2 text-sm">
                {navigation.map((item) => (
                  <NavLink
                    key={item.name}
                    to={item.href}
                    className={({ isActive }) =>
                      classNames(
                        "rounded-full px-4 py-2 transition-colors",
                        isActive ? "bg-white/10 text-white" : "text-white/70 hover:text-white/90"
                      )
                    }
                  >
                    {item.name}
                  </NavLink>
                ))}
              </nav>
            </div>

            <div className="flex items-center gap-3">
              <ThemeToggle />
              <Link
                to="/cart"
                className="relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white transition hover:border-brand-400 hover:bg-brand-500/20"
              >
                <ShoppingBagIcon className="h-5 w-5" aria-hidden="true" />
                {cartQuantity > 0 && (
                  <span className="absolute -right-1 -top-1 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-brand-500 px-1 text-xs font-semibold text-white shadow-neon-ring">
                    {cartQuantity}
                  </span>
                )}
                <span className="sr-only">View cart</span>
              </Link>
              {isAuthenticated ? (
                <Menu as="div" className="relative">
                  <Menu.Button className="flex items-center gap-2 rounded-full bg-white/5 px-3 py-2 text-sm text-white hover:bg-white/10">
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-brand-500/30 text-xs font-bold uppercase">
                      {user?.fullName?.slice(0, 2) ?? "VM"}
                    </span>
                    <span>{user?.fullName ?? user?.email}</span>
                  </Menu.Button>
                  <Transition
                    as={Fragment}
                    enter="transition ease-out duration-100"
                    enterFrom="transform opacity-0 scale-95"
                    enterTo="transform opacity-100 scale-100"
                    leave="transition ease-in duration-75"
                    leaveFrom="transform opacity-100 scale-100"
                    leaveTo="transform opacity-0 scale-95"
                  >
                    <Menu.Items className="absolute right-0 mt-2 w-48 origin-top-right rounded-xl border border-white/5 bg-slate-900/95 p-1 shadow-frost">
                      <Menu.Item>
                        {({ close }) => (
                          <Link
                            to="/account"
                            onClick={() => close()}
                            className="block rounded-lg px-3 py-2 text-sm text-white hover:bg-white/10"
                          >
                            Dashboard
                          </Link>
                        )}
                      </Menu.Item>
                      <Menu.Item>
                        {({ close }) => (
                          <button
                            type="button"
                            onClick={() => {
                              logout();
                              close();
                            }}
                            className="w-full rounded-lg px-3 py-2 text-left text-sm text-red-300 hover:bg-red-500/10"
                          >
                            Sign out
                          </button>
                        )}
                      </Menu.Item>
                    </Menu.Items>
                  </Transition>
                </Menu>
              ) : (
                <div className="hidden sm:flex items-center gap-2">
                  <Link
                    to="/signin"
                    className="rounded-full border border-white/10 px-5 py-2 text-sm font-medium text-white hover:border-white/40"
                  >
                    Sign in
                  </Link>
                  <Link
                    to="/signup"
                    className="rounded-full bg-brand-500 px-5 py-2 text-sm font-medium text-white shadow-neon-ring hover:bg-brand-400"
                  >
                    Join now
                  </Link>
                </div>
              )}

              <Disclosure.Button className="inline-flex items-center justify-center rounded-md bg-white/5 p-2 text-white md:hidden">
                <span className="sr-only">Open main menu</span>
                {open ? (
                  <XMarkIcon className="h-6 w-6" aria-hidden="true" />
                ) : (
                  <Bars3Icon className="h-6 w-6" aria-hidden="true" />
                )}
              </Disclosure.Button>
            </div>
          </div>

          <Disclosure.Panel className="md:hidden">
            <nav className="space-y-1 px-4 pb-4 pt-2">
                {navigation.map((item) => (
                <Disclosure.Button
                  key={item.name}
                  as={NavLink}
                  to={item.href}
                    className={({ isActive }: { isActive: boolean }) =>
                    classNames(
                      "block rounded-lg px-3 py-2 text-base",
                      isActive ? "bg-white/10 text-white" : "text-white/70 hover:bg-white/5 hover:text-white"
                    )
                  }
                >
                  {item.name}
                </Disclosure.Button>
              ))}
              <Disclosure.Button
                as={NavLink}
                to="/cart"
                className={({ isActive }: { isActive: boolean }) =>
                  classNames(
                    "block rounded-lg px-3 py-2 text-base",
                    isActive ? "bg-white/10 text-white" : "text-white/70 hover:bg-white/5 hover:text-white"
                  )
                }
              >
                Cart{cartQuantity > 0 ? ` (${cartQuantity})` : ""}
              </Disclosure.Button>
              {!isAuthenticated && (
                <div className="flex flex-col gap-2 pt-2">
                  <Link to="/signin" className="rounded-lg border border-white/10 px-3 py-2 text-white">
                    Sign in
                  </Link>
                  <Link to="/signup" className="rounded-lg bg-brand-500 px-3 py-2 text-center text-white">
                    Join now
                  </Link>
                </div>
              )}
            </nav>
          </Disclosure.Panel>
        </>
      )}
    </Disclosure>
  );
}
