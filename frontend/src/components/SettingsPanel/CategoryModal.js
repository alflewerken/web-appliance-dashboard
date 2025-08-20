import React, { useState } from 'react';
import { X, Edit, Plus } from 'lucide-react';
import { iconMap } from '../../utils/iconMap';
import { COLOR_PRESETS } from '../../utils/constants';
import IconSelector from '../IconSelector';
import SimpleIcon from '../SimpleIcon';
import './CategoryModal.css';

const CategoryModal = ({
  category = null,
  onClose,
  onSave,
  isLoading = false,
}) => {
  const isEditing = !!category;

  const [formData, setFormData] = useState({
    name: category?.name || '',
    description: category?.description || '',
    icon: category?.icon || 'Folder',
    color: category?.color || '#007AFF',
  });

  const [showIconSelector, setShowIconSelector] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async e => {
    e.preventDefault();

    if (!formData.name.trim()) {
      setError('Name ist erforderlich');
      return;
    }

    setError('');
    await onSave(formData);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal category-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>
            {isEditing ? (
              <>
                <Edit size={24} style={{ marginRight: '12px' }} />
                Kategorie bearbeiten
              </>
            ) : (
              <>
                <Plus size={24} style={{ marginRight: '12px' }} />
                Neue Kategorie
              </>
            )}
          </h2>
          <button onClick={onClose} className="modal-close">
            <X size={24} />
          </button>
        </div>

        <div className="modal-body">
          {error && <div className="error-message">{error}</div>}

          <form onSubmit={handleSubmit} className="category-form">
            <div className="form-row">
              <div className="form-group">
                <label>Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={e =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="z.B. Smart Home"
                  required
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Beschreibung</label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={e =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  placeholder="z.B. Home Automation Services"
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Icon</label>
                <div className="icon-selector-container">
                  <button
                    type="button"
                    className="icon-selector-trigger"
                    onClick={() => setShowIconSelector(true)}
                  >
                    <div className="selected-icon-preview">
                      <SimpleIcon name={formData.icon} />
                    </div>
                    <div className="icon-selector-info">
                      <span className="selected-icon-name">
                        {formData.icon}
                      </span>
                      <small>Klicken zum Ändern</small>
                    </div>
                    <Edit size={16} className="edit-icon" />
                  </button>
                </div>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Farbe</label>
                <div className="color-grid">
                  {COLOR_PRESETS.map(color => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setFormData({ ...formData, color })}
                      style={{ backgroundColor: color }}
                      className={`color-btn ${formData.color === color ? 'active' : ''}`}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Preview */}
            <div className="form-row">
              <div className="form-group">
                <label>Vorschau</label>
                <div className="category-preview-box">
                  <div
                    className="category-icon-preview"
                    style={{ backgroundColor: formData.color }}
                  >
                    <SimpleIcon name={formData.icon} />
                  </div>
                  <div className="category-info-preview">
                    <h4>{formData.name || 'Kategorie Name'}</h4>
                    {formData.description && <p>{formData.description}</p>}
                  </div>
                </div>
              </div>
            </div>
          </form>
        </div>

        <div className="modal-footer">
          <button
            type="button"
            onClick={onClose}
            className="btn-secondary"
            disabled={isLoading}
          >
            Abbrechen
          </button>
          <button
            type="submit"
            onClick={handleSubmit}
            className="btn-primary"
            disabled={isLoading || !formData.name.trim()}
          >
            {isLoading ? (
              <>
                <div className="spinner-small"></div>
                {isEditing ? 'Speichern...' : 'Erstellen...'}
              </>
            ) : isEditing ? (
              'Speichern'
            ) : (
              'Erstellen'
            )}
          </button>
        </div>
      </div>

      {/* Icon Selector Modal */}
      {showIconSelector && (
        <IconSelector
          selectedIcon={formData.icon}
          onIconSelect={iconName => {
            setFormData({ ...formData, icon: iconName });
            setShowIconSelector(false);
          }}
          onClose={() => setShowIconSelector(false)}
        />
      )}
    </div>
  );
};

export default CategoryModal;
