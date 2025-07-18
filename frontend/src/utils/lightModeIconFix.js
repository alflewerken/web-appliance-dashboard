// Light Mode Icon Fix - Runtime solution
(() => {
  const fixLightModeIcons = () => {
    // Only run in light mode
    if (!document.body.classList.contains('theme-light')) return;

    // Fix service card icons
    const cardIcons = document.querySelectorAll('.card-icon');
    cardIcons.forEach(icon => {
      icon.style.color = '#000000';
      const svg = icon.querySelector('svg');
      if (svg) {
        svg.style.fill = '#000000';
        svg.style.stroke = 'none';
        svg.style.color = '#000000';
      }
    });

    // Fix custom colored cards
    const coloredCards = document.querySelectorAll(
      '.card-cover[style*="backgroundColor"]'
    );
    coloredCards.forEach(card => {
      const icon = card.querySelector('.card-icon');
      if (icon) {
        icon.style.color = '#ffffff';
        const svg = icon.querySelector('svg');
        if (svg) {
          svg.style.fill = '#ffffff';
          svg.style.color = '#ffffff';
        }
      }
    });

    // Fix all buttons with title attributes
    const buttons = document.querySelectorAll('button[title]');
    buttons.forEach(button => {
      // Check if button has no visible content or SVG
      const svg = button.querySelector('svg');
      if (
        !svg ||
        svg.style.display === 'none' ||
        button.textContent.trim() === ''
      ) {
        // Add emoji fallbacks based on title
        if (
          button.title === 'Bearbeiten' &&
          !button.textContent.includes('✏️')
        ) {
          button.innerHTML = '<span style="font-size: 14px;">✏️</span>';
        } else if (
          button.title === 'Löschen' &&
          !button.textContent.includes('🗑️')
        ) {
          button.innerHTML = '<span style="font-size: 14px;">🗑️</span>';
        } else if (
          button.title === 'Terminal öffnen' &&
          !button.textContent.includes('💻')
        ) {
          button.innerHTML = '<span style="font-size: 14px;">💻</span>';
        }
      }

      // Ensure button has proper display
      button.style.display = 'flex';
      button.style.alignItems = 'center';
      button.style.justifyContent = 'center';
    });

    // Fix all Lucide SVGs
    const svgs = document.querySelectorAll('svg.lucide');
    svgs.forEach(svg => {
      svg.style.display = 'inline-block';
      svg.style.opacity = '1';
      svg.style.visibility = 'visible';
      svg.style.stroke = 'currentColor';
      svg.style.fill = 'none';
    });
  };

  // Run on page load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', fixLightModeIcons);
  } else {
    fixLightModeIcons();
  }

  // Run on theme changes
  const observer = new MutationObserver(mutations => {
    mutations.forEach(mutation => {
      if (
        mutation.type === 'attributes' &&
        mutation.attributeName === 'class'
      ) {
        fixLightModeIcons();
      }
    });
  });

  observer.observe(document.body, {
    attributes: true,
    attributeFilter: ['class'],
  });

  // Also observe for dynamic content
  const contentObserver = new MutationObserver(() => {
    fixLightModeIcons();
  });

  // Observe the modal body for changes
  const modalObserver = setInterval(() => {
    const modalBody = document.querySelector('.modal-body');
    if (modalBody) {
      contentObserver.observe(modalBody, {
        childList: true,
        subtree: true,
      });
      clearInterval(modalObserver);
    }
  }, 100);

  // Also observe main content for card changes
  const mainContent = document.querySelector('.main-content');
  if (mainContent) {
    contentObserver.observe(mainContent, {
      childList: true,
      subtree: true,
    });
  }
})();
