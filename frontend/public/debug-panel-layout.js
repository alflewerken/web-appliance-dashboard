// Panel Layout Debug Helper
// This file helps debug panel layout issues

window.debugPanelLayout = function() {
  const app = document.querySelector('.music-app');
  const panels = document.querySelectorAll('.panel-container');
  const mainContent = document.querySelector('.main-content');
  
  console.group('Panel Layout Debug');
  
  // Check app classes
  console.log('App Classes:', app.className);
  
  // Check CSS variables
  const computedStyle = getComputedStyle(app);
  console.log('CSS Variables:', {
    totalPanelWidth: computedStyle.getPropertyValue('--total-panel-width'),
    servicePanelWidth: computedStyle.getPropertyValue('--service-panel-width'),
    userPanelWidth: computedStyle.getPropertyValue('--user-panel-width'),
    settingsPanelWidth: computedStyle.getPropertyValue('--settings-panel-width')
  });
  
  // Check main content
  if (mainContent) {
    const mainStyle = getComputedStyle(mainContent);
    console.log('Main Content:', {
      marginRight: mainStyle.marginRight,
      width: mainStyle.width
    });
  }
  
  // Check each panel
  panels.forEach(panel => {
    const panelStyle = getComputedStyle(panel);
    const panelClass = panel.className;
    console.log(`Panel (${panelClass}):`, {
      position: panelStyle.position,
      right: panelStyle.right,
      transform: panelStyle.transform,
      display: panelStyle.display,
      width: panel.offsetWidth + 'px',
      zIndex: panelStyle.zIndex
    });
    
    // Check if panel has MUI Box inside
    const muiBox = panel.querySelector('.MuiBox-root');
    if (muiBox) {
      const boxStyle = getComputedStyle(muiBox);
      console.log(`- MUI Box:`, {
        position: boxStyle.position,
        width: boxStyle.width,
        height: boxStyle.height
      });
    }
  });
  
  console.groupEnd();
  
  // Return useful info
  return {
    hasServicePanel: app.classList.contains('has-service-panel'),
    hasUserPanel: app.classList.contains('has-user-panel'),
    hasSettingsPanel: app.classList.contains('has-settings-panel'),
    panelCount: panels.length,
    visiblePanels: Array.from(panels).filter(p => {
      const style = getComputedStyle(p);
      return style.display !== 'none' && style.transform !== 'translateX(calc(100% + 100px))';
    }).length
  };
};

// Auto-run on page load
window.addEventListener('load', () => {
  console.log('Panel Layout Debug Helper loaded. Use window.debugPanelLayout() to debug.');
});

// Watch for panel changes
const observer = new MutationObserver((mutations) => {
  mutations.forEach((mutation) => {
    if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
      const target = mutation.target;
      if (target.classList.contains('music-app')) {
        console.log('Panel state changed:', {
          hasServicePanel: target.classList.contains('has-service-panel'),
          hasUserPanel: target.classList.contains('has-user-panel'),
          hasSettingsPanel: target.classList.contains('has-settings-panel')
        });
      }
    }
  });
});

// Start observing
setTimeout(() => {
  const app = document.querySelector('.music-app');
  if (app) {
    observer.observe(app, { attributes: true });
  }
}, 1000);