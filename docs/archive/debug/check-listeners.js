// Check if user events are in the listeners map
console.log('Checking for user events in listeners:');
const userEvents = ['user_activated', 'user_deactivated', 'user_status_changed', 'audit_log_created'];
userEvents.forEach(event => {
    const hasListener = window.sseService.listeners.has(event);
    console.log(`${event}: ${hasListener ? '✅ registered' : '❌ NOT registered'}`);
    if (hasListener) {
        console.log(`  - Listeners: ${window.sseService.listeners.get(event).size}`);
    }
});