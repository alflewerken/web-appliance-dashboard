// Light Mode Modal Fix Hook
import { useEffect } from 'react';
import { useTheme } from '../contexts/ThemeContext';

export function useLightModeModalFix() {
  const { theme } = useTheme();

  useEffect(() => {
    if (theme === 'light') {
      // Force light mode on all modals
      const fixModals = () => {
        const modals = document.querySelectorAll(
          '.modal, .settings-modal, [class*="modal"]:not(.modal-overlay)'
        );
        modals.forEach(modal => {
          modal.style.setProperty('background-color', '#ffffff', 'important');
          modal.style.setProperty('color', '#000000', 'important');
        });

        const headers = document.querySelectorAll('.modal-header');
        headers.forEach(header => {
          header.style.setProperty('background-color', '#f8f8f8', 'important');
          header.style.setProperty('color', '#000000', 'important');
        });

        const bodies = document.querySelectorAll('.modal-body');
        bodies.forEach(body => {
          body.style.setProperty('background-color', '#ffffff', 'important');
          body.style.setProperty('color', '#000000', 'important');
        });
      };

      // Initial fix
      fixModals();

      // Watch for new modals
      const observer = new MutationObserver(fixModals);
      observer.observe(document.body, { childList: true, subtree: true });

      return () => observer.disconnect();
    }
  }, [theme]);
}
