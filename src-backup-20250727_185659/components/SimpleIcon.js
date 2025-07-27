import React from 'react';
import { getIconByName } from '../utils/lucideIconsLoader';
import { iconMap } from '../utils/iconMap';

// Simple Icon Wrapper Component
const SimpleIcon = ({ name, className = '', size = 24, ...props }) => {
  try {
    // Return early if no name provided
    if (!name) {
      const ServerIcon = getIconByName('Server');
      return (
        <ServerIcon
          className={`simple-icon lucide ${className}`}
          size={size}
          strokeWidth={1.5}
          fill="none"
          stroke="currentColor"
          {...props}
        />
      );
    }

    // First check if it's a service name that needs mapping
    const iconName = iconMap[name] || name;

    // Get the icon component dynamically
    const IconComponent = getIconByName(iconName);

    if (!IconComponent) {
      const ServerIcon = getIconByName('Server');
      return (
        <ServerIcon
          className={`simple-icon lucide ${className}`}
          size={size}
          strokeWidth={1.5}
          fill="none"
          stroke="currentColor"
          {...props}
        />
      );
    }

    return (
      <IconComponent
        className={`simple-icon lucide ${className}`}
        size={size}
        strokeWidth={1.5}
        fill="none"
        stroke="currentColor"
        {...props}
      />
    );
  } catch (error) {
    // Return a fallback icon in case of any error
    const ServerIcon = getIconByName('Server');
    return (
      <ServerIcon
        className={className}
        size={size}
        strokeWidth={1.5}
        {...props}
      />
    );
  }
};

export default SimpleIcon;
