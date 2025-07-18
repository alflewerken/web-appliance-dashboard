// Enhanced Log Manager for Docker Management
class DockerLogManager {
    constructor() {
        this.maxLines = 500;
        this.refreshInterval = 5000; // 5 seconds
        this.autoRefreshTimer = null;
        this.countdown = null;
        this.logs = [];
        this.filters = {
            note: true,
            warning: true,
            error: true
        };
        this.searchTerm = '';
        this.initialized = false;
        
        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.init());
        } else {
            this.init();
        }
    }

    init() {
        // Check if we're on the Docker Management page
        const logsOutput = document.getElementById('logsOutput');
        if (!logsOutput) {
            console.log('DockerLogManager: Not on Docker Management page, skipping initialization');
            return;
        }
        
        console.log('DockerLogManager: Initializing...');
        this.setupUI();
        this.initialized = true;
    }

    setupUI() {
        console.log('DockerLogManager: Setting up UI...');
        
        // Find the log controls container
        const logControls = document.querySelector('.log-controls');
        if (!logControls) {
            console.error('DockerLogManager: .log-controls not found');
            return;
        }

        // Check if filter section already exists
        if (document.querySelector('.log-filter-section')) {
            console.log('DockerLogManager: Filter section already exists');
            return;
        }

        // Create filter section
        const filterSection = document.createElement('div');
        filterSection.className = 'log-filter-section';
        filterSection.innerHTML = `
            <div class="log-search">
                <input type="text" id="logSearchInput" placeholder="Suche in Logs...">
                <svg class="log-search-icon" viewBox="0 0 24 24">
                    <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
                </svg>
            </div>
            <div class="log-filters">
                <label class="filter-toggle note active">
                    <input type="checkbox" id="filterNote" checked>
                    <span class="filter-indicator"></span>
                    <span>Note</span>
                </label>
                <label class="filter-toggle warning active">
                    <input type="checkbox" id="filterWarning" checked>
                    <span class="filter-indicator"></span>
                    <span>Warning</span>
                </label>
                <label class="filter-toggle error active">
                    <input type="checkbox" id="filterError" checked>
                    <span class="filter-indicator"></span>
                    <span>Error</span>
                </label>
            </div>
            <button id="saveLogsBtn" class="docker-btn btn-save">
                <svg viewBox="0 0 16 16" width="16" height="16">
                    <path d="M3 1.5A1.5 1.5 0 0 1 4.5 0h8A1.5 1.5 0 0 1 14 1.5v13a1.5 1.5 0 0 1-1.5 1.5h-8A1.5 1.5 0 0 1 3 14.5v-13zM4.5 1A.5.5 0 0 0 4 1.5v13a.5.5 0 0 0 .5.5h8a.5.5 0 0 0 .5-.5v-13a.5.5 0 0 0-.5-.5h-8z"/>
                    <path d="M7.646 8.354a.5.5 0 0 0 .708 0l2-2a.5.5 0 0 0-.708-.708L8 7.293 6.354 5.646a.5.5 0 1 0-.708.708l2 2z"/>
                    <path d="M8 1a.5.5 0 0 1 .5.5v7a.5.5 0 0 1-1 0v-7A.5.5 0 0 1 8 1z"/>
                </svg>
                Log speichern
            </button>
            <button id="clearLogsBtn" class="docker-btn btn-clear">
                <svg viewBox="0 0 16 16" width="16" height="16">
                    <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/>
                    <path d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/>
                </svg>
            </button>
            <div class="auto-refresh-indicator">
                <div class="refresh-spinner"></div>
                <span>Auto-Refresh: <span class="refresh-countdown">5</span>s</span>
            </div>
        `;

        // Insert filter section after log controls
        logControls.parentNode.insertBefore(filterSection, logControls.nextSibling);
        
        console.log('DockerLogManager: Filter section inserted');

        // Setup event listeners
        this.setupEventListeners();

        // Enhance log output wrapper
        const logsOutput = document.getElementById('logsOutput');
        if (logsOutput) {
            const wrapper = document.createElement('div');
            wrapper.className = 'logs-output-wrapper';
            logsOutput.parentNode.insertBefore(wrapper, logsOutput);
            wrapper.appendChild(logsOutput);

            // Add stats bar
            const statsBar = document.createElement('div');
            statsBar.className = 'log-stats';
            statsBar.innerHTML = `
                <div class="log-stat total">
                    <span class="log-stat-dot"></span>
                    <span>Total: <span id="totalLines">0</span></span>
                </div>
                <div class="log-stat notes">
                    <span class="log-stat-dot"></span>
                    <span>Notes: <span id="noteCount">0</span></span>
                </div>
                <div class="log-stat warnings">
                    <span class="log-stat-dot"></span>
                    <span>Warnings: <span id="warningCount">0</span></span>
                </div>
                <div class="log-stat errors">
                    <span class="log-stat-dot"></span>
                    <span>Errors: <span id="errorCount">0</span></span>
                </div>
            `;
            wrapper.appendChild(statsBar);
        }

        // Start auto-refresh
        this.startAutoRefresh();
    }

    setupEventListeners() {
        // Filter toggles
        document.getElementById('filterNote')?.addEventListener('change', (e) => {
            this.filters.note = e.target.checked;
            e.target.parentElement.classList.toggle('active', e.target.checked);
            this.applyFilters();
        });

        document.getElementById('filterWarning')?.addEventListener('change', (e) => {
            this.filters.warning = e.target.checked;
            e.target.parentElement.classList.toggle('active', e.target.checked);
            this.applyFilters();
        });

        document.getElementById('filterError')?.addEventListener('change', (e) => {
            this.filters.error = e.target.checked;
            e.target.parentElement.classList.toggle('active', e.target.checked);
            this.applyFilters();
        });

        // Search
        document.getElementById('logSearchInput')?.addEventListener('input', (e) => {
            this.searchTerm = e.target.value.toLowerCase();
            this.applyFilters();
        });

        // Save logs
        document.getElementById('saveLogsBtn')?.addEventListener('click', () => {
            this.saveLogs();
        });

        // Clear logs
        document.getElementById('clearLogsBtn')?.addEventListener('click', () => {
            this.clearLogs();
        });

        // Override the existing refresh button functionality
        const refreshBtn = document.getElementById('refreshLogsBtn');
        if (refreshBtn) {
            // Remove all existing event listeners by cloning the node
            const newRefreshBtn = refreshBtn.cloneNode(true);
            refreshBtn.parentNode.replaceChild(newRefreshBtn, refreshBtn);
            
            // Add our enhanced refresh functionality
            newRefreshBtn.addEventListener('click', (e) => {
                e.preventDefault();
                console.log('DockerLogManager: Manual refresh triggered');
                this.refreshLogs();
            });
        }
    }

    startAutoRefresh() {
        this.stopAutoRefresh(); // Clear any existing timer
        
        let countdown = this.refreshInterval / 1000;
        const countdownEl = document.querySelector('.refresh-countdown');
        
        this.countdown = setInterval(() => {
            countdown--;
            if (countdownEl) {
                countdownEl.textContent = countdown;
            }
            if (countdown <= 0) {
                countdown = this.refreshInterval / 1000;
                this.refreshLogs();
            }
        }, 1000);

        this.autoRefreshTimer = setInterval(() => {
            this.refreshLogs();
        }, this.refreshInterval);
    }

    stopAutoRefresh() {
        if (this.autoRefreshTimer) {
            clearInterval(this.autoRefreshTimer);
            this.autoRefreshTimer = null;
        }
        if (this.countdown) {
            clearInterval(this.countdown);
            this.countdown = null;
        }
    }

    async refreshLogs() {
        const logsOutput = document.getElementById('logsOutput');
        if (!logsOutput) return;

        // Show loading overlay
        const loadingOverlay = document.createElement('div');
        loadingOverlay.className = 'logs-loading-overlay';
        loadingOverlay.innerHTML = '<div class="spinner"></div>';
        logsOutput.parentElement.appendChild(loadingOverlay);

        try {
            // Get selected service
            const service = document.getElementById('logService')?.value || '';
            
            // Fetch logs via Electron API
            const result = await window.electronAPI.docker.getLogs(service);
            
            if (result.logs) {
                this.processLogs(result.logs);
                this.displayLogs();
            } else if (result.error) {
                logsOutput.innerHTML = `<div class="error-message">${result.error}</div>`;
            }
        } catch (error) {
            console.error('Error fetching logs:', error);
            logsOutput.innerHTML = `<div class="error-message">Fehler beim Abrufen der Logs</div>`;
        } finally {
            // Remove loading overlay
            loadingOverlay?.remove();
        }
    }

    processLogs(rawLogs) {
        // Split logs into lines and limit to maxLines
        const lines = rawLogs.split('\n').filter(line => line.trim());
        const startIndex = Math.max(0, lines.length - this.maxLines);
        
        this.logs = lines.slice(startIndex).map(line => {
            // Detect log level
            let level = 'info';
            const lowerLine = line.toLowerCase();
            
            if (lowerLine.includes('error') || lowerLine.includes('fatal') || 
                lowerLine.includes('fail') || lowerLine.includes('exception')) {
                level = 'error';
            } else if (lowerLine.includes('warn') || lowerLine.includes('warning')) {
                level = 'warning';
            } else if (lowerLine.includes('note') || lowerLine.includes('info') || 
                       lowerLine.includes('notice')) {
                level = 'note';
            }
            
            return {
                text: line,
                level: level,
                timestamp: new Date()
            };
        });
    }

    displayLogs() {
        const logsOutput = document.getElementById('logsOutput');
        if (!logsOutput) return;

        // Clear current content
        logsOutput.innerHTML = '';
        
        let stats = {
            total: 0,
            note: 0,
            warning: 0,
            error: 0
        };

        const filteredLogs = this.logs.filter(log => {
            // Apply level filter
            if (log.level === 'error' && !this.filters.error) return false;
            if (log.level === 'warning' && !this.filters.warning) return false;
            if (log.level === 'note' && !this.filters.note) return false;
            
            // Apply search filter
            if (this.searchTerm && !log.text.toLowerCase().includes(this.searchTerm)) {
                return false;
            }
            
            return true;
        });

        if (filteredLogs.length === 0) {
            logsOutput.innerHTML = '<div class="no-logs-message">Keine Logs gefunden</div>';
        } else {
            filteredLogs.forEach(log => {
                const lineEl = document.createElement('div');
                lineEl.className = `log-line ${log.level}`;
                
                // Highlight search term
                if (this.searchTerm) {
                    const regex = new RegExp(`(${this.searchTerm})`, 'gi');
                    lineEl.innerHTML = log.text.replace(regex, '<mark>$1</mark>');
                } else {
                    lineEl.textContent = log.text;
                }
                
                logsOutput.appendChild(lineEl);
                
                // Update stats
                stats.total++;
                stats[log.level]++;
            });
            
            // Scroll to bottom
            logsOutput.scrollTop = logsOutput.scrollHeight;
        }

        // Update stats display
        this.updateStats(stats);
    }

    applyFilters() {
        this.displayLogs();
    }

    updateStats(stats) {
        document.getElementById('totalLines')?.textContent = stats.total;
        document.getElementById('noteCount')?.textContent = stats.note;
        document.getElementById('warningCount')?.textContent = stats.warning;
        document.getElementById('errorCount')?.textContent = stats.error;
    }

    saveLogs() {
        const logsOutput = document.getElementById('logsOutput');
        if (!logsOutput) return;

        const saveBtn = document.getElementById('saveLogsBtn');
        
        // Create log content
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `docker-logs-${timestamp}.txt`;
        
        let content = `Docker Management Logs - ${new Date().toLocaleString()}\n`;
        content += '='.repeat(80) + '\n\n';
        
        // Add visible logs
        const visibleLogs = logsOutput.querySelectorAll('.log-line:not(.hidden)');
        visibleLogs.forEach(line => {
            content += line.textContent + '\n';
        });
        
        // Create download link
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
        
        // Show success feedback
        saveBtn.classList.add('saved');
        saveBtn.innerHTML = `
            <svg viewBox="0 0 16 16" width="16" height="16">
                <path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z"/>
            </svg>
            Gespeichert!
        `;
        
        setTimeout(() => {
            saveBtn.classList.remove('saved');
            saveBtn.innerHTML = `
                <svg viewBox="0 0 16 16" width="16" height="16">
                    <path d="M3 1.5A1.5 1.5 0 0 1 4.5 0h8A1.5 1.5 0 0 1 14 1.5v13a1.5 1.5 0 0 1-1.5 1.5h-8A1.5 1.5 0 0 1 3 14.5v-13zM4.5 1A.5.5 0 0 0 4 1.5v13a.5.5 0 0 0 .5.5h8a.5.5 0 0 0 .5-.5v-13a.5.5 0 0 0-.5-.5h-8z"/>
                    <path d="M7.646 8.354a.5.5 0 0 0 .708 0l2-2a.5.5 0 0 0-.708-.708L8 7.293 6.354 5.646a.5.5 0 1 0-.708.708l2 2z"/>
                    <path d="M8 1a.5.5 0 0 1 .5.5v7a.5.5 0 0 1-1 0v-7A.5.5 0 0 1 8 1z"/>
                </svg>
                Log speichern
            `;
        }, 2000);
    }

    clearLogs() {
        const logsOutput = document.getElementById('logsOutput');
        if (!logsOutput) {
            return;
        }
        
        if (confirm('Möchten Sie die angezeigten Logs wirklich löschen?')) {
            this.logs = [];
            logsOutput.innerHTML = '<div class="no-logs-message">Logs wurden gelöscht</div>';
            this.updateStats({ total: 0, note: 0, warning: 0, error: 0 });
        }
    }
}

// Initialize log manager when DOM is ready
const dockerLogManager = new DockerLogManager();

// Export for use in other scripts
window.DockerLogManager = DockerLogManager;
