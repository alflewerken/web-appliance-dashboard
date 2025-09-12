import { useState } from 'react';
import { BackupService } from '../services/backupService';

/**
 * Centralized hook for handling backup restore with key validation
 * This eliminates code duplication across BackupTab, useDragAndDrop, and SelectiveImportDialog
 */
export const useRestoreWithValidation = () => {
  const [showInvalidKeyDialog, setShowInvalidKeyDialog] = useState(false);
  const [pendingRestore, setPendingRestore] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  
  /**
   * Central restore function with validation
   * @param {File|Object} fileOrData - File object or parsed backup data
   * @param {string} decryptionKey - The backup decryption key
   * @param {Object} options - Additional options
   * @param {boolean} options.restoreSnmpMetrics - Whether to restore SNMP metrics
   * @param {boolean} options.isSelectiveImport - Whether this is a selective import
   * @param {Object} options.selectiveData - Pre-filtered data for selective import
   * @param {Function} options.onSuccess - Success callback
   * @param {Function} options.onError - Error callback
   * @param {Function} options.onProgress - Progress callback
   * @returns {Promise<Object>} Result object with success status
   */
  const validateAndRestore = async (fileOrData, decryptionKey, options = {}) => {
    setIsProcessing(true);
    
    try {
      let result;
      
      if (options.isSelectiveImport) {
        // For selective import, we already have the prepared data
        result = await BackupService.selectiveImport(options.selectiveData, decryptionKey);
      } else {
        // For regular restore
        result = await BackupService.restoreBackup(
          fileOrData, 
          decryptionKey, 
          options.restoreSnmpMetrics
        );
      }
      
      // Check if key validation failed
      if (result.requiresConfirmation && result.keyValidation && !result.keyValidation.isValid) {
        console.log('❌ Invalid key detected - showing dialog');
        
        // Store all necessary data for retry
        setPendingRestore({
          fileOrData,
          decryptionKey,
          options,
          result
        });
        
        setShowInvalidKeyDialog(true);
        setIsProcessing(false);
        return { success: false, needsConfirmation: true };
      }
      
      // Handle successful response
      if (result.sessionId || result.success) {
        if (options.onSuccess) {
          await options.onSuccess(result);
        }
        setIsProcessing(false);
        return result;
      }
      
      // Handle error
      if (options.onError) {
        // Provide more specific error message for wrong key
        let errorMessage = result.message || 'Unbekannter Fehler';
        
        // Check if it's a decryption/key error that wasn't caught by validation
        if (errorMessage.toLowerCase().includes('decrypt') || 
            errorMessage.toLowerCase().includes('schlüssel') ||
            errorMessage.toLowerCase().includes('key')) {
          errorMessage = 'Falscher Backup-Schlüssel: Die eingegebenen Daten können nicht entschlüsselt werden.';
        }
        
        options.onError(errorMessage);
      }
      setIsProcessing(false);
      return result;
      
    } catch (error) {
      console.error('Restore error:', error);
      
      // Extract error message and make it more user-friendly
      let errorMessage = error.message || 'Unbekannter Fehler';
      
      // Check for specific error types
      if (error.response?.status === 401) {
        errorMessage = 'Nicht autorisiert. Bitte melden Sie sich erneut an.';
      } else if (error.response?.status === 400) {
        errorMessage = error.response.data?.message || 'Ungültige Backup-Daten';
      } else if (errorMessage.includes('decrypt') || errorMessage.includes('key')) {
        errorMessage = 'Falscher Backup-Schlüssel: Die Backup-Datei kann nicht entschlüsselt werden.';
      }
      
      if (options.onError) {
        options.onError(errorMessage);
      }
      setIsProcessing(false);
      return { success: false, error: errorMessage };
    }
  };
  
  /**
   * Handler when user confirms to continue with invalid key
   */
  const handleInvalidKeyConfirm = async () => {
    console.log('👤 User confirmed to continue with invalid key');
    setShowInvalidKeyDialog(false);
    
    if (!pendingRestore) return;
    
    setIsProcessing(true);
    
    try {
      let result;
      
      if (pendingRestore.options.isSelectiveImport) {
        // Add confirmation flag to selective data
        const confirmedData = {
          ...pendingRestore.options.selectiveData,
          confirmInvalidKey: true
        };
        result = await BackupService.selectiveImport(confirmedData, pendingRestore.decryptionKey);
      } else {
        // Regular restore with confirmation
        result = await BackupService.restoreBackupWithConfirmation(
          pendingRestore.fileOrData,
          pendingRestore.decryptionKey,
          pendingRestore.options.restoreSnmpMetrics,
          true // confirmInvalidKey flag
        );
      }
      
      if (result.sessionId || result.success) {
        if (pendingRestore.options.onSuccess) {
          await pendingRestore.options.onSuccess(result);
        }
      } else if (pendingRestore.options.onError) {
        pendingRestore.options.onError(result.message || 'Restore failed');
      }
      
    } catch (error) {
      console.error('Confirmed restore error:', error);
      if (pendingRestore.options.onError) {
        pendingRestore.options.onError(error.message);
      }
    } finally {
      setIsProcessing(false);
      setPendingRestore(null);
    }
  };
  
  /**
   * Handler when user wants to retry with different key
   */
  const handleInvalidKeyRetry = () => {
    console.log('👤 User wants to enter a different key');
    setShowInvalidKeyDialog(false);
    
    if (pendingRestore && pendingRestore.options.onRetryKey) {
      pendingRestore.options.onRetryKey(pendingRestore.fileOrData);
    }
    
    setPendingRestore(null);
  };
  
  /**
   * Handler when user cancels the operation
   */
  const handleInvalidKeyCancel = () => {
    console.log('👤 User cancelled restore');
    setShowInvalidKeyDialog(false);
    
    if (pendingRestore && pendingRestore.options.onCancel) {
      pendingRestore.options.onCancel();
    }
    
    setPendingRestore(null);
    setIsProcessing(false);
  };
  
  return {
    // Main function
    validateAndRestore,
    
    // State
    isProcessing,
    showInvalidKeyDialog,
    
    // Dialog handlers
    invalidKeyHandlers: {
      onConfirm: handleInvalidKeyConfirm,
      onRetry: handleInvalidKeyRetry,
      onCancel: handleInvalidKeyCancel
    },
    
    // Utility to reset state
    reset: () => {
      setShowInvalidKeyDialog(false);
      setPendingRestore(null);
      setIsProcessing(false);
    }
  };
};
