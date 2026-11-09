"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/components/theme-provider";

import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = React.useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );
  const dark = resolvedTheme === "dark";

  if (!mounted) {
    return <Button aria-label="Ganti tema" variant="outline" size="icon" disabled />;
  }

  return (
    <Button
      aria-label={dark ? "Gunakan tema terang" : "Gunakan tema gelap"}
      variant="outline"
      size="icon"
      onClick={() => setTheme(dark ? "light" : "dark")}
    >
      {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </Button>
  );
}
