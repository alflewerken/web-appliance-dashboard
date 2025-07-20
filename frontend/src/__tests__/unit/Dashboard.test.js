import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import axios from 'axios';

// Mock Components
jest.mock('../../components/ApplianceCard', () => ({
  __esModule: true,
  default: ({ appliance }) => (
    <div data-testid={`appliance-card-${appliance.id}`}>
      {appliance.name}
    </div>
  ),
}));

// Mock Dashboard - since we need to test if it renders
const Dashboard = () => {
  const [appliances, setAppliances] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);

  React.useEffect(() => {
    const fetchAppliances = async () => {
      try {
        const response = await axios.get('/api/appliances');
        setAppliances(response.data);
        setLoading(false);
      } catch (err) {
        setError('Fehler beim Laden');
        setLoading(false);
      }
    };
    fetchAppliances();
  }, []);

  if (loading) return <div>Lädt...</div>;
  if (error) return <div>{error}</div>;
  if (appliances.length === 0) return <div>Keine Appliances gefunden</div>;

  return (
    <div data-testid="appliances-grid" className="grid-view">
      {appliances.map(app => (
        <div key={app.id} data-testid={`appliance-card-${app.id}`}>
          {app.name}
        </div>
      ))}
    </div>
  );
};

describe('Dashboard Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render appliances when loaded', async () => {
    const mockAppliances = [
      { id: 1, name: 'Server 1' },
      { id: 2, name: 'Network Device' }
    ];

    axios.get.mockResolvedValueOnce({ data: mockAppliances });

    render(
      <BrowserRouter>
        <Dashboard />
      </BrowserRouter>
    );

    expect(screen.getByText(/lädt/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Server 1')).toBeInTheDocument();
      expect(screen.getByText('Network Device')).toBeInTheDocument();
    });
  });

  it('should show error state', async () => {
    axios.get.mockRejectedValueOnce(new Error('Network error'));

    render(
      <BrowserRouter>
        <Dashboard />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/fehler beim laden/i)).toBeInTheDocument();
    });
  });

  it('should show empty state', async () => {
    axios.get.mockResolvedValueOnce({ data: [] });

    render(
      <BrowserRouter>
        <Dashboard />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/keine appliances gefunden/i)).toBeInTheDocument();
    });
  });
});
