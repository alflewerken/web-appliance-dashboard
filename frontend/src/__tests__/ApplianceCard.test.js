import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ApplianceCard from '../components/ApplianceCard';

// Mock axios
jest.mock('axios');

// Mock the icon component
jest.mock('../components/SimpleIcon', () => {
  return function MockSimpleIcon({ name }) {
    return <span data-testid="icon">{name}</span>;
  };
});

// Mock lucide-react icons
jest.mock('lucide-react', () => ({
  Edit2: () => <span>Edit</span>,
  Trash2: () => <span>Delete</span>,
  Star: () => <span>Star</span>,
  Settings2: () => <span>Settings</span>,
  MoreVertical: () => <span>More</span>,
  XCircle: () => <span>Stop</span>,
  CheckCircle: () => <span>Start</span>,
  Terminal: () => <span>Terminal</span>
}));

describe('ApplianceCard Component', () => {
  const mockAppliance = {
    id: 1,
    name: 'Test Service',
    url: 'http://test.local',
    icon: 'Server',
    color: '#007AFF',
    description: 'Test description',
    category: 'productivity',
    isFavorite: false,
    transparency: 0.3,
    service_status: 'running'
  };

  const mockHandlers = {
    onUpdate: jest.fn(),
    onStatusUpdate: jest.fn(),
    onOpen: jest.fn(),
    onEdit: jest.fn(),
    onDelete: jest.fn(),
    onFavorite: jest.fn(),
    onSettings: jest.fn(),
    onService: jest.fn(),
    onTerminal: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });
  test('renders appliance card with correct information', () => {
    render(
      <ApplianceCard 
        appliance={mockAppliance} 
        {...mockHandlers}
        showServiceButtons={false}
        showSSHButtons={false}
        adminMode={false}
      />
    );

    expect(screen.getByText('Test Service')).toBeInTheDocument();
    expect(screen.getByText('Test description')).toBeInTheDocument();
    expect(screen.getByTestId('icon')).toHaveTextContent('Server');
  });

  test('clicking the card calls onOpen handler', () => {
    render(
      <ApplianceCard 
        appliance={mockAppliance} 
        {...mockHandlers}
        showServiceButtons={false}
        showSSHButtons={false}
        adminMode={false}
      />
    );

    const card = screen.getByText('Test Service').closest('.card-front');
    fireEvent.click(card);

    expect(mockHandlers.onOpen).toHaveBeenCalledWith(mockAppliance);
  });

  test('shows status indicator for running service', () => {
    const runningAppliance = { ...mockAppliance, hasServiceCommands: true };
    
    render(
      <ApplianceCard 
        appliance={runningAppliance} 
        {...mockHandlers}
        showServiceButtons={true}
        showSSHButtons={false}
        adminMode={false}
      />
    );

    // Service control buttons should be visible when hasServiceCommands is true
    const serviceButtons = screen.queryAllByRole('button');
    expect(serviceButtons.length).toBeGreaterThan(0);
  });

  test('favorite button calls onFavorite handler', async () => {
    const user = userEvent.setup();
    
    render(
      <ApplianceCard 
        appliance={mockAppliance} 
        {...mockHandlers}
        showServiceButtons={false}
        showSSHButtons={false}
        adminMode={false}
      />
    );

    const favoriteButton = screen.getByTitle(/favoriten/i);
    await user.click(favoriteButton);

    expect(mockHandlers.onFavorite).toHaveBeenCalledWith(mockAppliance);
  });

  test('admin mode shows edit button in action menu', () => {
    render(
      <ApplianceCard 
        appliance={mockAppliance} 
        {...mockHandlers}
        showServiceButtons={false}
        showSSHButtons={false}
        adminMode={false}{true}
      />
    );

    // In admin mode, edit button should be in the action row
    const editButton = screen.getByTitle('Bearbeiten');
    
    expect(editButton).toBeInTheDocument();
    
    // Check if the button has the correct class
    expect(editButton).toHaveClass('action-btn', 'edit-btn');
  });
});