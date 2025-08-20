import React, { useMemo, useState, useEffect } from 'react';
import { Server, Plus } from 'lucide-react';
import { ApplianceCard, ApplianceCardErrorBoundary } from './Appliances';
import { useCategorySwipe } from '../hooks/useCategorySwipe';
import { getFilteredAppliances, getTimeBasedSections } from '../utils';

const AppContent = ({
  filteredAppliances,
  searchTerm,
  selectedCategory,
  setSelectedCategory,
  allCategories,
  sections,
  onOpen,
  onEdit,
  onDelete,
  onToggleFavorite,
  onServiceAction,
  onServiceStatusUpdate,
  onAddService,
  onTerminalOpen,
  onUpdateSettings,
  isMobile,
  appliances,
  cardSize,
  currentBackground,
  backgroundSettings,
  adminMode,
  forceUpdate,
  isIPad,
  swipeInfo,
  showOnlyWithStatus,
}) => {
  // Use swipe hook for mobile
  const {
    containerRef,
    translateX,
    isDragging,
    currentIndex,
    isHorizontalSwipe,
    isVerticalScroll,
    isAnimating,
    isTransitioning,
  } = useCategorySwipe(allCategories, selectedCategory, setSelectedCategory);

  // State für sanfte Kategorie-Übergänge
  const [isChangingCategory, setIsChangingCategory] = useState(false);
  const [displayCategory, setDisplayCategory] = useState(selectedCategory);

  // Sanfter Übergang beim Kategorienwechsel
  useEffect(() => {
    if (selectedCategory !== displayCategory) {
      setIsChangingCategory(true);

      // Kurze Verzögerung für Fade-Out
      setTimeout(() => {
        setDisplayCategory(selectedCategory);

        // Nach dem Wechsel Fade-In
        setTimeout(() => {
          setIsChangingCategory(false);
        }, 50);
      }, 150);
    }
  }, [selectedCategory, displayCategory]);

  // Pre-calculate filtered appliances for all categories
  const categoryAppliances = useMemo(() => {
    if (!Array.isArray(allCategories)) {
      console.error(
        'AppContent: allCategories is not an array:',
        allCategories
      );
      return [];
    }
    const result = allCategories.map(category => {
      const filteredApps = getFilteredAppliances(
        appliances,
        category.id,
        searchTerm,
        showOnlyWithStatus
      );

      return {
        categoryId: category.id,
        appliances: filteredApps,
        sections:
          category.id === 'recent' ? getTimeBasedSections(appliances) : null,
      };
    });
    return result;
  }, [allCategories, appliances, searchTerm, showOnlyWithStatus]);

  // Helper function to render ApplianceCard with all props
  const renderApplianceCard = appliance => (
    <ApplianceCardErrorBoundary
      key={`error-${appliance.id}`}
      appliance={appliance}
    >
      <ApplianceCard
        key={`${appliance.id}-${adminMode}-${forceUpdate}-${appliance.lastStatusUpdate || ''}`} // Include lastStatusUpdate in key
        appliance={appliance}
        onOpen={onOpen}
        onEdit={onEdit}
        onDelete={onDelete}
        onFavorite={onToggleFavorite}
        onServiceAction={onServiceAction}
        onOpenTerminal={onTerminalOpen}
        onUpdateSettings={onUpdateSettings}
        adminMode={adminMode}
        cardSize={cardSize}
      />
    </ApplianceCardErrorBoundary>
  );

  // Render content for a specific category
  const renderCategoryContent = categoryData => {
    const {
      appliances: catAppliances,
      sections: catSections,
      categoryId,
    } = categoryData;
    const category = allCategories.find(cat => cat.id === categoryId);

    if (catAppliances.length === 0) {
      return (
        <div className="empty-state">
          <div className="empty-icon">
            <Server size={64} />
          </div>
          <h3>Keine Services gefunden</h3>
          <p>
            {searchTerm
              ? `Keine Services gefunden für "${searchTerm}"`
              : 'Fügen Sie Ihren ersten Service hinzu'}
          </p>
          {!searchTerm && (
            <button onClick={onAddService} className="btn-primary">
              <Plus size={20} />
              Service hinzufügen
            </button>
          )}
        </div>
      );
    }

    if (categoryId === 'recent' && catSections) {
      // Zeit-basierte Ansicht
      return (
        <>
          {catSections.lastHour.length > 0 && (
            <section className="content-section recent-section">
              <h2>Letzte Stunde</h2>
              <div className="appliances-grid" style={{ '--card-size': `${cardSize}px` }}>
                {catSections.lastHour.map(renderApplianceCard)}
              </div>
            </section>
          )}

          {catSections.lastTwoHours.length > 0 && (
            <section className="content-section recent-section">
              <h2>Letzte 2 Stunden</h2>
              <div className="appliances-grid" style={{ '--card-size': `${cardSize}px` }}>
                {catSections.lastTwoHours.map(renderApplianceCard)}
              </div>
            </section>
          )}

          {catSections.lastFiveHours.length > 0 && (
            <section className="content-section recent-section">
              <h2>Letzte 5 Stunden</h2>
              <div className="appliances-grid" style={{ '--card-size': `${cardSize}px` }}>
                {catSections.lastFiveHours.map(renderApplianceCard)}
              </div>
            </section>
          )}

          {catSections.lastTwentyFourHours.length > 0 && (
            <section className="content-section recent-section">
              <h2>Letzte 24 Stunden</h2>
              <div className="appliances-grid" style={{ '--card-size': `${cardSize}px` }}>
                {catSections.lastTwentyFourHours.map(renderApplianceCard)}
              </div>
            </section>
          )}

          {catSections.lastWeek.length > 0 && (
            <section className="content-section recent-section">
              <h2>Letzte Woche</h2>
              <div className="appliances-grid" style={{ '--card-size': `${cardSize}px` }}>
                {catSections.lastWeek.map(renderApplianceCard)}
              </div>
            </section>
          )}
        </>
      );
    }

    // Standard Grid-Ansicht
    return (
      <section className="content-section">
        <h2>{category?.name || 'Alle Services'}</h2>
        <div className="appliances-grid" style={{ '--card-size': `${cardSize}px` }}>
          {catAppliances.map(renderApplianceCard)}
        </div>
      </section>
    );
  };

  // Mobile swipeable view
  if (isMobile) {
    // iPad verwendet Fade-Animation beim Swipe
    if (isIPad && swipeInfo) {
      const currentCategoryData = categoryAppliances.find(
        cat => cat.categoryId === displayCategory
      ) || {
        categoryId: displayCategory,
        appliances: filteredAppliances,
        sections,
      };

      return (
        <div
          className="category-content-wrapper"
          data-can-swipe-left={swipeInfo?.canSwipeLeft}
          data-can-swipe-right={swipeInfo?.canSwipeRight}
        >
          <div
            className={`category-content ${isChangingCategory ? 'category-fade' : 'category-visible'}`}
            style={{
              opacity: isChangingCategory ? 0 : 1,
              transition: 'opacity 0.3s ease-in-out',
            }}
          >
            {renderCategoryContent(currentCategoryData)}
          </div>
        </div>
      );
    }

    // Standard Mobile Swipe (für Phones)
    return (
      <div className="swipeable-content" ref={containerRef}>
        <div
          className={`swipe-track ${isDragging ? 'dragging' : ''} ${isTransitioning ? 'transitioning' : ''} ${isAnimating ? 'animating' : ''} ${isHorizontalSwipe ? 'horizontal-swipe' : ''} ${isVerticalScroll ? 'vertical-scroll' : ''}`}
          style={{
            transform: `translateX(${translateX}%)`,
          }}
        >
          {categoryAppliances.map((categoryData, index) => (
            <div
              key={categoryData.categoryId}
              className="category-slide"
              style={{
                paddingTop: 0, // Explicitly set to prevent empty space
                marginTop: 0,
              }}
            >
              {renderCategoryContent(categoryData)}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Desktop view - use categoryAppliances instead of prop
  const desktopCategoryData = categoryAppliances.find(
    cat => cat.categoryId === selectedCategory
  ) || {
    categoryId: selectedCategory,
    appliances: filteredAppliances,
    sections,
  };

  return renderCategoryContent(desktopCategoryData);
};

export default AppContent;
