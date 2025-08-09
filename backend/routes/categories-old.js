// Categories API routes
const express = require('express');
const router = express.Router();
const pool = require('../utils/database');
const { broadcast } = require('./sse');
const { createAuditLog } = require('../utils/auditLogger');
const {
  mapCategoryDbToJs,
  mapCategoryJsToDb,
  getCategorySelectColumns
} = require('../utils/dbFieldMappingCategories');

/**
 * @swagger
 * tags:
 *   name: Categories
 *   description: Category management endpoints
 */

/**
 * @swagger
 * /api/categories:
 *   get:
 *     summary: Get all categories with appliance counts
 *     tags: [Categories]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of all categories
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: integer
 *                     example: 1
 *                   name:
 *                     type: string
 *                     example: productivity
 *                   display_name:
 *                     type: string
 *                     example: Productivity
 *                   icon:
 *                     type: string
 *                     example: Briefcase
 *                   color:
 *                     type: string
 *                     example: #007AFF
 *                   order_index:
 *                     type: integer
 *                     example: 0
 *                   is_system:
 *                     type: boolean
 *                     example: true
 *                   appliances_count:
 *                     type: integer
 *                     example: 5
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Failed to fetch categories
 */
// Get all categories
router.get('/', async (req, res) => {
  try {
    // First get all categories
    const [categories] = await pool.execute(
      `SELECT ${getCategorySelectColumns()} FROM categories ORDER BY order_index ASC, is_system DESC, name`
    );

    // Then get appliance counts for each category
    const [counts] = await pool.execute(`
      SELECT category, COUNT(*) as count
      FROM appliances
      WHERE category IS NOT NULL
      GROUP BY category
    `);

    // Create a map of counts by category name
    const countMap = {};
    counts.forEach(row => {
      countMap[row.category] = row.count;
    });

    // Map categories to JS format and add counts
    const categoriesWithCounts = categories.map(category => {
      const mapped = mapCategoryDbToJs(category);
      mapped.appliancesCount = countMap[mapped.name] || 0;
      return mapped;
    });

    res.json(categoriesWithCounts);
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// Update categories order - MUST BE BEFORE /:id route
router.put('/reorder', async (req, res) => {
  const connection = await pool.getConnection();

  try {
    const { categories } = req.body;

    if (!categories || !Array.isArray(categories)) {
      return res.status(400).json({ error: 'Invalid categories data' });
    }

    await connection.beginTransaction();

    // Update order for each category
    for (let i = 0; i < categories.length; i++) {
      const category = categories[i];
      await connection.execute(
        'UPDATE categories SET `order_index` = ? WHERE id = ?',
        [i, category.id]
      );
    }

    await connection.commit();

    // Fetch updated categories to broadcast complete data
    const [updatedCategories] = await connection.execute(
      'SELECT * FROM categories ORDER BY `order_index` ASC'
    );

    // Get appliance counts
    const [counts] = await connection.execute(`
      SELECT category, COUNT(*) as count
      FROM appliances
      WHERE category IS NOT NULL
      GROUP BY category
    `);

    // Create a map of counts by category name
    const countMap = {};
    counts.forEach(row => {
      countMap[row.category] = row.count;
    });

    // Add counts to categories
    const categoriesWithCounts = updatedCategories.map(category => ({
      ...category,
      order: category.order_index, // Map order_index to order for frontend compatibility
      appliances_count: countMap[category.name] || 0,
    }));

    console.log('Updated categories order successfully');
    res.json({
      success: true,
      message: 'Categories order updated successfully',
      categories: categoriesWithCounts,
    });

    // Broadcast complete category data
    broadcast('categories_reordered', categoriesWithCounts);
  } catch (error) {
    await connection.rollback();
    console.error('Error updating categories order:', error);
    res.status(500).json({ error: 'Failed to update categories order' });
  } finally {
    connection.release();
  }
});

// Get category by ID
router.get('/:id', async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM categories WHERE id = ?', [
      req.params.id,
    ]);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Category not found' });
    }

    res.json(rows[0]);
  } catch (error) {
    console.error('Error fetching category:', error);
    res.status(500).json({ error: 'Failed to fetch category' });
  }
});

