/**
 * ServiceCopyModal Component
 *
 * Modal dialog for selecting a service to copy data from.
 * Includes search functionality and alphabetical sorting.
 *
 * @author Web Appliance Dashboard
 * @version 1.0.0
 */

import React, { useState, useMemo } from 'react';
import { X, Search, Copy } from 'lucide-react';
import SimpleIcon from './SimpleIcon';
import axios from '../utils/axiosConfig';
import './ServiceCopyModal.css';

/**
 * ServiceCopyModal - Modal dialog for copying service data
 *
 * @param {Object} props - Component props
 * @param {Array} props.services - List of available services
 * @param {Function} props.onSelectService - Callback when service is selected
 * @param {Function} props.onClose - Callback when modal is closed
 * @param {number|null} props.currentServiceId - ID of current service being edited (to exclude from list)
 * @returns {JSX.Element} The rendered modal component
 */
const ServiceCopyModal = ({
  services = [],
  onSelectService,
  onClose,
  currentServiceId = null,
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  // Filter and sort services
  const filteredServices = useMemo(() => {
    const filtered = services.filter(service => {
      // Exclude current service if editing
      if (currentServiceId && service.id === currentServiceId) {
        return false;
      }

      // Filter by search term
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        return (
          service.name.toLowerCase().includes(search) ||
          (service.description &&
            service.description.toLowerCase().includes(search)) ||
          (service.url && service.url.toLowerCase().includes(search))
        );
      }

      return true;
    });

    // Sort alphabetically by name
    filtered.sort((a, b) => a.name.localeCompare(b.name, 'de'));

    return filtered;
  }, [services, searchTerm, currentServiceId]);

  /**
   * Handle service selection - load commands and then notify parent
   */
  const handleSelectService = async service => {
    try {
      // Load commands for the selected service
      const response = await axios.get(`/api/commands/${service.id}`);
      const commands = response.data;

      // Add commands to the service object
      const serviceWithCommands = {
        ...service,
        customCommands: commands,
      };

      onSelectService(serviceWithCommands);
      onClose();
    } catch (error) {
      console.error('Error loading commands for service:', error);
      // Even if loading commands fails, still copy the service
      onSelectService(service);
      onClose();
    }
  };

  /**
   * Handle modal backdrop click
   */
  const handleBackdropClick = e => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="service-copy-modal-overlay" onClick={handleBackdropClick}>
      <div className="service-copy-modal" onClick={e => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="service-copy-modal-header">
          <h2>Service kopieren</h2>
          <button
            onClick={onClose}
            className="service-copy-modal-close"
            title="Dialog schließen"
            aria-label="Dialog schließen"
          >
            <X size={24} />
          </button>
        </div>

        {/* Search Bar */}
        <div className="service-copy-search-container">
          <div className="service-copy-search-wrapper">
            <Search size={20} className="service-copy-search-icon" />
            <input
              type="text"
              placeholder="Service suchen..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="service-copy-search-input"
              autoFocus
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="service-copy-search-clear"
                title="Suche löschen"
              >
                <X size={16} />
              </button>
            )}
          </div>
        </div>

        {/* Service List */}
        <div className="service-copy-modal-body">
          {filteredServices.length === 0 ? (
            <div className="service-copy-empty-state">
              {searchTerm ? (
                <>
                  <Search size={48} />
                  <p>Keine Services gefunden für "{searchTerm}"</p>
                </>
              ) : (
                <>
                  <Copy size={48} />
                  <p>Keine Services zum Kopieren verfügbar</p>
                </>
              )}
            </div>
          ) : (
            <div className="service-copy-list">
              {filteredServices.map(service => (
                <button
                  key={service.id}
                  onClick={() => handleSelectService(service)}
                  className="service-copy-item"
                  title={`Daten von "${service.name}" kopieren`}
                >
                  <div
                    className="service-copy-item-icon"
                    style={{ backgroundColor: service.color }}
                  >
                    <SimpleIcon name={service.icon} size={24} />
                  </div>
                  <div className="service-copy-item-info">
                    <h3>{service.name}</h3>
                    {service.description && (
                      <p className="service-copy-item-description">
                        {service.description}
                      </p>
                    )}
                    <p className="service-copy-item-url">{service.url}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="service-copy-modal-footer">
          <button onClick={onClose} className="btn-secondary" type="button">
            Abbrechen
          </button>
        </div>
      </div>
    </div>
  );
};

export default ServiceCopyModal;
