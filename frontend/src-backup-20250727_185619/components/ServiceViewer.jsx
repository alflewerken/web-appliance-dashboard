/**
 * ServiceViewer Component - Zeigt Service-Inhalte über Proxy an
 * 
 * Beispiel-Komponente für die Nutzung der Proxy-API
 */

import React, { useState, useEffect, useRef } from 'react';
import proxyService from '../services/proxyService';

const ServiceViewer = ({ serviceId }) => {
    const [service, setService] = useState(null);
    const [activeTab, setActiveTab] = useState('web');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const iframeRef = useRef(null);
    
    useEffect(() => {
        loadService();
    }, [serviceId]);
    
    const loadService = async () => {
        try {
            setLoading(true);
            // ServiceViewer sollte die appliance-Daten von der Parent-Komponente erhalten
            // oder über die applianceService API laden
            setService({ id: serviceId, name: 'Service ' + serviceId });
            setError(null);
        } catch (err) {
            setError('Failed to load service');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };
    
    const renderWebInterface = () => {
        if (!service) return null;
        
        return (
            <div className="web-interface-container" style={{ height: '600px' }}>
                <iframe
                    ref={iframeRef}
                    src={proxyService.getProxyUrl(serviceId, '/')}
                    style={{
                        width: '100%',
                        height: '100%',
                        border: 'none'
                    }}
                    title={`${service.name} Web Interface`}
                    sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
                />
            </div>
        );
    };
    
    const renderTerminal = () => {
        // Hier würde die Terminal-Komponente mit WebSocket eingebunden
        return (
            <div className="terminal-container">
                <p>Terminal WebSocket URL: {proxyService.getTerminalWebSocketUrl(serviceId)}</p>
                {/* <XTerminal config={proxyService.getTerminalConfig(serviceId)} /> */}
            </div>
        );
    };
    
    const renderRemoteDesktop = () => {
        // Hier würde die Guacamole-Komponente eingebunden
        return (
            <div className="remote-desktop-container">
                <p>VNC/RDP WebSocket URL: {proxyService.getVncWebSocketUrl(serviceId)}</p>
                {/* <GuacamoleViewer config={proxyService.getRemoteDesktopConfig(serviceId)} /> */}
            </div>
        );
    };
    
    const renderFiles = () => {
        // Hier würde der File-Browser eingebunden
        return (
            <div className="file-browser-container">
                <p>File browser would be implemented here</p>
                {/* <FileBrowser serviceId={serviceId} /> */}
            </div>
        );
    };
    
    if (loading) return <div>Loading service...</div>;
    if (error) return <div className="error">{error}</div>;
    if (!service) return null;
    
    return (
        <div className="service-viewer">
            <div className="service-header">
                <h2>{service.name}</h2>
                <p>{service.description}</p>
            </div>
            
            <div className="service-tabs">
                <button 
                    className={activeTab === 'web' ? 'active' : ''}
                    onClick={() => setActiveTab('web')}
                >
                    Web Interface
                </button>
                
                {service.type === 'ssh' && (
                    <button 
                        className={activeTab === 'terminal' ? 'active' : ''}
                        onClick={() => setActiveTab('terminal')}
                    >
                        Terminal
                    </button>
                )}
                
                {(service.type === 'vnc' || service.type === 'rdp') && (
                    <button 
                        className={activeTab === 'remote' ? 'active' : ''}
                        onClick={() => setActiveTab('remote')}
                    >
                        Remote Desktop
                    </button>
                )}
                
                {service.type === 'ssh' && (
                    <button 
                        className={activeTab === 'files' ? 'active' : ''}
                        onClick={() => setActiveTab('files')}
                    >
                        Files
                    </button>
                )}
            </div>
            
            <div className="service-content">
                {activeTab === 'web' && renderWebInterface()}
                {activeTab === 'terminal' && renderTerminal()}
                {activeTab === 'remote' && renderRemoteDesktop()}
                {activeTab === 'files' && renderFiles()}
            </div>
        </div>
    );
};

export default ServiceViewer;