import React, { useRef } from 'react';
import { Box } from '@mui/material';

const TouchDraggableWrapper = ({ 
  children, 
  index, 
  onTouchStart, 
  onTouchMove, 
  onTouchEnd,
  isDragging,
  isDropTarget 
}) => {
  const elementRef = useRef(null);
  const dragImageRef = useRef(null);
  const initialTouchPos = useRef(null);

  const handleTouchStart = (e) => {
    e.preventDefault(); // Prevent default touch behavior
    const touch = e.touches[0];
    initialTouchPos.current = {
      x: touch.clientX,
      y: touch.clientY
    };

    // Create drag image
    const element = elementRef.current;
    if (element) {
      const rect = element.getBoundingClientRect();
      const clone = element.cloneNode(true);
      clone.style.position = 'fixed';
      clone.style.width = rect.width + 'px';
      clone.style.height = rect.height + 'px';
      clone.style.top = rect.top + 'px';
      clone.style.left = rect.left + 'px';
      clone.style.pointerEvents = 'none';
      clone.style.zIndex = '9999';
      clone.style.opacity = '0.8';
      clone.style.transform = 'rotate(2deg)';
      clone.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.4)';
      clone.classList.add('category-drag-preview');
      document.body.appendChild(clone);
      dragImageRef.current = clone;
    }

    if (onTouchStart) {
      onTouchStart(e, index);
    }
  };

  const handleTouchMove = (e) => {
    e.preventDefault();
    const touch = e.touches[0];

    // Move drag image
    if (dragImageRef.current && initialTouchPos.current) {
      const deltaX = touch.clientX - initialTouchPos.current.x;
      const deltaY = touch.clientY - initialTouchPos.current.y;
      dragImageRef.current.style.transform = `translate(${deltaX}px, ${deltaY}px) rotate(2deg)`;
    }

    if (onTouchMove) {
      onTouchMove(e);
    }
  };

  const handleTouchEnd = (e) => {
    e.preventDefault();

    // Remove drag image
    if (dragImageRef.current) {
      document.body.removeChild(dragImageRef.current);
      dragImageRef.current = null;
    }

    if (onTouchEnd) {
      onTouchEnd(e);
    }
  };

  return (
    <Box
      ref={elementRef}
      data-index={index}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      sx={{
        width: '100%',
        opacity: isDragging ? 0.5 : 1,
        transform: isDropTarget ? 'scale(0.98)' : 'scale(1)',
        transition: isDragging ? 'none' : 'all 0.2s ease',
      }}
    >
      {children}
    </Box>
  );
};

export default TouchDraggableWrapper;
