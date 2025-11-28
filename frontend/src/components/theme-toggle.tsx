import { useEffect, useState } from "react";
import { MoonIcon, SunIcon } from "@heroicons/react/24/outline";

export function ThemeToggle(): JSX.Element {
  const [isDark, setIsDark] = useState<boolean>(true);

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [isDark]);

  return (
    <button
      type="button"
      onClick={() => setIsDark((prev) => !prev)}
      className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white hover:border-white/30"
      aria-label="Toggle theme"
    >
      {isDark ? <SunIcon className="h-5 w-5" /> : <MoonIcon className="h-5 w-5" />}
    </button>
  );
}
