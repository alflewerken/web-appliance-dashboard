import React from 'react';
import ReactDOM from 'react-dom/client';
import './styles/globals.css'; // Global CSS variables
import './App.css';
import './i18n'; // Initialize i18n
import App from './App';
import StandaloneServicePanel from './components/Appliances/StandaloneServicePanel';
import './utils/axiosConfig'; // Import axios configuration

// Import mobile button override as LAST CSS file
// Mobile styles are now in App.js (consolidated)

// CRITICAL: Import tablet fixes as ABSOLUTE LAST to override everything
import './styles/tablet-panel-width.css';

// Error Boundary für besseres Debugging
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({
      error,
      errorInfo,
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '20px', color: 'red' }}>
          <h2>Something went wrong.</h2>
          <details style={{ whiteSpace: 'pre-wrap' }}>
            {this.state.error && this.state.error.toString()}
            <br />
            {this.state.errorInfo && this.state.errorInfo.componentStack}
          </details>
        </div>
      );
    }

    return this.props.children;
  }
}

const root = ReactDOM.createRoot(document.getElementById('root'));

// Check if we're loading the service panel
const servicePanelRoot = document.getElementById('service-panel-root');
if (servicePanelRoot && window.servicePanelConfig) {
  // Render standalone service panel
  const servicePanelReactRoot = ReactDOM.createRoot(servicePanelRoot);
  servicePanelReactRoot.render(
    <ErrorBoundary>
      <StandaloneServicePanel />
    </ErrorBoundary>
  );
} else {
  // Render normal app
  root.render(
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
}
