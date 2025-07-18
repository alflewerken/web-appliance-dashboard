// Direct EventSource check
console.log('Checking EventSource directly:');
if (window.sseService && window.sseService.eventSource) {
    const es = window.sseService.eventSource;
    console.log('EventSource state:', es.readyState);
    console.log('EventSource URL:', es.url);
    
    // Add direct listeners to EventSource
    console.log('Adding direct event listeners to EventSource...');
    
    const testEvents = ['user_activated', 'user_deactivated', 'user_status_changed', 'audit_log_created'];
    
    testEvents.forEach(eventType => {
        es.addEventListener(eventType, function(event) {
            console.log(`🚨 DIRECT EVENT: ${eventType}`, event.data);
            try {
                const data = JSON.parse(event.data);
                console.log(`🚨 PARSED DATA:`, data);
            } catch (e) {
                console.log('Parse error:', e);
            }
        });
    });
    
    console.log('✅ Direct listeners added. Now try toggling a user status.');
} else {
    console.error('❌ No EventSource found');
}