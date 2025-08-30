// Categories API routes - Using QueryBuilder
const express = require('express');
const router = express.Router();
const pool = require('../utils/database');
const QueryBuilder = require('../utils/QueryBuilder');
const { broadcast } = require('./sse');
const { createAuditLog } = require('../utils/auditLogger');
const { verifyToken } = require('../utils/auth');

// Initialize QueryBuilder
const db = new QueryBuilder(pool);

/**
 * Helper function to get category with appliance count
 */
async function getCategoryWithCount(categoryId) {
  const [result] = await pool.execute(`
    SELECT 
      c.*,
      COUNT(DISTINCT a.id) as appliance_count
    FROM categories c
    LEFT JOIN appliances a ON c.name = a.category
    WHERE c.id = ?
    GROUP BY c.id
  `, [categoryId]);
  
  if (!result || result.length === 0) {
    return null;
  }
  
  const cat = result[0];
  return {
    id: cat.id,
    name: cat.name,
    icon: cat.icon,
    color: cat.color,
    description: cat.description,
    isSystem: Boolean(cat.is_system),
    orderIndex: cat.order_index,
    applianceCount: parseInt(cat.appliance_count) || 0,
    createdAt: cat.created_at,
    updatedAt: cat.updated_at
  };
}

/**
 * Helper function to get all categories with appliance counts
 */
async function getAllCategoriesWithCounts() {
  const [categories] = await pool.execute(`
    SELECT 
      c.*,
      COUNT(DISTINCT a.id) as appliance_count
    FROM categories c
    LEFT JOIN appliances a ON c.name = a.category
    GROUP BY c.id
    ORDER BY c.order_index ASC, c.name ASC
  `);
  
  return categories.map(cat => ({
    id: cat.id,
    name: cat.name,
    icon: cat.icon,
    color: cat.color,
    description: cat.description,
    isSystem: Boolean(cat.is_system),
    orderIndex: cat.order_index,
    applianceCount: parseInt(cat.appliance_count) || 0,
    createdAt: cat.created_at,
    updatedAt: cat.updated_at
  }));
}

/**
 * @swagger
 * tags:
 *   name: Categories
 *   description: Category management endpoints
 */

/**
 * Get all categories with appliance counts
 */
