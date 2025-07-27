// Real iPad DOM Force Update
// This is a nuclear option for real iPads that refuse to update the DOM

export const forceRealIPadDOMUpdate = adminMode => {
  // Method 1: Force all card grids to update
  const allGrids = document.querySelectorAll('.card-actions-grid');
  allGrids.forEach((grid, index) => {
    // Remove and re-add the entire grid
    const parent = grid.parentNode;
    const newGrid = grid.cloneNode(true);

    // Update classes
    if (adminMode) {
      newGrid.classList.remove('admin-mode-off');
    } else {
      newGrid.classList.add('admin-mode-off');
    }

    // Update all buttons
    const buttons = newGrid.querySelectorAll('.action-btn');
    buttons.forEach(btn => {
      if (!adminMode && !btn.classList.contains('favorite-btn')) {
        // Hide non-favorite buttons in admin-mode-off
        btn.style.cssText =
          'display: none !important; visibility: hidden !important; opacity: 0 !important;';
      } else {
        // Show all buttons in admin mode
        btn.style.cssText = '';
      }
    });

    parent.replaceChild(newGrid, grid);
  });

  // Method 2: Force WebKit reflow
  const cards = document.querySelectorAll('.appliance-card-container');
  cards.forEach(card => {
    card.style.display = 'none';
    card.offsetHeight; // Force reflow
    card.style.display = '';
  });

  // Method 3: Toggle a class on body to force complete repaint
  document.body.classList.add('force-repaint');
  requestAnimationFrame(() => {
    document.body.classList.remove('force-repaint');
  });
};
