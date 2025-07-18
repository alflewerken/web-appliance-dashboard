// Frontend Hot-Fix for Service Status Display
// This script ensures serviceStatus is properly mapped

(function() {
  console.log('🔧 Applying Service Status Hot-Fix...');
  
  // Hook into React component updates
  const originalCreateElement = React.createElement;
  React.createElement = function(...args) {
    // Check if this is an ApplianceCard component
    if (args[0] && args[0].name === 'ApplianceCard' && args[1] && args[1].appliance) {
      const appliance = args[1].appliance;
      
      // Ensure serviceStatus is set correctly
      if (appliance.service_status && !appliance.serviceStatus) {
        appliance.serviceStatus = appliance.service_status;
      }
      
      // Fix status command field
      if (appliance.status_command && !appliance.statusCommand) {
        appliance.statusCommand = appliance.status_command;
      }
      
      // Log for debugging
      if (appliance.name === 'Nextcloud-Mac') {
        console.log('Fixed Nextcloud-Mac:', {
          name: appliance.name,
          serviceStatus: appliance.serviceStatus,
          statusCommand: appliance.statusCommand
        });
      }
    }
    
    return originalCreateElement.apply(this, args);
  };
  
  console.log('✅ Service Status Hot-Fix applied');
  
  // Force re-render after 1 second
  setTimeout(() => {
    window.dispatchEvent(new Event('resize'));
  }, 1000);
})();
