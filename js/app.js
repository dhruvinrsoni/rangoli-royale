/**
 * rangoli-royale — Main Application
 */
'use strict';

(function () {
  /** @type {HTMLElement} */
  const app = document.getElementById('app');

  function init() {
    // Application initialization
    console.log('rangoli-royale initialized');
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
