// Main Audit Log Detail Renderer that orchestrates all sub-renderers
import React, { useState } from 'react';
import { Box } from '@mui/material';
import { useTheme } from '@mui/material';

// Import sub-components
import ResponsiveChip from './ResponsiveChip';
import { renderHostRestored, renderHostReverted, renderHostUpdate } from './HostRenderers';
import { renderUserStatusChange, renderUserRestored, renderUserReverted, renderUserDeleted, renderUserUpdate } from './UserRenderers';
import { renderApplianceUpdate, renderApplianceDeleted, renderApplianceReverted, renderApplianceRestored } from './ApplianceRenderers';
import { renderFileTransfer } from './FileTransferRenderer';
import { renderDefault } from './DefaultRenderer';
import RestoreSection from './RestoreSection';
import { canRestore, getResourceName, handleRestore } from '../AuditLogRestore';
import '../AuditLogDetail.css';

const AuditLogDetailRenderer = ({ log, onRestoreComplete }) => {
  const theme = useTheme();
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreError, setRestoreError] = useState(null);
  const [restoreSuccess, setRestoreSuccess] = useState(false);
  const [showNameInput, setShowNameInput] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [showEmailInput, setShowEmailInput] = useState(false);

  // Robuste Dark Mode Erkennung
  const isDarkMode = theme.palette.mode === 'dark' || document.body.classList.contains('theme-dark');
  
  const details = log.metadata || log.details || {};
  const restoreInfo = canRestore(log);

  const handleRestoreClick = async () => {
    // Validierung: Bei User-Wiederherstellung mit neuen Daten muss E-Mail angegeben werden
    if (showEmailInput && (log.action === 'user_delete' || log.action === 'user_deleted') && !newEmail) {
      setRestoreError('Bitte geben Sie eine neue E-Mail-Adresse ein.');
      return;
    }

    setIsRestoring(true);
    setRestoreError(null);
    setRestoreSuccess(false);

    try {
      // For user restore, pass both new name and email if provided
      const restoreData = {};
      if (showNameInput && newName) {
        restoreData.newName = newName;
      }
      if (showEmailInput && newEmail) {
        restoreData.newEmail = newEmail;
      }
      
      await handleRestore(log, Object.keys(restoreData).length > 0 ? restoreData : null);
      setRestoreSuccess(true);
      if (onRestoreComplete) {
        onRestoreComplete();
      }
    } catch (error) {
      const errorMessage = error.response?.data?.error || error.message;
      
      // Check if error is about email or username already in use for user restoration
      if (log.action === 'user_delete' || log.action === 'user_deleted') {
        if (errorMessage.includes('Email') && errorMessage.includes('already in use')) {
          // Show BOTH name and email inputs when email conflict occurs
          if (!showEmailInput) {
            setShowEmailInput(true);
            setShowNameInput(true);  // Also show name input for complete flexibility
            setRestoreError('Die E-Mail-Adresse ist bereits vergeben. Bitte geben Sie neue Benutzerdaten ein.');
          } else {
            // If email input is already shown, the provided email is also taken
            setRestoreError('Diese E-Mail-Adresse ist ebenfalls bereits vergeben. Bitte verwenden Sie eine andere.');
          }
        } else if (errorMessage.includes('username') && errorMessage.includes('already exists')) {
          // Show BOTH inputs when username conflict occurs
          if (!showNameInput) {
            setShowNameInput(true);
            setShowEmailInput(true);  // Also show email input
            setRestoreError('Der Benutzername ist bereits vergeben. Bitte geben Sie neue Benutzerdaten ein.');
          } else {
            // If name input is already shown, the provided name is also taken
            setRestoreError('Dieser Benutzername ist ebenfalls bereits vergeben. Bitte verwenden Sie einen anderen.');
          }
        } else {
          setRestoreError(errorMessage);
        }
      } else {
        setRestoreError(errorMessage);
      }
    } finally {
      setIsRestoring(false);
    }
  };

  // Render different views based on action type
  const renderContent = () => {
    // Host actions
    if (log.action === 'host_restored' || log.action === 'hostRestored' || 
        log.action === 'host_restore' || log.action === 'hostRestore') {
      return renderHostRestored(log, details, isDarkMode);
    }
    
    if (log.action === 'host_reverted' || log.action === 'hostReverted' || 
        log.action === 'host_revert' || log.action === 'hostRevert') {
      return renderHostReverted(log, details, isDarkMode);
    }

    if (log.action === 'host_update' || log.action === 'host_updated' || 
        log.action === 'hostUpdate' || log.action === 'hostUpdated') {
      return renderHostUpdate(log, details, isDarkMode);
    }

    // User actions
    if (log.action === 'user_activated' || log.action === 'userActivated' || 
        log.action === 'user_deactivated' || log.action === 'userDeactivated') {
      return renderUserStatusChange(log, details, isDarkMode);
    }

    if (log.action === 'user_restored' || log.action === 'userRestored') {
      return renderUserRestored(log, details, isDarkMode);
    }

    if (log.action === 'user_reverted') {
      return renderUserReverted(log, details, isDarkMode);
    }

    if (log.action === 'user_delete' || log.action === 'user_deleted') {
      return renderUserDeleted(log, details, isDarkMode);
    }

    if (log.action === 'user_update' || log.action === 'user_updated') {
      return renderUserUpdate(log, details, isDarkMode);
    }

    // File transfer actions
    if (log.action === 'ssh_file_upload' || log.action === 'ssh_file_download' || 
        log.action === 'file_upload' || log.action === 'file_download' ||
        log.action === 'fileUpload' || log.action === 'fileDownload') {
      return renderFileTransfer(log, details, isDarkMode);
    }

    // Appliance actions
    if (log.action === 'appliance_update' || log.action === 'appliance_updated') {
      return renderApplianceUpdate(log, details, isDarkMode);
    }

    if (log.action === 'appliance_delete' || log.action === 'appliance_deleted') {
      return renderApplianceDeleted(log, details, isDarkMode);
    }

    if (log.action === 'appliance_reverted' || log.action === 'applianceReverted') {
      return renderApplianceReverted(log, details, isDarkMode);
    }

    if (log.action === 'appliance_restored' || log.action === 'applianceRestored') {
      return renderApplianceRestored(log, details, isDarkMode);
    }

    // Default renderer for all other cases
    return renderDefault(log, details, isDarkMode);
  };

  return (
    <Box onClick={(e) => e.stopPropagation()}>
      {renderContent()}
      
      {/* Restore section */}
      {restoreInfo.canRestore && (
        <RestoreSection
          log={log}
          restoreInfo={restoreInfo}
          isRestoring={isRestoring}
          setIsRestoring={setIsRestoring}
          restoreError={restoreError}
          setRestoreError={setRestoreError}
          restoreSuccess={restoreSuccess}
          setRestoreSuccess={setRestoreSuccess}
          showNameInput={showNameInput}
          setShowNameInput={setShowNameInput}
          newName={newName}
          setNewName={setNewName}
          showEmailInput={showEmailInput}
          setShowEmailInput={setShowEmailInput}
          newEmail={newEmail}
          setNewEmail={setNewEmail}
          handleRestoreClick={handleRestoreClick}
          getResourceName={getResourceName}
        />
      )}
    </Box>
  );
};

export default AuditLogDetailRenderer;
