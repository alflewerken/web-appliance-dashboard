import { useState } from 'react';

export const useSwipeable = () => {
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);
  const [swipeOffset, setSwipeOffset] = useState(0);

  const minSwipeDistance = 50;

  const onTouchStart = (e) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e) => {
    if (!touchStart) return;
    const currentTouch = e.targetTouches[0].clientX;
    setTouchEnd(currentTouch);
    setSwipeOffset(currentTouch - touchStart);
  };

  const onTouchEnd = (callback) => {
    if (!touchStart || !touchEnd) {
      setSwipeOffset(0);
      return;
    }

    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe && callback.onSwipeLeft) {
      callback.onSwipeLeft();
    }
    
    if (isRightSwipe && callback.onSwipeRight) {
      callback.onSwipeRight();
    }

    setSwipeOffset(0);
  };

  return {
    onTouchStart,
    onTouchMove,
    onTouchEnd,
    swipeOffset,
  };
};
