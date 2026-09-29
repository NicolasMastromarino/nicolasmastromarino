"use client";

export function ThemeToggle() {
  function toggle() {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("nm-theme", next);
    } catch {}
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Toggle color theme"
      className="relative inline-flex h-7 w-[52px] flex-none items-center rounded-full border border-line-strong bg-surface-2"
    >
      <span className="theme-thumb pointer-events-none absolute left-[3px] h-5 w-5 rounded-full bg-ink transition-transform duration-200" />
    </button>
  );
}
