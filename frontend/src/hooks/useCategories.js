import { useState, useEffect } from 'react';
import { CategoryService } from '../services/categoryService';
import { useSSE } from './useSSE';

export const useCategories = () => {
  const [apiCategories, setApiCategories] = useState([]);
  const [categoriesLastUpdated, setCategoriesLastUpdated] = useState(
    Date.now()
  );
  const [isReordering, setIsReordering] = useState(false);
  const { addEventListener } = useSSE();

  // Debug: Track if listeners are active
  const [listenersActive, setListenersActive] = useState(false);

  const fetchCategories = async () => {
    try {
      const data = await CategoryService.fetchCategories();
      if (Array.isArray(data)) {
        setApiCategories(data);
      } else {
        console.error(
          '❌ useCategories - Data is not an array:',
          typeof data,
          data
        );
        setApiCategories([]);
      }
    } catch (error) {
      console.error('❌ useCategories - Error fetching categories:', error);
      setApiCategories([]);
    }
  };

  const createCategory = async category => {
    try {
      const result = await CategoryService.createCategory(category);
      // SSE event will handle the update
      return { success: true };
    } catch (error) {
      console.error('❌ useCategories - Error creating category:', error);
      return { success: false, error: error.message };
    }
  };

  const updateCategory = async (id, category) => {
    try {
      await CategoryService.updateCategory(id, category);
      // Keine lokale Aktualisierung mehr - verlassen uns auf SSE
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  const deleteCategory = async category => {
    if (
      !window.confirm(
        `Möchten Sie die Kategorie "${category.name}" wirklich löschen?`
      )
    ) {
      return { success: false, cancelled: true };
    }

    try {
      await CategoryService.deleteCategory(category.id);
      // Keine lokale Aktualisierung mehr - verlassen uns auf SSE
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  const handleCategoriesUpdate = async () => {
    // Diese Funktion ist jetzt überflüssig, da SSE die Updates übernimmt
  };

  const reorderCategories = async orderedCategories => {
    // Validate input
    if (!orderedCategories || !Array.isArray(orderedCategories)) {
      console.error(
        'reorderCategories: orderedCategories is not an array:',
        orderedCategories
      );
      return { success: false, error: 'Invalid categories data' };
    }

    // Optimistically update the local state
    setIsReordering(true);

    // Create the new order locally
    const newOrder = orderedCategories.map((item, index) => {
      const existingCat = apiCategories.find(cat => cat.id === item.id);
      return { ...existingCat, order: index };
    });

    // Sort by the new order
    const sortedCategories = newOrder.sort((a, b) => a.order - b.order);
    setApiCategories(sortedCategories);

    try {
      await CategoryService.reorderCategories(orderedCategories);
      // Success - the SSE event will confirm the update
      return { success: true };
    } catch (error) {
      // On error, revert to the original order
      await fetchCategories();
      setIsReordering(false);
      return { success: false, error: error.message };
    }
  };

  useEffect(() => {
    fetchCategories();

    // Debug: Check if addEventListener is available
    if (!addEventListener) {
      console.error('❌ useCategories - addEventListener is not available!');
      return;
    }

    // Subscribe to SSE events for real-time updates
    const unsubscribeCreated = addEventListener('category_created', data => {
      // Force a complete refresh to ensure we get the latest data
      fetchCategories();
    });

    const unsubscribeUpdated = addEventListener('category_updated', data => {
      // Force a complete refresh
      fetchCategories();
    });

    const unsubscribeDeleted = addEventListener('category_deleted', data => {
      // Force a complete refresh
      fetchCategories();
    });

    const unsubscribeRestored = addEventListener('category_restored', data => {
      // Force a complete refresh when a category is restored
      fetchCategories();
    });

    const unsubscribeReordered = addEventListener(
      'categories_reordered',
      data => {
        // Use the data directly as it contains all categories
        if (Array.isArray(data)) {
          setApiCategories(data);
          setCategoriesLastUpdated(Date.now());
        } else {
          console.error('❌ categories_reordered data is not an array:', data);
        }
      }
    );

    setListenersActive(true);

    // Cleanup
    return () => {
      unsubscribeCreated();
      unsubscribeUpdated();
      unsubscribeDeleted();
      unsubscribeRestored();
      unsubscribeReordered();
    };
  }, [addEventListener]);

  // Debug effect
  

  return {
    apiCategories,
    setApiCategories,
    categoriesLastUpdated,
    fetchCategories,
    createCategory,
    updateCategory,
    deleteCategory,
    handleCategoriesUpdate,
    reorderCategories,
  };
};
