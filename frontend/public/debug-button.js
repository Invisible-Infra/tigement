// Standalone debug button - survives React crashes
(function() {
  'use strict';
  
  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDebugButton);
  } else {
    initDebugButton();
  }
  
  function initDebugButton() {
    // Fetch debug settings from server
    fetch('/api/announcements/debug-settings')
      .then(res => res.json())
      .then(data => {
        if (!data.debug_button_enabled) {
          console.log('Debug button disabled by admin');
          return; // Don't create button
        }
        
        createDebugButton();
      })
      .catch(err => {
        // Fail safe: don't show button if can't fetch setting
        console.error('Failed to fetch debug settings:', err);
      });
  }
  
  function createDebugButton() {
    // Create button
    const button = document.createElement('div');
    button.id = 'tigement-debug-button';
    button.textContent = 'DEBUG';
    button.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      z-index: 999999;
      background: #ef4444;
      color: white;
      padding: 12px 16px;
      border-radius: 8px;
      cursor: pointer;
      font-size: 14px;
      font-weight: bold;
      box-shadow: 0 4px 6px rgba(0,0,0,0.3);
      user-select: none;
      font-family: system-ui, -apple-system, sans-serif;
    `;
    
    // Click handler - export logs
    button.addEventListener('click', function() {
      try {
        const logsStr = localStorage.getItem('tigement_debug_logs');
        if (!logsStr) {
          alert('No debug logs captured yet');
          return;
        }
        
        const logs = JSON.parse(logsStr);
        const formatted = logs.map(log => 
          `[${log.timestamp}] [${log.level.toUpperCase()}] ${log.message}${log.stack ? '\n' + log.stack : ''}`
        ).join('\n\n');
        
        if (formatted.length === 0) {
          alert('No debug logs captured yet');
          return;
        }
        
        // Try to download
        try {
          const blob = new Blob([formatted], { type: 'text/plain' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'tigement-debug-' + Date.now() + '.txt';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          alert('Debug logs exported! Check your downloads.');
        } catch (e) {
          // Fallback: show in alert
          alert('Logs (first 2000 chars):\n\n' + formatted.slice(0, 2000));
        }
      } catch (e) {
        alert('Error exporting logs: ' + e.message);
      }
    });
    
    // Right-click handler - clear logs
    button.addEventListener('contextmenu', function(e) {
      e.preventDefault();
      try {
        localStorage.removeItem('tigement_debug_logs');
        alert('Debug logs cleared!');
      } catch (e) {
        alert('Error clearing logs: ' + e.message);
      }
    });
    
    // Add to body
    document.body.appendChild(button);
    
    console.log('Debug button initialized (standalone)');
  }
})();
