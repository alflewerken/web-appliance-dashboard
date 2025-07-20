import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ApplianceModal from '../components/ApplianceModal';

jest.mock('axios');

// Mock icon components
jest.mock('lucide-react', () => ({
  X: () => <span>X</span>,
  Server: () => <span>Server</span>,
  Globe: () => <span>Globe</span>,
  Database: () => <span>Database</span>,
  Save: () => <span>Save</span>,
  Edit: () => <span>Edit</span>,
}));

// Mock utilities and components
jest.mock('../utils/iconMap', () => ({
  getAvailableIcons: () => ['Server', 'Globe', 'Database'],
}));

jest.mock('../utils/constants', () => ({
  COLOR_PRESETS: ['#007AFF', '#FF0000', '#00FF00'],
  UI_TEXT: {
    NAME: 'Name',
    URL: 'URL',
    PLACEHOLDER_NAME: 'Service name',
    PLACEHOLDER_URL: 'https://example.com',
    PLACEHOLDER_DESCRIPTION: 'Optional description',
  },
  DEFAULT_APPLIANCE: {
    name: '',
    url: '',
    icon: 'Server',
    color: '#007AFF',
    category: 'productivity',
  },
}));

jest.mock(
  '../components/IconSelector',
  () =>
    function MockIconSelector({ onSelect }) {
      return <div onClick={() => onSelect('Server')}>Icon Selector</div>;
    }
);

jest.mock(
  '../components/SimpleIcon',
  () =>
    function MockSimpleIcon({ name }) {
      return <span>{name}</span>;
    }
);

describe('ApplianceModal Component', () => {
  const mockOnClose = jest.fn();
  const mockOnSubmit = jest.fn();
  const mockOnDelete = jest.fn();

  const defaultProps = {
    appliance: null,
    formData: {
      name: '',
      url: '',
      icon: 'Server',
      color: '#007AFF',
      category: 'productivity',
      description: '',
    },
    setFormData: jest.fn(),
    onSubmit: mockOnSubmit,
    onClose: mockOnClose,
    onDelete: mockOnDelete,
    categories: [{ id: 'productivity', name: 'Productivity' }],
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders modal for creating new appliance', () => {
    render(<ApplianceModal {...defaultProps} />);

    // Check for form elements
    expect(screen.getByPlaceholderText('Service name')).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText('https://example.com')
    ).toBeInTheDocument();

    // Check for the Save button (German text)
    expect(screen.getByText('Save')).toBeInTheDocument();
  });

  test('validates required fields', async () => {
    const user = userEvent.setup();
    const mockSetFormData = jest.fn();

    render(<ApplianceModal {...defaultProps} setFormData={mockSetFormData} />);

    const submitButton = screen.getByText('Save');
    await user.click(submitButton);

    // Should not call onSubmit if fields are empty
    expect(mockOnSubmit).not.toHaveBeenCalled();
  });

  test('submits form with valid data', async () => {
    const user = userEvent.setup();
    const mockSetFormData = jest.fn(updater => {
      // Simulate the state update
      const newData = updater(defaultProps.formData);
      defaultProps.formData = newData;
    });

    const filledFormData = {
      name: 'New Service',
      url: 'http://new.local',
      icon: 'Server',
      color: '#007AFF',
      category: 'productivity',
      description: 'Test description',
    };

    render(
      <ApplianceModal
        {...defaultProps}
        formData={filledFormData}
        setFormData={mockSetFormData}
      />
    );

    const submitButton = screen.getByText('Save');
    await user.click(submitButton);

    expect(mockOnSubmit).toHaveBeenCalled();
    expect(mockOnSubmit).toHaveBeenCalledTimes(1);
  });
});
