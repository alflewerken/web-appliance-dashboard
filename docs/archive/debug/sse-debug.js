// Debug script to test SSE events
// Run this in the browser console while on the Web Appliance Dashboard

// Check if SSE service is available
if (window.sseService) {
    console.log('✅ SSE Service found');
    console.log('Connected:', window.sseService.isConnected);
    console.log('Listeners:', window.sseService.listeners);
} else {
    console.error('❌ SSE Service not found');
}

// Function to trigger user activation/deactivation
async function testUserToggle(userId) {
    const token = localStorage.getItem('token');
    if (!token) {
        console.error('No auth token found');
        return;
    }
    
    try {
        const response = await fetch(`/api/auth/users/${userId}/toggle-active`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        const data = await response.json();
        console.log('Toggle response:', data);
    } catch (error) {
        console.error('Toggle error:', error);
    }
}

// Monitor all SSE events
function monitorSSE() {
    if (!window.sseService) {
        console.error('SSE Service not available');
        return;
    }
    
    const events = [
        'user_activated',
        'user_deactivated', 
        'user_status_changed',
        'audit_log_created'
    ];
    
    events.forEach(eventType => {
        window.sseService.addEventListener(eventType, (data) => {
            console.log(`🎯 SSE Event: ${eventType}`, data);
            console.log(`Timestamp: ${new Date().toISOString()}`);
        });
    });
    
    console.log('✅ SSE monitoring started for:', events);
}

// Start monitoring
monitorSSE();

// Instructions
console.log(`
📡 SSE Debug Script Loaded
========================
1. This script is monitoring user activation/deactivation events
2. To test, use: testUserToggle(userId)
3. Example: testUserToggle(2)
4. Watch the console for SSE events
`);

// Export for easy use
window.testUserToggle = testUserToggle;
window.monitorSSE = monitorSSE;