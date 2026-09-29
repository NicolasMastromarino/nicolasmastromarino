const THEME_SCRIPT = `(function(){try{var s=localStorage.getItem('nm-theme');var t=s||(window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');document.documentElement.dataset.theme=t;}catch(e){document.documentElement.dataset.theme='light';}})();`;

export function ThemeInit() {
  return <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />;
}
