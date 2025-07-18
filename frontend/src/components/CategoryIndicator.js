import React from 'react';

const CategoryIndicator = ({ categories, currentIndex, onCategorySelect }) => {
  if (!categories || categories.length === 0) return null;

  return (
    <div className="category-indicator">
      <div className="category-dots">
        {categories.map((category, index) => (
          <button
            key={category.id}
            className={`category-dot ${index === currentIndex ? 'active' : ''}`}
            onClick={() => onCategorySelect(category.id)}
            aria-label={`Switch to ${category.name}`}
          />
        ))}
      </div>
      <div className="category-name">
        {categories[currentIndex]?.name || ''}
      </div>
    </div>
  );
};

export default CategoryIndicator;
