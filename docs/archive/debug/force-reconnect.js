// Force reconnect SSE with new event listeners
console.log('🔄 Forcing SSE reconnection...');

// First disconnect
if (window.sseService) {
    window.sseService.disconnect();
    console.log('✅ Disconnected');
    
    // Wait a moment
    setTimeout(() => {
        console.log('🔌 Reconnecting...');
        window.sseService.connect().then(() => {
            console.log('✅ Reconnected!');
            
            // Check if events are now registered
            const es = window.sseService.eventSource;
            if (es) {
                // Manually add listeners for user events to test
                const userEvents = ['user_activated', 'user_deactivated', 'user_status_changed', 'audit_log_created'];
                
                userEvents.forEach(eventType => {
                    es.addEventListener(eventType, function(event) {
                        console.log(`🎯 EVENT RECEIVED: ${eventType}`, event.data);
                        
                        // Also notify through the service
                        try {
                            const data = JSON.parse(event.data);
                            window.sseService.notifyListeners(eventType, data);
                        } catch (e) {
                            console.error('Parse error:', e);
                        }
                    });
                });
                
                console.log('✅ Manual event listeners added for:', userEvents);
                console.log('🎯 Now try toggling a user status!');
            }
        }).catch(err => {
            console.error('❌ Reconnection failed:', err);
        });
    }, 500);
} else {
    console.error('❌ SSE Service not found');
}