// iPad Admin Mode Fix - Final Version
// This file contains the ultimate fix for iPad admin mode issues

import { useEffect, useRef, useState } from 'react';

export const useIPadAdminModeFix = adminMode => {
  const cardRef = useRef(null);
  const [lastAdminMode, setLastAdminMode] = useState(adminMode);
  // Enhanced iPad detection for Safari Simulator and real devices
  const isIPad =
    /iPad/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) ||
    navigator.platform === 'iPad' ||
    // Special detection for Safari iPad Simulator
    (navigator.platform === 'MacIntel' &&
      navigator.maxTouchPoints === 5 &&
      window.innerWidth >= 768 &&
      window.innerWidth <= 1366);

  useEffect(() => {
    if (!isIPad || !cardRef.current) return;
    if (lastAdminMode === adminMode) return;

    setLastAdminMode(adminMode);

    const card = cardRef.current;
    const actionGrid = card.querySelector('.card-actions-grid');
    if (!actionGrid) return;

    // Store parent and position
    const parent = actionGrid.parentNode;
    const { nextSibling } = actionGrid;

    // Clone the grid
    const newGrid = actionGrid.cloneNode(true);

    // Update classes
    if (!adminMode) {
      newGrid.classList.add('admin-mode-off');
    } else {
      newGrid.classList.remove('admin-mode-off');
    }

    // Handle buttons based on admin mode
    const allButtons = newGrid.querySelectorAll('.action-btn');
    const editBtn = newGrid.querySelector('.edit-btn');
    const startBtn = newGrid.querySelector('.start-btn');
    const stopBtn = newGrid.querySelector('.stop-btn');
    const terminalBtn = newGrid.querySelector('.terminal-btn');
    const favoriteBtn = newGrid.querySelector('.favorite-btn');

    if (!adminMode) {
      // Admin mode OFF - hide all except favorite
      [editBtn, startBtn, stopBtn, terminalBtn].forEach(btn => {
        if (btn) {
          btn.remove(); // Completely remove from DOM
        }
      });

      // Ensure favorite button is visible
      if (favoriteBtn) {
        favoriteBtn.style.opacity = '1';
        favoriteBtn.style.display = 'flex';
        favoriteBtn.style.visibility = 'visible';
      }
    } else {
      // Admin mode ON - ensure all buttons are visible
      allButtons.forEach(btn => {
        if (btn) {
          btn.style.opacity = '';
          btn.style.display = '';
          btn.style.visibility = '';
        }
      });
    }

    // Remove old grid and insert new one
    parent.removeChild(actionGrid);
    parent.insertBefore(newGrid, nextSibling);

    // Force multiple repaints
    requestAnimationFrame(() => {
      void newGrid.offsetHeight;
      newGrid.style.opacity = '0.99';

      requestAnimationFrame(() => {
        newGrid.style.opacity = '';
      });
    });
  }, [adminMode, isIPad, lastAdminMode]);

  return cardRef;
};
