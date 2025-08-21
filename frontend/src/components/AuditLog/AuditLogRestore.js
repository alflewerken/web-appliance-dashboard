// Audit Log Restore functionality

import axios from '../../utils/axiosConfig';

// Check if a log entry can be restored
export const canRestore = (log) => {
  // Deleted actions
  if (log.action === 'appliance_delete' || log.action === 'appliance_deleted') {
    return { canRestore: true, type: 'restore', resourceType: 'appliances' };
  }
  if (log.action === 'category_delete' || log.action === 'category_deleted') {
    return { canRestore: true, type: 'restore', resourceType: 'categories' };
  }
  if (log.action === 'service_delete' || log.action === 'service_deleted') {
    return { canRestore: true, type: 'restore', resourceType: 'services' };
  }
  if (log.action === 'user_delete' || log.action === 'user_deleted') {
    return { canRestore: true, type: 'restore', resourceType: 'users' };
  }
  if (log.action === 'ssh_host_deleted') {
    return { canRestore: true, type: 'restore', resourceType: 'ssh_host' };
  }
  if (log.action === 'host_deleted' || log.action === 'host_delete' || 
      log.action === 'hostDeleted' || log.action === 'hostDelete') {
    return { canRestore: true, type: 'restore', resourceType: 'host' };
  }

  // Updated actions
  if (log.action === 'appliance_update' || log.action === 'appliance_updated') {
    return { canRestore: true, type: 'revert', resourceType: 'appliances' };
  }
  if (log.action === 'category_update' || log.action === 'category_updated') {
    return { canRestore: true, type: 'revert', resourceType: 'categories' };
  }
  if (log.action === 'user_update' || log.action === 'user_updated') {
    return { canRestore: true, type: 'revert', resourceType: 'users' };
  }
  if (log.action === 'ssh_host_updated') {
    return { canRestore: true, type: 'revert', resourceType: 'ssh_host' };
  }
  if (log.action === 'host_updated' || log.action === 'host_update' || 
      log.action === 'hostUpdated' || log.action === 'hostUpdate') {
    return { canRestore: true, type: 'revert', resourceType: 'host' };
  }

  return { canRestore: false };
};

// Get resource name from log details
export const getResourceName = (log) => {
  const details = log.metadata || log.details || {};
  
  // Try common name fields
  if (details.name) return details.name;
  if (details.appliance_name) return details.appliance_name;
  if (details.service_name) return details.service_name;
  if (details.category_name) return details.category_name;
  if (details.username) return details.username;
  if (details.hostName) return details.hostName;
  if (details.host_name) return details.host_name;
  
  // For SSH keys
  if (log.action.includes('ssh_key')) {
    return details.key_name || details.name || null;
  }
  
  // For restore operations
  if (log.action.includes('restore')) {
    const restoredName = details.restored_name || details.restored_host || 
      details.restored_service_name || details.restored_appliance_name || details.name;
    if (restoredName) return restoredName;
  }
  
  // For delete operations
  if (log.action.includes('delete')) {
    const deletedName = details.deleted_name || details.deleted_host || 
      details.deleted_service_name || details.deleted_appliance_name || details.name;
    if (deletedName) return deletedName;
  }
  
  // Fallback to resource_name
  return log.resourceName || log.resource_name || 'Unbekannt';
};

// Handle restore action
export const handleRestore = async (log, restoreData = null) => {
  const restoreInfo = canRestore(log);
  if (!restoreInfo.canRestore) {
    throw new Error('Diese Aktion kann nicht rückgängig gemacht werden');
  }

  let endpoint = '';
  
  if (restoreInfo.resourceType === 'appliances') {
    endpoint = restoreInfo.type === 'restore'
      ? `/api/auditRestore/restore/appliance/${log.id}`
      : `/api/auditRestore/revert/appliance/${log.id}`;
  } else if (restoreInfo.resourceType === 'services') {
    endpoint = restoreInfo.type === 'restore'
      ? `/api/auditRestore/restore/service/${log.id}`
      : `/api/auditRestore/revert/service/${log.id}`;
  } else if (restoreInfo.resourceType === 'categories') {
    endpoint = restoreInfo.type === 'restore'
      ? `/api/auditRestore/restore/category/${log.id}`
      : `/api/auditRestore/revert/category/${log.id}`;
  } else if (restoreInfo.resourceType === 'users') {
    endpoint = restoreInfo.type === 'restore'
      ? `/api/auditRestore/restore/users/${log.id}`
      : `/api/auditRestore/revert/users/${log.id}`;
  } else if (restoreInfo.resourceType === 'ssh_host') {
    endpoint = restoreInfo.type === 'restore'
      ? `/api/auditRestore/restore/ssh_host/${log.id}`
      : `/api/auditRestore/revert/ssh_host/${log.id}`;
  } else if (restoreInfo.resourceType === 'host') {
    endpoint = restoreInfo.type === 'restore'
      ? `/api/auditRestore/restore/host/${log.id}`
      : `/api/auditRestore/revert/host/${log.id}`;
  }

  if (!endpoint) {
    throw new Error('Kein Restore-Endpoint für diesen Ressourcentyp definiert');
  }

  // Handle different data formats
  // For backward compatibility, if restoreData is a string, treat it as newName
  let requestData = {};
  if (typeof restoreData === 'string') {
    requestData = { newName: restoreData };
  } else if (restoreData && typeof restoreData === 'object') {
    requestData = restoreData;
  }
  
  const response = await axios.post(endpoint, requestData);
  
  return response.data;
};
