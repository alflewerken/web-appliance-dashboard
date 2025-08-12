import React, { useState, useEffect } from 'react';
import axios from 'axios';

/**
 * Network Browser Component
 * Allows browsing the internal network as if you were there
 */
const NetworkBrowser = () => {
    const [services, setServices] = useState([]);
    const [customTarget, setCustomTarget] = useState('');
    const [customPort, setCustomPort] = useState('80');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        discoverServices();
    }, []);

    const discoverServices = async () => {
        try {
            const response = await axios.get('/api/discover');
            setServices(response.data.services);
        } catch (error) {
            console.error('Failed to discover services:', error);
        }
    };

    const openInNewTab = (target, port, protocol = 'http') => {
        const proxyUrl = `/api/proxy/${target}:${port}/`;
        window.open(proxyUrl, '_blank');
    };

    const openCustomTarget = () => {
        if (customTarget) {
            openInNewTab(customTarget, customPort);
        }
    };

    return (
        <div className="network-browser">
            <h2>Internal Network Access</h2>
            <p>You can access any internal service as if you were in the network.</p>

            {/* Known Services */}
            <div className="known-services">
                <h3>Known Services</h3>
                <div className="service-grid">
                    {services.map((service, index) => (
                        <div key={index} className="service-card">
                            <h4>{service.name}</h4>
                            <p>{service.type}</p>
                            <p>{service.target}</p>
                            <button 
                                onClick={() => {
                                    const [host, port] = service.target.split(':');
                                    openInNewTab(host, port, service.protocol);
                                }}
                                className="btn btn-primary"
                            >
                                Open
                            </button>
                        </div>
                    ))}
                </div>
            </div>

            {/* Custom Target */}
            <div className="custom-target">
                <h3>Access Custom Target</h3>
                <div className="input-group">
                    <input
                        type="text"
                        placeholder="IP or hostname (e.g., 192.168.1.100)"
                        value={customTarget}
                        onChange={(e) => setCustomTarget(e.target.value)}
                    />
                    <input
                        type="text"
                        placeholder="Port"
                        value={customPort}
                        onChange={(e) => setCustomPort(e.target.value)}
                        style={{ width: '100px' }}
                    />
                    <button onClick={openCustomTarget} className="btn btn-primary">
                        Open
                    </button>
                </div>
            </div>

            {/* Quick Access */}
            <div className="quick-access">
                <h3>Quick Access</h3>
                <div className="quick-buttons">
                    <button 
                        onClick={() => openInNewTab('proxmox.local', '8006', 'https')}
                        className="btn btn-secondary"
                    >
                        Proxmox VE
                    </button>
                    <button 
                        onClick={() => openInNewTab('192.168.1.1', '80')}
                        className="btn btn-secondary"
                    >
                        Router
                    </button>
                    <button 
                        onClick={() => openInNewTab('nas.local', '5000')}
                        className="btn btn-secondary"
                    >
                        NAS
                    </button>
                </div>
            </div>

            {/* Instructions */}
            <div className="instructions">
                <h3>How it works</h3>
                <ul>
                    <li>Enter any internal IP address or hostname</li>
                    <li>The dashboard acts as a bridge to the internal network</li>
                    <li>No VPN or special configuration needed</li>
                    <li>All traffic is securely proxied through the dashboard</li>
                </ul>
            </div>
        </div>
    );
};

export default NetworkBrowser;