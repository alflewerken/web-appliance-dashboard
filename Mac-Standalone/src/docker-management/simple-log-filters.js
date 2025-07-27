// Simple Log Filter Extension for Docker Management
(function() {
    'use strict';
    
    // Wait for DOM
    function initLogFilters() {
        console.log('Initializing log filters...');
        
        const containerLogs = document.querySelector('.container-logs, .section:has(#logsOutput)');
        if (!containerLogs) {
            console.log('Container logs section not found, retrying...');
            setTimeout(initLogFilters, 500);
            return;
        }
        
        // Check if already initialized
        if (document.querySelector('.log-filter-controls')) {
            console.log('Log filters already initialized');
            return;
        }
        
        // Find the h2 element
        const h2 = containerLogs.querySelector('h2');
        if (!h2) {
            console.log('H2 not found in container logs');
            return;
        }
        
        // Create filter controls
        const filterControls = document.createElement('div');
        filterControls.className = 'log-filter-controls';
        filterControls.style.cssText = `
            display: flex;
            gap: 1rem;
            margin: 1rem 0;
            padding: 1rem;
            background: rgba(255,255,255,0.05);
            border-radius: 8px;
            border: 1px solid rgba(255,255,255,0.1);
            align-items: center;
            flex-wrap: wrap;
        `;
        
        filterControls.innerHTML = `
            <div style="display: flex; gap: 0.75rem; align-items: center;">
                <span style="color: #a0a0a0; font-size: 0.875rem;">Filter:</span>
                <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                    <input type="checkbox" id="filterNote" checked style="cursor: pointer;">
                    <span style="display: inline-block; width: 8px; height: 8px; background: #4ecdc4; border-radius: 50%;"></span>
                    <span style="color: #e0e0e0; font-size: 0.875rem;">Note</span>
                </label>
                <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                    <input type="checkbox" id="filterWarning" checked style="cursor: pointer;">
                    <span style="display: inline-block; width: 8px; height: 8px; background: #ff9800; border-radius: 50%;"></span>
                    <span style="color: #e0e0e0; font-size: 0.875rem;">Warning</span>
                </label>
                <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                    <input type="checkbox" id="filterError" checked style="cursor: pointer;">
                    <span style="display: inline-block; width: 8px; height: 8px; background: #f44336; border-radius: 50%;"></span>
                    <span style="color: #e0e0e0; font-size: 0.875rem;">Error</span>
                </label>
            </div>
            <div style="display: flex; gap: 0.75rem; align-items: center; margin-left: auto;">
                <button id="saveLogsBtn" class="btn btn-secondary" style="padding: 0.5rem 1rem; font-size: 0.875rem;">
                    💾 Log speichern
                </button>
                <span style="color: #4ecdc4; font-size: 0.75rem;">
                    Auto-Refresh: <span id="refreshCountdown">5</span>s
                </span>
            </div>
        `;
        
        // Insert after h2
        h2.parentNode.insertBefore(filterControls, h2.nextSibling);
        
        // Add line limit info to logs output
        const logsOutput = document.getElementById('logsOutput');
        if (logsOutput) {
            // Add wrapper div for stats
            const statsDiv = document.createElement('div');
            statsDiv.style.cssText = `
                padding: 0.5rem 1rem;
                background: rgba(255,255,255,0.05);
                border-top: 1px solid rgba(255,255,255,0.1);
                font-size: 0.75rem;
                color: #a0a0a0;
                display: flex;
                gap: 1rem;
            `;
            statsDiv.innerHTML = `
                <span>Max. 500 Zeilen</span>
                <span id="logStats">0 Zeilen geladen</span>
            `;
            
            logsOutput.parentNode.appendChild(statsDiv);
            
            // Setup auto-refresh
            setupAutoRefresh(logsOutput);
            
            // Setup filters
            setupFilters(logsOutput);
            
            // Setup save functionality
            setupSaveButton(logsOutput);
        }
        
        console.log('Log filters initialized successfully');
    }
    
    function setupAutoRefresh(logsOutput) {
        let countdown = 5;
        const countdownEl = document.getElementById('refreshCountdown');
        const refreshBtn = document.getElementById('refreshLogsBtn');
        
        setInterval(() => {
            countdown--;
            if (countdownEl) {
                countdownEl.textContent = countdown;
            }
            
            if (countdown <= 0) {
                countdown = 5;
                // Trigger refresh by clicking the button
                if (refreshBtn) {
                    refreshBtn.click();
                }
            }
        }, 1000);
        
        // Enhance logs processing when they update
        const observer = new MutationObserver(() => {
            processLogs(logsOutput);
        });
        
        observer.observe(logsOutput, {
            childList: true,
            characterData: true,
            subtree: true
        });
    }
    
    function processLogs(logsOutput) {
        const text = logsOutput.textContent || '';
        const lines = text.split('\n').filter(line => line.trim());
        
        // Limit to 500 lines
        if (lines.length > 500) {
            const limitedLines = lines.slice(-500);
            logsOutput.textContent = limitedLines.join('\n');
        }
        
        // Update stats
        const statsEl = document.getElementById('logStats');
        if (statsEl) {
            statsEl.textContent = `${Math.min(lines.length, 500)} Zeilen geladen`;
        }
        
        // Apply coloring
        const htmlContent = lines.map(line => {
            let className = 'log-line';
            const lowerLine = line.toLowerCase();
            
            if (lowerLine.includes('error') || lowerLine.includes('fail')) {
                className += ' error';
                return `<span style="color: #f44336;">${escapeHtml(line)}</span>`;
            } else if (lowerLine.includes('warn')) {
                className += ' warning';
                return `<span style="color: #ff9800;">${escapeHtml(line)}</span>`;
            } else if (lowerLine.includes('info') || lowerLine.includes('note')) {
                className += ' note';
                return `<span style="color: #4ecdc4;">${escapeHtml(line)}</span>`;
            }
            
            return escapeHtml(line);
        }).join('\n');
        
        logsOutput.innerHTML = `<pre style="margin: 0; font-family: inherit;">${htmlContent}</pre>`;
        
        // Scroll to bottom
        logsOutput.scrollTop = logsOutput.scrollHeight;
    }
    
    function setupFilters(logsOutput) {
        const filters = {
            note: document.getElementById('filterNote'),
            warning: document.getElementById('filterWarning'),
            error: document.getElementById('filterError')
        };
        
        Object.entries(filters).forEach(([type, checkbox]) => {
            if (checkbox) {
                checkbox.addEventListener('change', () => {
                    applyFilters(logsOutput, filters);
                });
            }
        });
    }
    
    function applyFilters(logsOutput, filters) {
        const lines = logsOutput.querySelectorAll('span');
        
        lines.forEach(line => {
            const text = line.textContent.toLowerCase();
            let shouldShow = true;
            
            if (text.includes('error') || text.includes('fail')) {
                shouldShow = filters.error.checked;
            } else if (text.includes('warn')) {
                shouldShow = filters.warning.checked;
            } else if (text.includes('info') || text.includes('note')) {
                shouldShow = filters.note.checked;
            }
            
            line.style.display = shouldShow ? '' : 'none';
        });
    }
    
    function setupSaveButton(logsOutput) {
        const saveBtn = document.getElementById('saveLogsBtn');
        if (!saveBtn) return;
        
        saveBtn.addEventListener('click', () => {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const filename = `docker-logs-${timestamp}.txt`;
            const content = logsOutput.textContent || 'Keine Logs vorhanden';
            
            // Create download
            const blob = new Blob([content], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            a.click();
            URL.revokeObjectURL(url);
            
            // Visual feedback
            const originalText = saveBtn.textContent;
            saveBtn.textContent = '✅ Gespeichert!';
            saveBtn.style.background = '#4caf50';
            
            setTimeout(() => {
                saveBtn.textContent = originalText;
                saveBtn.style.background = '';
            }, 2000);
        });
    }
    
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initLogFilters);
    } else {
        initLogFilters();
    }
})();
