import React, { useState } from 'react';
import {
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Box,
} from '@mui/material';
import { Edit, Trash2, GripVertical } from 'lucide-react';

const CategoryDragDrop = ({
  categories,
  onReorder,
  onEdit,
  onDelete,
  getIconForCategory,
}) => {
  const [draggedItem, setDraggedItem] = useState(null);
  const [dragOverItem, setDragOverItem] = useState(null);
  const [dropPosition, setDropPosition] = useState(null);

  const handleDragStart = (e, index) => {
    setDraggedItem(index);
    e.dataTransfer.effectAllowed = 'move';
    // Add drag image
    const dragImage = e.currentTarget.cloneNode(true);
    dragImage.style.opacity = '0.5';
    dragImage.style.position = 'absolute';
    dragImage.style.top = '-1000px';
    document.body.appendChild(dragImage);
    e.dataTransfer.setDragImage(
      dragImage,
      e.clientX - e.currentTarget.getBoundingClientRect().left,
      20
    );
    setTimeout(() => document.body.removeChild(dragImage), 0);
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    if (draggedItem === null) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const { height } = rect;

    // Determine if we're in the top or bottom half
    if (y < height / 2) {
      setDropPosition('before');
      setDragOverItem(index);
    } else {
      setDropPosition('after');
      setDragOverItem(index);
    }
  };

  const handleDragLeave = e => {
    // Only clear if we're leaving the list entirely
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setDragOverItem(null);
      setDropPosition(null);
    }
  };

  const handleDrop = (e, index) => {
    e.preventDefault();

    if (draggedItem === null || draggedItem === index) {
      setDraggedItem(null);
      setDragOverItem(null);
      setDropPosition(null);
      return;
    }

    let newIndex = index;
    if (dropPosition === 'after') {
      newIndex = draggedItem < index ? index : index + 1;
    } else {
      newIndex = draggedItem < index ? index - 1 : index;
    }

    if (onReorder) {
      onReorder(draggedItem, newIndex);
    }

    setDraggedItem(null);
    setDragOverItem(null);
    setDropPosition(null);
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
    setDragOverItem(null);
    setDropPosition(null);
  };

  return (
    <List sx={{ pb: 2 }}>
      {categories.map((category, index) => (
        <Box key={category.id} sx={{ position: 'relative' }}>
          {/* Drop indicator line */}
          {dragOverItem === index && dropPosition === 'before' && (
            <Box
              sx={{
                position: 'absolute',
                top: -1,
                left: 0,
                right: 0,
                height: 2,
                backgroundColor: '#007AFF',
                zIndex: 10,
                boxShadow: '0 0 8px rgba(0, 122, 255, 0.6)',
              }}
            />
          )}

          <ListItem
            draggable
            onDragStart={e => handleDragStart(e, index)}
            onDragOver={e => handleDragOver(e, index)}
            onDragLeave={handleDragLeave}
            onDrop={e => handleDrop(e, index)}
            onDragEnd={handleDragEnd}
            sx={{
              backgroundColor: 'rgba(0, 0, 0, 0.3)',
              mb: 1,
              borderRadius: 1,
              border: '1px solid rgba(255, 255, 255, 0.1)',
              cursor: 'move',
              transition: 'all 0.2s ease',
              opacity: draggedItem === index ? 0.5 : 1,
              transform: draggedItem === index ? 'scale(0.98)' : 'none',
              '&:hover': {
                backgroundColor: 'rgba(0, 0, 0, 0.4)',
                borderColor: 'rgba(255, 255, 255, 0.2)',
              },
            }}
          >
            <ListItemIcon sx={{ minWidth: 40 }}>
              <GripVertical
                size={20}
                style={{
                  color: 'var(--text-secondary)',
                  cursor: 'grab',
                }}
              />
            </ListItemIcon>

            {category.color && (
              <ListItemIcon sx={{ minWidth: 40 }}>
                <Box
                  sx={{
                    width: 24,
                    height: 24,
                    backgroundColor: category.color,
                    borderRadius: '4px',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                  }}
                />
              </ListItemIcon>
            )}

            {category.icon && (
              <ListItemIcon sx={{ minWidth: 40 }}>
                <Box
                  sx={{
                    fontSize: '24px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 24,
                    height: 24,
                  }}
                >
                  {getIconForCategory(category.icon)}
                </Box>
              </ListItemIcon>
            )}

            <ListItemText
              primary={category.name}
              secondary={`${category.appliances_count || 0} Services`}
              primaryTypographyProps={{
                sx: { color: 'var(--text-primary)' },
              }}
              secondaryTypographyProps={{
                sx: { color: 'var(--text-secondary)' },
              }}
            />

            <ListItemSecondaryAction>
              <IconButton
                edge="end"
                onClick={() => onEdit(category)}
                sx={{
                  color: '#007AFF',
                  mr: 1,
                  '&:hover': {
                    backgroundColor: 'rgba(0, 122, 255, 0.1)',
                    color: '#0051D5',
                  },
                }}
              >
                <Edit size={20} />
              </IconButton>
              <IconButton
                edge="end"
                onClick={() => onDelete(category)}
                sx={{
                  color: '#FF3B30',
                  '&:hover': {
                    backgroundColor: 'rgba(255, 59, 48, 0.1)',
                    color: '#FF453A',
                  },
                }}
              >
                <Trash2 size={20} />
              </IconButton>
            </ListItemSecondaryAction>
          </ListItem>

          {/* Drop indicator line after */}
          {dragOverItem === index && dropPosition === 'after' && (
            <Box
              sx={{
                position: 'absolute',
                bottom: -1,
                left: 0,
                right: 0,
                height: 2,
                backgroundColor: '#007AFF',
                zIndex: 10,
                boxShadow: '0 0 8px rgba(0, 122, 255, 0.6)',
              }}
            />
          )}
        </Box>
      ))}
    </List>
  );
};

export default CategoryDragDrop;
