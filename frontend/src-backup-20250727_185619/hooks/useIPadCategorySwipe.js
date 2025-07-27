import { useEffect, useRef, useState } from 'react';

/**
 * Optimierter Hook für iPad Swipe mit besserem Scroll/Swipe Balance
 */
export const useIPadCategorySwipe = (
  categories,
  selectedCategory,
  setSelectedCategory,
  enabled = true
) => {
  const trackingRef = useRef(false);
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const startTimeRef = useRef(0);
  const velocityRef = useRef(0);
  const lastXRef = useRef(0);

  useEffect(() => {
    if (!enabled || !categories || categories.length <= 1) {
      return;
    }

    const handleTouchStart = e => {
      // Prüfe ob Touch auf einem interaktiven Element ist
      const { target } = e;
      const isInteractive = target.closest(
        'button, a, input, textarea, select, .modal, .sidebar, .action-btn'
      );

      // Erlaube Swipe auf Appliance Cards
      const isOnCard = target.closest('.appliance-card-container');

      if (isInteractive && !isOnCard) {
        return;
      }

      trackingRef.current = true;
      startXRef.current = e.touches[0].clientX;
      startYRef.current = e.touches[0].clientY;
      lastXRef.current = e.touches[0].clientX;
      startTimeRef.current = Date.now();
      velocityRef.current = 0;
    };

    const handleTouchMove = e => {
      if (!trackingRef.current) return;

      const currentX = e.touches[0].clientX;
      const currentY = e.touches[0].clientY;
      const diffX = Math.abs(startXRef.current - currentX);
      const diffY = Math.abs(startYRef.current - currentY);

      // Berechne Geschwindigkeit
      const currentTime = Date.now();
      const timeDiff = currentTime - startTimeRef.current;
      if (timeDiff > 0) {
        velocityRef.current = Math.abs(currentX - lastXRef.current) / timeDiff;
      }
      lastXRef.current = currentX;

      // Entscheide basierend auf Winkel und Geschwindigkeit
      if (diffX > 10 || diffY > 10) {
        const angle = (Math.atan2(diffY, diffX) * 180) / Math.PI;

        // Wenn der Winkel > 45 Grad ist, ist es eher ein Scroll
        if (angle > 45) {
          trackingRef.current = false;
          return;
        }

        // Bei schneller horizontaler Bewegung -> Swipe
        if (velocityRef.current > 0.5 && diffX > diffY) {
          e.preventDefault();
        }
      }
    };

    const handleTouchEnd = e => {
      if (!trackingRef.current) return;

      const endX = e.changedTouches[0].clientX;
      const endY = e.changedTouches[0].clientY;
      const diffX = startXRef.current - endX;
      const diffY = Math.abs(startYRef.current - endY);
      const endTime = Date.now();
      const duration = endTime - startTimeRef.current;

      trackingRef.current = false;

      // Swipe-Erkennung mit Geschwindigkeit und Distanz
      const minDistance = 50; // Reduziert von 80
      const maxTime = 300; // Schnelle Geste
      const minVelocity = 0.3; // Mindestgeschwindigkeit

      // Entweder: Schnelle kurze Geste ODER längere Geste mit genug Distanz
      const isQuickSwipe = Math.abs(diffX) > minDistance && duration < maxTime;
      const isLongSwipe =
        Math.abs(diffX) > 100 && Math.abs(diffX) > diffY * 1.5;

      if (isQuickSwipe || isLongSwipe) {
        const currentIndex = categories.findIndex(
          cat => cat.id === selectedCategory
        );

        if (diffX > 0 && currentIndex < categories.length - 1) {
          // Swipe nach links -> nächste Kategorie
          setSelectedCategory(categories[currentIndex + 1].id);
        } else if (diffX < 0 && currentIndex > 0) {
          // Swipe nach rechts -> vorherige Kategorie
          setSelectedCategory(categories[currentIndex - 1].id);
        }
      }
    };

    // Event Listener
    const element = document.querySelector('.content-body') || document;
    const options = { passive: false };

    element.addEventListener('touchstart', handleTouchStart, { passive: true });
    element.addEventListener('touchmove', handleTouchMove, options);
    element.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchmove', handleTouchMove);
      element.removeEventListener('touchend', handleTouchEnd);
    };
  }, [categories, selectedCategory, setSelectedCategory, enabled]);

  // Return info für UI
  const currentIndex =
    categories?.findIndex(cat => cat.id === selectedCategory) ?? -1;

  return {
    currentIndex,
    canSwipeLeft: currentIndex > 0,
    canSwipeRight: currentIndex < (categories?.length ?? 0) - 1,
    totalCategories: categories?.length ?? 0,
  };
};