router.get('/', verifyToken, async (req, res) => {
  try {
    const mappedCategories = await getAllCategoriesWithCounts();
    res.json(mappedCategories);
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

/**
 * Create a new category
 */
router.post('/', verifyToken, async (req, res) => {
  try {
    const { name, icon, color, description } = req.body;
    
    // Validate required fields
    if (!name || !icon || !color) {
      return res.status(400).json({
        success: false,
        error: 'Name, icon, and color are required'
      });
    }
    
    // Check if category already exists
    const existing = await db.findOne('categories', { name });
    if (existing) {
      return res.status(409).json({
        success: false,
        error: 'Category with this name already exists'
      });
    }
    
    // Get next order index
    const maxOrderResult = await db.raw(
      'SELECT MAX(order_index) as maxOrder FROM categories'
    );
    const nextOrder = (maxOrderResult[0]?.maxOrder || 0) + 1;
    
    // Insert new category
    const result = await db.insert('categories', {
      name,
      icon,
      color,
      description,
      isSystem: false,
      orderIndex: nextOrder,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    // Get the created category with appliance count (will be 0 for new)
    const categoryWithCount = await getCategoryWithCount(result.insertId);
    
    // Create audit log
    await createAuditLog(
      req.user?.id,
      'category_create',
      'categories',
      result.insertId,
      categoryWithCount,
      req.clientIp || req.ip,
      categoryWithCount.name
    );
    
    // Debug: Test if broadcast works at all

    // Broadcast update
    broadcast('category_created', categoryWithCount);

    res.status(201).json(categoryWithCount);
  } catch (error) {
    console.error('Error creating category:', error);
    res.status(500).json({ error: 'Failed to create category' });
  }
});

/**
 * Reorder categories - MUST BE BEFORE /:id ROUTES
 */
router.put('/reorder', verifyToken, async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    const { categories } = req.body;
    
    if (!Array.isArray(categories)) {
      return res.status(400).json({ error: 'Categories array is required' });
    }
    
    await connection.beginTransaction();
    
    // Update order for each category
    for (let i = 0; i < categories.length; i++) {
      const categoryId = categories[i].id;
      await connection.execute(
        'UPDATE categories SET order_index = ?, updated_at = NOW() WHERE id = ?',
        [i, categoryId]
      );
    }
    
    await connection.commit();
    
    // Fetch complete category data with appliance counts
    const updatedCategories = await getAllCategoriesWithCounts();

    // Broadcast update with complete data

    broadcast('categories_reordered', { categories: updatedCategories });

    res.json({ 
      message: 'Categories reordered successfully',
      categories: updatedCategories 
    });
  } catch (error) {
    await connection.rollback();
    console.error('Error reordering categories:', error);
    res.status(500).json({ error: 'Failed to reorder categories' });
  } finally {
    connection.release();
  }
});

/**
 * Update a category
 */
router.put('/:id', verifyToken, async (req, res) => {
  try {
    const categoryId = parseInt(req.params.id);
    const { name, icon, color, description } = req.body;
    
    // Get existing category
    const existingCategory = await db.findOne('categories', { id: categoryId });
    if (!existingCategory) {
      return res.status(404).json({
        success: false,
        error: 'Category not found'
      });
    }
    
    // Check if system category
    if (existingCategory.isSystem) {
      return res.status(403).json({
        success: false,
        error: 'System categories cannot be modified'
      });
    }
    
    // Prepare update data
    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (icon !== undefined) updateData.icon = icon;
    if (color !== undefined) updateData.color = color;
    if (description !== undefined) updateData.description = description;
    updateData.updatedAt = new Date();
    
    // Update category
    await db.update('categories', updateData, { id: categoryId });
    
    // Get updated category with appliance count
    const updatedCategory = await getCategoryWithCount(categoryId);
    
    // Create audit log
    await createAuditLog(
      req.user?.id,
      'category_update',
      'categories',
      categoryId,
      {
        old_data: existingCategory,
        new_data: updatedCategory
      },
      req.clientIp || req.ip,
      updatedCategory.name
    );
    
    // Debug: Test if broadcast works

    // Broadcast update
    broadcast('category_updated', updatedCategory);

    res.json(updatedCategory);
  } catch (error) {
    console.error('Error updating category:', error);
    res.status(500).json({ error: 'Failed to update category' });
  }
});

/**
 * Delete a category
 */
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    const categoryId = parseInt(req.params.id);
    
    // Get existing category
    const existingCategory = await db.findOne('categories', { id: categoryId });
    if (!existingCategory) {
      return res.status(404).json({
        success: false,
        error: 'Category not found'
      });
    }
    
    // Check if system category
    if (existingCategory.isSystem) {
      return res.status(403).json({
        success: false,
        error: 'System categories cannot be deleted'
      });
    }
    
    // Check if category has appliances
    const applianceCount = await db.count('appliances', { category: existingCategory.name });
    if (applianceCount > 0) {
      return res.status(400).json({
        success: false,
        error: `Cannot delete category with ${applianceCount} appliances`
      });
    }
    
    // Delete category
    await db.delete('categories', { id: categoryId });
    
    // Create audit log
    await createAuditLog(
      req.user?.id,
      'category_delete',
      'categories',
      categoryId,
      existingCategory,
      req.clientIp || req.ip,
      existingCategory.name
    );
    
    // Broadcast update
    broadcast('category_deleted', { id: categoryId });
    
    res.json({ message: 'Category deleted successfully' });
  } catch (error) {
    console.error('Error deleting category:', error);
    res.status(500).json({ error: 'Failed to delete category' });
  }
});

module.exports = router;