// Create new category
router.post('/', async (req, res) => {
  try {
    const { name, icon, color, description } = req.body;

    console.log('Creating category with data:', req.body);

    if (!name) {
      return res.status(400).json({ error: 'Category name is required' });
    }

    // Get the maximum order value
    const [maxOrderRows] = await pool.execute(
      'SELECT MAX(order_index) as maxOrder FROM categories'
    );
    const nextOrder = (maxOrderRows[0].maxOrder || 0) + 1;

    // Prepare data with camelCase
    const categoryData = {
      name,
      icon: icon || 'Folder',
      color: color || '#007AFF',
      displayName: name,
      description: description || null,
      isSystem: false,
      orderIndex: nextOrder,
    };

    // Convert to database format
    const dbData = mapCategoryJsToDb(categoryData);

    const [result] = await pool.execute(
      'INSERT INTO categories (name, icon, color, description, is_system, order_index) VALUES (?, ?, ?, ?, ?, ?)',
      [
        dbData.name,
        dbData.icon,
        dbData.color,
        description || null,
        dbData.is_system,
        dbData.order_index,
      ]
    );

    // Get the newly created category with proper mapping
    const [[newCategory]] = await pool.execute(
      `SELECT ${getCategorySelectColumns()} FROM categories WHERE id = ?`,
      [result.insertId]
    );

    const mappedCategory = mapCategoryDbToJs(newCategory);

    console.log('Created category:', mappedCategory);

    // Create audit log
    const ipAddress = req.clientIp;
    await createAuditLog(
      req.user?.id || null,
      'category_created',
      'categories',
      result.insertId,
      {
        category_data: mappedCategory,
        created_by: req.user?.username || 'unknown',
        timestamp: new Date().toISOString(),
      },
      ipAddress
    );

    res.status(201).json({
      ...mappedCategory,
      message: 'Category created successfully',
    });

    // Broadcast category creation
    broadcast('category_created', mappedCategory);

    // Broadcast audit log update
    broadcast('audit_log_created', {
      action: 'category_created',
      resource_type: 'categories',
      resource_id: result.insertId,
    });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'Category name already exists' });
    }
    console.error('Error creating category:', error);
    res.status(500).json({ error: 'Failed to create category' });
  }
});

// Update category
router.put('/:id', async (req, res) => {
  try {
    const { name, icon, color, description } = req.body;

    console.log('Updating category ID', req.params.id, 'with data:', req.body);

    if (!name) {
      return res.status(400).json({ error: 'Category name is required' });
    }

    // Get original category data for audit log
    const [originalRows] = await pool.execute(
      'SELECT * FROM categories WHERE id = ?',
      [req.params.id]
    );
    if (originalRows.length === 0) {
      return res.status(404).json({ error: 'Category not found' });
    }

    const originalData = originalRows[0];

    const [result] = await pool.execute(
      'UPDATE categories SET name = ?, icon = ?, color = ?, description = ? WHERE id = ?',
      [
        name,
        icon || 'Folder',
        color || '#007AFF',
        description || null,
        req.params.id,
      ]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Category not found' });
    }

    const updatedData = {
      id: parseInt(req.params.id),
      name,
      icon: icon || 'Folder',
      color: color || '#007AFF',
      description: description || null,
    };

    console.log('Updated category successfully');

    // Create audit log with both original and new data
    const ipAddress = req.clientIp;
    await createAuditLog(
      req.user?.id || null,
      'category_updated',
      'categories',
      parseInt(req.params.id),
      {
        original_data: originalData,
        new_data: updatedData,
        changes: {
          name:
            originalData.name !== name
              ? { old: originalData.name, new: name }
              : undefined,
          icon:
            originalData.icon !== (icon || 'Folder')
              ? { old: originalData.icon, new: icon || 'Folder' }
              : undefined,
          color:
            originalData.color !== (color || '#007AFF')
              ? { old: originalData.color, new: color || '#007AFF' }
              : undefined,
          description:
            originalData.description !== (description || null)
              ? { old: originalData.description, new: description || null }
              : undefined,
        },
        updated_by: req.user?.username || 'unknown',
        timestamp: new Date().toISOString(),
      },
      ipAddress
    );

    res.json({ message: 'Category updated successfully' });

    // Broadcast category update
    broadcast('category_updated', updatedData);

    // Broadcast audit log update
    broadcast('audit_log_created', {
      action: 'category_updated',
      resource_type: 'categories',
      resource_id: parseInt(req.params.id),
    });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'Category name already exists' });
    }
    console.error('Error updating category:', error);
    res.status(500).json({ error: 'Failed to update category' });
  }
});

// Delete category
router.delete('/:id', async (req, res) => {
  try {
    // Get full category data before deletion for audit log
    const [categoryRows] = await pool.execute(
      'SELECT * FROM categories WHERE id = ?',
      [req.params.id]
    );
    if (categoryRows.length === 0) {
      return res.status(404).json({ error: 'Category not found' });
    }

    const categoryData = categoryRows[0];

    // Check if any appliances use this category
    const [applianceRows] = await pool.execute(
      'SELECT COUNT(*) as count FROM appliances WHERE category = ?',
      [categoryData.name]
    );
    if (applianceRows[0].count > 0) {
      return res
        .status(400)
        .json({
          error: `Cannot delete category: ${applianceRows[0].count} appliances are using this category`,
        });
    }

    const [result] = await pool.execute('DELETE FROM categories WHERE id = ?', [
      req.params.id,
    ]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Category not found' });
    }

    // Create audit log with complete category data for potential restoration
    const ipAddress = req.clientIp;
    await createAuditLog(
      req.user?.id || null,
      'category_deleted',
      'categories',
      parseInt(req.params.id),
      {
        category: categoryData,
        deleted_by: req.user?.username || 'unknown',
        timestamp: new Date().toISOString(),
      },
      ipAddress
    );

    res.json({ message: 'Category deleted successfully' });

    // Broadcast category deletion
    broadcast('category_deleted', { id: parseInt(req.params.id) });

    // Broadcast audit log update
    broadcast('audit_log_created', {
      action: 'category_deleted',
      resource_type: 'categories',
      resource_id: parseInt(req.params.id),
    });
  } catch (error) {
    console.error('Error deleting category:', error);
    res.status(500).json({ error: 'Failed to delete category' });
  }
});

module.exports = router;
