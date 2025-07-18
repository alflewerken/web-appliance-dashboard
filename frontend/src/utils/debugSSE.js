// Debug utility for SSE events
export const debugSSE = () => {
  // Check if sseService is available
  if (window.sseService) {
    );

    // Listen to all setting-related events
    const events = [
      'setting_update',
      'settings_updated',
      'settings_bulk_update',
    ];

    events.forEach(eventType => {
      window.sseService.addEventListener(eventType, data => {
        });
    });

    } else {
    console.error('SSE Service not found on window object');
  }
};

// Auto-attach to window for easy console access
if (typeof window !== 'undefined') {
  window.debugSSE = debugSSE;
}
