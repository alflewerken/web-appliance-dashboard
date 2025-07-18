// Force reload on iPad when admin mode changes
export const forceIPadReload = adminMode => {
  const isIPad =
    /iPad/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  if (!isIPad) return;

  // Store the new admin mode in session storage
  const storedAdminMode = sessionStorage.getItem('lastAdminMode');

  if (storedAdminMode !== null && storedAdminMode !== adminMode.toString()) {
    sessionStorage.setItem('lastAdminMode', adminMode.toString());
    window.location.reload();
  } else {
    sessionStorage.setItem('lastAdminMode', adminMode.toString());
  }
};
