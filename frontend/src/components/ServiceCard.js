// ServiceCard Component - Transparent Proxy Support
import React from 'react';
import { Card, CardContent, Typography, Button } from '@mui/material';
import proxyService from '../services/proxyService';

const ServiceCard = ({ service }) => {
  const openService = () => {
    // Verwende den ProxyService für konsistente URL-Generierung
    proxyService.openInNewTab(service);
  };

  return (
    <Card>
      <CardContent>
        <Typography variant="h5">{service.name}</Typography>
        <Typography color="textSecondary">{service.type}</Typography>
        <Typography variant="body2">
          {service.ip_address}:{service.port}
        </Typography>
        <Button 
          variant="contained" 
          color="primary" 
          onClick={openService}
          style={{ marginTop: '10px' }}
        >
          Open Service
        </Button>
      </CardContent>
    </Card>
  );
};

export default ServiceCard;