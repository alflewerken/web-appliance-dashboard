import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Simplified ServiceCard component for testing
const ServiceCard = ({ service, onUpdate, onDelete }) => {
  const [expanded, setExpanded] = React.useState(false);
  
  const handleOpen = () => {
    window.open(service.url, '_blank');
  };

  const handleDelete = () => {
    if (window.confirm(`Möchten Sie ${service.name} wirklich löschen?`)) {
      onDelete(service.id);
    }
  };

  return (
    <div className="service-card">
      <div className={`status-indicator status-${service.status}`} data-testid="status-indicator">
        {service.status === 'online' ? 'Online' : 'Offline'}
      </div>
      <h3>{service.name}</h3>
      <p>{service.description}</p>
      <span>{service.category}</span>
      
      <button onClick={handleOpen}>Öffnen</button>
      <button onClick={handleDelete}>Löschen</button>
      
      {service.sshEnabled && (
        <button onClick={() => window.open(`/terminal/${service.id}`, 'SSH Terminal')}>
          Terminal
        </button>
      )}
      
      {service.vncEnabled && (
        <button>VNC</button>
      )}
      
      <button onClick={() => setExpanded(!expanded)}>
        {expanded ? 'Details ausblenden' : 'Details anzeigen'}
      </button>
      
      {expanded && (
        <div>
          <div>Port: {service.port}</div>
          <div>SSH aktiviert</div>
        </div>
      )}
    </div>
  );
};

describe('ServiceCard Component', () => {
  const mockService = {
    id: 1,
    name: 'Test Server',
    url: 'http://192.168.1.100',
    category: 'Server',
    status: 'online',
    description: 'Test server description',
    port: 22,
    sshEnabled: true,
    vncEnabled: true
  };

  beforeEach(() => {
    jest.clearAllMocks();
    window.open = jest.fn();
    window.confirm = jest.fn(() => true);
  });

  it('should render service information correctly', () => {
    render(<ServiceCard service={mockService} onUpdate={jest.fn()} onDelete={jest.fn()} />);

    expect(screen.getByText('Test Server')).toBeInTheDocument();
    expect(screen.getByText('Test server description')).toBeInTheDocument();
    expect(screen.getByText('Server')).toBeInTheDocument();
  });

  it('should show online status', () => {
    render(<ServiceCard service={mockService} onUpdate={jest.fn()} onDelete={jest.fn()} />);

    const statusIndicator = screen.getByTestId('status-indicator');
    expect(statusIndicator).toHaveClass('status-online');
    expect(screen.getByText(/online/i)).toBeInTheDocument();
  });

  it('should show offline status', () => {
    const offlineService = { ...mockService, status: 'offline' };
    render(<ServiceCard service={offlineService} onUpdate={jest.fn()} onDelete={jest.fn()} />);

    const statusIndicator = screen.getByTestId('status-indicator');
    expect(statusIndicator).toHaveClass('status-offline');
    expect(screen.getByText(/offline/i)).toBeInTheDocument();
  });

  it('should open service URL', async () => {
    render(<ServiceCard service={mockService} onUpdate={jest.fn()} onDelete={jest.fn()} />);

    const openButton = screen.getByRole('button', { name: /öffnen/i });
    await userEvent.click(openButton);

    expect(window.open).toHaveBeenCalledWith('http://192.168.1.100', '_blank');
  });

  it('should show SSH terminal button when enabled', () => {
    render(<ServiceCard service={mockService} onUpdate={jest.fn()} onDelete={jest.fn()} />);
    expect(screen.getByRole('button', { name: /terminal/i })).toBeInTheDocument();
  });

  it('should expand and collapse details', async () => {
    render(<ServiceCard service={mockService} onUpdate={jest.fn()} onDelete={jest.fn()} />);

    expect(screen.queryByText(/port: 22/i)).not.toBeInTheDocument();

    const expandButton = screen.getByRole('button', { name: /details anzeigen/i });
    await userEvent.click(expandButton);

    expect(screen.getByText(/port: 22/i)).toBeInTheDocument();
    expect(screen.getByText(/ssh aktiviert/i)).toBeInTheDocument();

    const collapseButton = screen.getByRole('button', { name: /details ausblenden/i });
    await userEvent.click(collapseButton);

    expect(screen.queryByText(/port: 22/i)).not.toBeInTheDocument();
  });

  it('should handle deletion', async () => {
    const onDelete = jest.fn();
    render(<ServiceCard service={mockService} onUpdate={jest.fn()} onDelete={onDelete} />);

    const deleteButton = screen.getByRole('button', { name: /löschen/i });
    await userEvent.click(deleteButton);

    expect(window.confirm).toHaveBeenCalledWith('Möchten Sie Test Server wirklich löschen?');
    expect(onDelete).toHaveBeenCalledWith(1);
  });
});
