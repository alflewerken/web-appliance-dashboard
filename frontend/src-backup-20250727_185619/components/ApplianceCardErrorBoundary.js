import React from 'react';

class ApplianceCardErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ApplianceCard Error:', error, errorInfo);
    console.error('Appliance data:', this.props.appliance);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          className="appliance-card-error"
          style={{
            padding: '20px',
            backgroundColor: 'rgba(255, 0, 0, 0.1)',
            border: '1px solid rgba(255, 0, 0, 0.3)',
            borderRadius: '8px',
            textAlign: 'center',
          }}
        >
          <h3>Fehler bei Service-Karte</h3>
          <p>{this.props.appliance?.name || 'Unbekannter Service'}</p>
          <small>{this.state.error?.message}</small>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ApplianceCardErrorBoundary;
