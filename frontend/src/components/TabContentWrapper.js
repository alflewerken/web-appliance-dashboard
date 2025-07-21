import React from 'react';
import { Box } from '@mui/material';
import MobileTabSwiper from './MobileTabSwiper';

const TabContentWrapper = ({ 
  value, 
  onChange, 
  tabs,
  renderTab,
  sx = {} 
}) => {
  // Create array of tab contents
  const tabContents = tabs.map((tab, index) => renderTab(tab, index));

  return (
    <MobileTabSwiper
      value={value}
      onChange={onChange}
      tabCount={tabs.length}
    >
      {tabContents}
    </MobileTabSwiper>
  );
};

export default TabContentWrapper;
