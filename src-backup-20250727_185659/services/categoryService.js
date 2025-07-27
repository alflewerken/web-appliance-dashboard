import axios from '../utils/axiosConfig';

// API Service für Kategorien
export class CategoryService {
  static async fetchCategories() {
    try {
      const response = await axios.get('/api/categories');
      return response.data;
    } catch (error) {
      console.error('Fetch categories error:', error);
      return [];
    }
  }

  static async createCategory(category) {
    try {
      const response = await axios.post('/api/categories', category);
      return response.data;
    } catch (error) {
      console.error('Create category error:', error);
      throw new Error(
        error.response?.data?.error || 'Fehler beim Erstellen der Kategorie'
      );
    }
  }

  static async updateCategory(id, category) {
    try {
      const response = await axios.put(`/api/categories/${id}`, category);
      return response.data;
    } catch (error) {
      console.error('Update category error:', error);
      throw new Error(
        error.response?.data?.error || 'Fehler beim Aktualisieren der Kategorie'
      );
    }
  }

  static async deleteCategory(id) {
    try {
      await axios.delete(`/api/categories/${id}`);
      return true;
    } catch (error) {
      console.error('Delete category error:', error);
      throw new Error(
        error.response?.data?.error || 'Fehler beim Löschen der Kategorie'
      );
    }
  }

  static async reorderCategories(categories) {
    try {
      const response = await axios.put('/api/categories/reorder', {
        categories,
      });
      return response.data;
    } catch (error) {
      console.error('Reorder categories error:', error);
      throw new Error(
        error.response?.data?.error || 'Fehler beim Sortieren der Kategorien'
      );
    }
  }
}
