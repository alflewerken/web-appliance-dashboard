// Theme-Utility-Funktionen

export const applyTheme = themeMode => {
  const { body } = document;
  const html = document.documentElement;

  // Entferne alle Theme-Klassen
  body.classList.remove('theme-light', 'theme-dark', 'theme-auto');
  html.classList.remove('theme-light', 'theme-dark', 'theme-auto');

  // Setze Theme-Klasse basierend auf Einstellung
  if (themeMode === 'light') {
    body.classList.add('theme-light');
    html.classList.add('theme-light');
    body.style.backgroundColor = '#f2f2f7';
    body.style.color = '#000000';
  } else if (themeMode === 'dark') {
    body.classList.add('theme-dark');
    html.classList.add('theme-dark');
    body.style.backgroundColor = '#000000';
    body.style.color = '#ffffff';
  } else if (themeMode === 'auto') {
    body.classList.add('theme-auto');
    html.classList.add('theme-auto');

    // Verwende System-Präferenz
    const prefersDark = window.matchMedia(
      '(prefers-color-scheme: dark)'
    ).matches;
    if (prefersDark) {
      body.style.backgroundColor = '#000000';
      body.style.color = '#ffffff';
    } else {
      body.style.backgroundColor = '#f2f2f7';
      body.style.color = '#000000';
    }
  }
};

export const getSystemThemePreference = () =>
  window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
