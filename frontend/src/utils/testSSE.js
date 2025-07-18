// Test SSE connection directly
const testSSEConnection = async () => {
  const token = localStorage.getItem('token');
  if (!token) {
    console.error('❌ No auth token found');
    return;
  }

  const eventSource = new EventSource(
    '/api/sse/stream?token=' + encodeURIComponent(token)
  );

  eventSource.onopen = () => {
    };

  eventSource.onerror = error => {
    console.error('❌ SSE connection error:', error);
  };

  eventSource.onmessage = event => {
    };

  // Listen for specific events
  eventSource.addEventListener('service_status_changed', event => {
    );
  });

  // Clean up after 30 seconds
  setTimeout(() => {
    eventSource.close();
    }, 30000);
};

// Add to window for easy testing
window.testSSE = testSSEConnection;

export default testSSEConnection;
