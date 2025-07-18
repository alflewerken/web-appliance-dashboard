import React, { useEffect } from 'react';
import ReactDOM from 'react-dom';
import { X } from 'lucide-react';
import './SliderModal.css';

const SliderModal = ({
  isOpen,
  onClose,
  title,
  value,
  onChange,
  min,
  max,
  step,
  unit,
  formatValue,
  onApply,
  previewComponent, // New prop for the preview
}) => {
  // iOS Safari fix
  useEffect(() => {
    if (isOpen) {
      // Prevent background scrolling on iOS
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.width = '100%';

      // Force iOS to recognize the modal
      setTimeout(() => {
        const modal = document.querySelector('.slider-modal-overlay');
        if (modal) {
          modal.style.display = 'flex';
          // Force a repaint
          modal.offsetHeight;
        }
      }, 10);
    } else {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
    }

    return () => {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
    };
  }, [isOpen, title, value]);

  if (!isOpen) return null;

  const displayValue = formatValue
    ? formatValue(value)
    : `${value}${unit || ''}`;

  const handleApply = () => {
    if (onApply) onApply();
    onClose();
  };

  const modalContent = (
    <div className="slider-modal-overlay" onClick={onClose}>
      <div className="slider-modal" onClick={e => e.stopPropagation()}>
        <div className="slider-modal-header">
          <h3>{title}</h3>
          <button className="slider-modal-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="slider-modal-content">
          <div className="slider-value-display">{displayValue}</div>

          {/* Preview Component */}
          {previewComponent && (
            <div className="slider-preview-container">{previewComponent}</div>
          )}

          <div className="slider-container">
            <span className="slider-label">
              {min}
              {unit}
            </span>
            <input
              type="range"
              min={min}
              max={max}
              step={step}
              value={value}
              onChange={e => onChange(parseFloat(e.target.value))}
              className="slider-input"
            />
            <span className="slider-label">
              {max}
              {unit}
            </span>
          </div>

          <div className="slider-ticks">
            <div className="tick" style={{ left: '0%' }}></div>
            <div className="tick" style={{ left: '25%' }}></div>
            <div className="tick" style={{ left: '50%' }}></div>
            <div className="tick" style={{ left: '75%' }}></div>
            <div className="tick" style={{ left: '100%' }}></div>
          </div>
        </div>

        <div className="slider-modal-footer">
          <button className="slider-modal-btn cancel" onClick={onClose}>
            Abbrechen
          </button>
          <button className="slider-modal-btn apply" onClick={handleApply}>
            Übernehmen
          </button>
        </div>
      </div>
    </div>
  );

  // Use React Portal to render modal at document root
  return ReactDOM.createPortal(modalContent, document.body);
};

export default SliderModal;
