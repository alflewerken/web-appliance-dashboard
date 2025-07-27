import React, { useEffect, useState } from 'react';
import { useSSE } from '../hooks/useSSE';
import './SSEDebugPanel.css';

const SSEDebugPanel = () => {
  const [events, setEvents] = useState([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const { addEventListener, isConnected } = useSSE();

  useEffect(() => {
    if (!addEventListener) return;

    // List of events to monitor
    const eventTypes = [
      'appliance_created',
      'appliance_updated',
      'appliance_deleted',
      'audit_log_created',
      'service_started',
      'service_stopped',
      'user_login',
      'user_logout',
    ];

    const unsubscribers = eventTypes.map(eventType =>
      addEventListener(eventType, data => {
        const eventInfo = {
          type: eventType,
          data,
          timestamp: new Date().toLocaleTimeString(),
        };
        setEvents(prev => [...prev.slice(-19), eventInfo]);
      })
    );

    return () => {
      unsubscribers.forEach(unsubscribe => {
        if (typeof unsubscribe === 'function') {
          unsubscribe();
        }
      });
    };
  }, [addEventListener]);

  if (!isExpanded) {
    return (
      <button
        className="sse-debug-toggle"
        onClick={() => setIsExpanded(true)}
        title="SSE Debug Panel"
      >
        🔌
      </button>
    );
  }

  return (
    <div className="sse-debug-panel">
      <div className="sse-debug-header">
        <h3>SSE Debug Panel</h3>
        <span
          className={`connection-status ${isConnected ? 'connected' : 'disconnected'}`}
        >
          {isConnected ? '● Connected' : '● Disconnected'}
        </span>
        <button onClick={() => setIsExpanded(false)}>×</button>
      </div>
      <div className="sse-debug-content">
        {events.length === 0 ? (
          <p>No events received yet...</p>
        ) : (
          <div className="event-list">
            {events.map((event, index) => (
              <div key={index} className="event-item">
                <div className="event-header">
                  <span className="event-type">{event.type}</span>
                  <span className="event-time">{event.timestamp}</span>
                </div>
                <pre className="event-data">
                  {JSON.stringify(event.data, null, 2)}
                </pre>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default SSEDebugPanel;
