document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '../index.html';
        return;
    }

    // --- Page Elements ---
    const createAutomationBtn = document.getElementById('create-automation-btn');
    const automationsTbody = document.getElementById('automations-tbody');

    // --- Modal Elements ---
    const modal = document.getElementById('automation-modal');
    const closeModalBtn = modal.querySelector('.close-btn');
    const modalTitle = document.getElementById('modal-title');
    const automationForm = document.getElementById('automation-form');
    const automationId = document.getElementById('automation-id');
    const automationName = document.getElementById('automation-name');
    const automationGroup = document.getElementById('automation-group');
    const automationDescription = document.getElementById('automation-description');
    const automationLanguage = document.getElementById('automation-language');
    const automationScript = document.getElementById('automation-script');

    // --- Source Type Elements ---
    const sourceTypeBtns = document.querySelectorAll('.source-btn');
    const inlineConfigPanel = document.getElementById('inline-config-panel');
    const githubConfigPanel = document.getElementById('github-config-panel');
    const githubRepo = document.getElementById('github-repo');
    const githubBranch = document.getElementById('github-branch');
    const githubFolder = document.getElementById('github-folder');
    const githubPath = document.getElementById('github-path');
    const githubToken = document.getElementById('github-token');
    const fetchStatus = document.getElementById('fetch-status');
    const branchSelectGroup = document.getElementById('branch-select-group');
    const folderSelectGroup = document.getElementById('folder-select-group');
    const scriptSelectGroup = document.getElementById('script-select-group');
    const addEnvVarBtn = document.getElementById('add-env-var');
    const envVarsContainer = document.getElementById('env-vars-container');

    let currentSourceType = 'inline';
    let fetchTimeout = null;
    let allScripts = []; // Store all scripts with their paths

    // --- Event Listeners ---
    createAutomationBtn.addEventListener('click', () => openModalForCreate());
    closeModalBtn.addEventListener('click', () => closeModal());
    window.addEventListener('click', (event) => {
        if (event.target == modal) {
            closeModal();
        }
    });

    automationForm.addEventListener('submit', (event) => {
        event.preventDefault();
        saveAutomation();
    });

    // Source type switcher
    sourceTypeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            sourceTypeBtns.forEach(b => {
                b.classList.remove('active');
            });
            btn.classList.add('active');
            
            currentSourceType = btn.dataset.source;
            
            if (currentSourceType === 'inline') {
                inlineConfigPanel.style.display = 'block';
                githubConfigPanel.style.display = 'none';
            } else {
                inlineConfigPanel.style.display = 'none';
                githubConfigPanel.style.display = 'block';
                
                // Auto-fetch if URL already exists
                const repoUrl = githubRepo.value.trim();
                if (repoUrl && branchSelectGroup.style.display === 'none') {
                    setTimeout(() => autoFetchRepository(), 500);
                }
            }
        });
    });

    // Auto-fetch GitHub branches when repository URL is entered
    githubRepo.addEventListener('input', () => {
        // Clear previous timeout
        if (fetchTimeout) {
            clearTimeout(fetchTimeout);
        }
        
        // Hide all dropdowns
        branchSelectGroup.style.display = 'none';
        folderSelectGroup.style.display = 'none';
        scriptSelectGroup.style.display = 'none';
        
        const repo = githubRepo.value.trim();
        
        if (!repo) {
            fetchStatus.innerHTML = '';
            return;
        }
        
        // Show waiting message
        fetchStatus.innerHTML = '<span style="color: #888;">⏳ Waiting for input...</span>';
        
        // Debounce: wait 1 second after user stops typing
        fetchTimeout = setTimeout(async () => {
            await autoFetchRepository();
        }, 1000);
    });
    
    // Auto-fetch function
    async function autoFetchRepository() {
        const repo = githubRepo.value.trim();
        const authToken = githubToken.value.trim();

        if (!repo) {
            fetchStatus.innerHTML = '';
            return;
        }

        fetchStatus.innerHTML = '<span style="color: #2196F3;">🔄 Fetching repository data...</span>';
        branchSelectGroup.style.display = 'none';
        folderSelectGroup.style.display = 'none';
        scriptSelectGroup.style.display = 'none';

        try {
            // Fetch branches
            const branchesResponse = await fetchGitHubBranches(repo, authToken);
            
            if (branchesResponse.success) {
                // Populate branches dropdown
                githubBranch.innerHTML = '<option value="">Select a branch...</option>';
                branchesResponse.data.forEach(branch => {
                    const option = document.createElement('option');
                    option.value = branch.name;
                    option.textContent = branch.name;
                    githubBranch.appendChild(option);
                });
                branchSelectGroup.style.display = 'block';
                
                // Set default branch if main or master exists
                const defaultBranch = branchesResponse.data.find(b => b.name === 'main' || b.name === 'master');
                if (defaultBranch) {
                    githubBranch.value = defaultBranch.name;
                    // Automatically fetch folders for default branch
                    await fetchFoldersAndScriptsForBranch(repo, defaultBranch.name, authToken);
                }
                
                fetchStatus.innerHTML = '<span style="color: #4CAF50;">✅ Repository connected successfully!</span>';
            } else {
                fetchStatus.innerHTML = `<span style="color: #f44336;">❌ ${branchesResponse.message}</span>`;
            }
        } catch (error) {
            fetchStatus.innerHTML = `<span style="color: #f44336;">❌ ${error.message}</span>`;
        }
    }

    // Fetch folders and scripts when branch is selected
    githubBranch.addEventListener('change', async () => {
        const repo = githubRepo.value.trim();
        const branch = githubBranch.value;
        const authToken = githubToken.value.trim();

        if (branch) {
            await fetchFoldersAndScriptsForBranch(repo, branch, authToken);
        } else {
            folderSelectGroup.style.display = 'none';
            scriptSelectGroup.style.display = 'none';
        }
    });
    
    // Filter scripts when folder is selected
    githubFolder.addEventListener('change', () => {
        const selectedFolder = githubFolder.value;
        
        if (!selectedFolder) {
            scriptSelectGroup.style.display = 'none';
            return;
        }
        
        // Filter scripts by selected top-level folder (including all subfolders)
        const folderScripts = allScripts.filter(script => {
            // Check if script path starts with the selected folder
            return script.path.startsWith(selectedFolder + '/');
        });
        
        // Populate scripts dropdown with full path for clarity
        githubPath.innerHTML = '<option value="">Select a script...</option>';
        folderScripts.forEach(script => {
            const option = document.createElement('option');
            option.value = script.path;
            // Show relative path from selected folder (e.g., "Source/excel_export.py")
            const relativePath = script.path.substring(selectedFolder.length + 1);
            option.textContent = relativePath;
            githubPath.appendChild(option);
        });
        
        if (folderScripts.length > 0) {
            scriptSelectGroup.style.display = 'block';
        } else {
            scriptSelectGroup.style.display = 'none';
        }
    });

    async function fetchGitHubBranches(repo, authToken) {
        const apiToken = localStorage.getItem('token');
        const response = await fetch('/api/automations/github/branches', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiToken}`
            },
            body: JSON.stringify({ repo, token: authToken || null })
        });
        return await response.json();
    }

    async function fetchFoldersAndScriptsForBranch(repo, branch, authToken) {
        fetchStatus.innerHTML = '<span style="color: #2196F3;">🔄 Loading folders and scripts...</span>';
        folderSelectGroup.style.display = 'none';
        scriptSelectGroup.style.display = 'none';

        try {
            const apiToken = localStorage.getItem('token');
            const response = await fetch('/api/automations/github/scripts', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiToken}`
                },
                body: JSON.stringify({ repo, branch, token: authToken || null })
            });

            const result = await response.json();

            if (result.success) {
                // Store all scripts globally
                allScripts = result.data;
                
                // Extract unique TOP-LEVEL folders only (no subfolders)
                const folders = new Set();
                const rootScripts = [];
                
                result.data.forEach(file => {
                    const pathParts = file.path.split('/');
                    if (pathParts.length > 1) {
                        // File is in a folder
                        folders.add(pathParts[0]);
                    } else {
                        // File is in root
                        rootScripts.push(file);
                    }
                });
                
                // Case 1: Repository has folders
                if (folders.size > 0) {
                    // Populate folder dropdown
                    githubFolder.innerHTML = '<option value="">Select a folder...</option>';
                    Array.from(folders).sort().forEach(folder => {
                        const option = document.createElement('option');
                        option.value = folder;
                        option.textContent = folder;
                        githubFolder.appendChild(option);
                    });
                    
                    folderSelectGroup.style.display = 'block';
                    scriptSelectGroup.style.display = 'none';
                    fetchStatus.innerHTML = '<span style="color: #4CAF50;">✅ Folders loaded! Select a folder to see scripts.</span>';
                }
                // Case 2: Repository has only root-level scripts (no folders)
                else if (rootScripts.length > 0) {
                    // Skip folder selection, directly show scripts
                    folderSelectGroup.style.display = 'none';
                    
                    githubPath.innerHTML = '<option value="">Select a script...</option>';
                    rootScripts.forEach(script => {
                        const option = document.createElement('option');
                        option.value = script.path;
                        option.textContent = script.path;
                        githubPath.appendChild(option);
                    });
                    
                    scriptSelectGroup.style.display = 'block';
                    fetchStatus.innerHTML = '<span style="color: #4CAF50;">✅ Scripts loaded!</span>';
                }
                // Case 3: No Python scripts found
                else {
                    folderSelectGroup.style.display = 'none';
                    scriptSelectGroup.style.display = 'none';
                    fetchStatus.innerHTML = '<span style="color: #f44336;">❌ No Python scripts found in this branch</span>';
                }
            } else {
                fetchStatus.innerHTML = `<span style="color: #f44336;">❌ ${result.message}</span>`;
            }
        } catch (error) {
            fetchStatus.innerHTML = `<span style="color: #f44336;">❌ ${error.message}</span>`;
        }
    }

    // Add environment variable row
    addEnvVarBtn.addEventListener('click', () => {
        addEnvVarRow();
    });

    function addEnvVarRow(key = '', value = '') {
        const row = document.createElement('div');
        row.className = 'env-var-row';
        row.style.cssText = 'display: flex; gap: 10px; margin-bottom: 8px;';
        row.innerHTML = `
            <input type="text" class="env-key" placeholder="KEY" value="${key}" 
                   style="flex: 1; padding: 8px; background: #333; border: 1px solid #555; color: white; border-radius: 4px;">
            <input type="text" class="env-value" placeholder="VALUE" value="${value}"
                   style="flex: 2; padding: 8px; background: #333; border: 1px solid #555; color: white; border-radius: 4px;">
            <button type="button" class="btn-remove-env" 
                    style="padding: 8px 12px; background: #f44336; color: white; border: none; border-radius: 4px; cursor: pointer;">
                ✖
            </button>
        `;
        envVarsContainer.appendChild(row);

        row.querySelector('.btn-remove-env').addEventListener('click', () => {
            row.remove();
        });
    }

    // --- Core Functions ---
    async function fetchAutomations() {
        try {
            const response = await fetch('/api/automations', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                const automations = await response.json();
                renderAutomations(automations);
            } else {
                console.error('Failed to fetch automations');
            }
        } catch (error) {
            console.error('Error fetching automations:', error);
        }
    }

    function renderAutomations(automations) {
        automationsTbody.innerHTML = '';
        if (automations.length === 0) {
            automationsTbody.innerHTML = '<tr><td colspan="7" style="text-align:center;">No automations configured yet.</td></tr>';
            return;
        }

        automations.forEach(automation => {
            const row = document.createElement('tr');
            row.dataset.automationId = automation.id;
            const lastRun = automation.lastRun ? new Date(automation.lastRun).toLocaleString() : 'N/A';
            const status = automation.status || 'N/A';
            
            // Source badge
            const sourceType = automation.sourceType || 'inline';
            const githubIcon = '<svg width="14" height="14" viewBox="0 0 16 16" fill="white" style="vertical-align: middle; margin-right: 4px;"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"></path></svg>';
            const sourceBadge = sourceType === 'github' 
                ? `<span style="background: #2196F3; padding: 4px 8px; border-radius: 4px; font-size: 12px; display: inline-flex; align-items: center;">${githubIcon} GitHub</span>`
                : '<span style="background: #4CAF50; padding: 4px 8px; border-radius: 4px; font-size: 12px;">📝 Inline</span>';
            
            // Source info
            let sourceInfo = automation.name;
            if (sourceType === 'github' && automation.githubRepo) {
                sourceInfo += `<br><small style="color: #888;">${automation.githubRepo}:${automation.githubBranch || 'main'}</small>`;
            }

            // Actions buttons - add sync for GitHub (using Font Awesome icons like synthetic monitoring)
            let actionButtons = `
                <button class="action-btn view-btn" data-id="${automation.id}" title="View Last Run"><i class="fas fa-eye"></i></button>
                <button class="action-btn run-btn" data-id="${automation.id}" title="Run"><i class="fas fa-play"></i></button>
                ${sourceType === 'github' ? `<button class="action-btn sync-btn" data-id="${automation.id}" title="Sync with GitHub"><i class="fas fa-sync"></i></button>` : ''}
                <button class="action-btn edit-btn" data-id="${automation.id}" title="Edit"><i class="fas fa-edit"></i></button>
                <button class="action-btn delete-btn" data-id="${automation.id}" title="Delete"><i class="fas fa-trash"></i></button>
            `;

            row.innerHTML = `
                <td><span class="status-indicator status-${status.toLowerCase()}"></span></td>
                <td>${sourceBadge}</td>
                <td>${sourceInfo}</td>
                <td>${automation.group || '-'}</td>
                <td>${lastRun}</td>
                <td>${actionButtons}</td>
                <td>
                    <button class="action-btn download-json-btn" data-id="${automation.id}">JSON</button>
                    <button class="action-btn download-excel-btn" data-id="${automation.id}">Excel</button>
                </td>
            `;
            automationsTbody.appendChild(row);

            row.addEventListener('click', (e) => {
                if (e.target.closest('.action-btn')) return;
                toggleOutput(automation.id);
            });
        });

        document.querySelectorAll('.view-btn').forEach(btn => btn.addEventListener('click', (e) => {
            e.stopPropagation();
            viewAutomationOutput(e.target.closest('.view-btn').dataset.id);
        }));
        document.querySelectorAll('.run-btn').forEach(btn => btn.addEventListener('click', (e) => {
            e.stopPropagation();
            runAutomation(e.target.closest('.run-btn').dataset.id);
        }));
        document.querySelectorAll('.sync-btn').forEach(btn => btn.addEventListener('click', (e) => {
            e.stopPropagation();
            syncGitHubAutomation(e.target.closest('.sync-btn').dataset.id);
        }));
        document.querySelectorAll('.download-json-btn').forEach(btn => btn.addEventListener('click', (e) => {
            e.stopPropagation();
            downloadJSON(e.target.closest('.download-json-btn').dataset.id);
        }));
        document.querySelectorAll('.download-excel-btn').forEach(btn => btn.addEventListener('click', (e) => {
            e.stopPropagation();
            downloadExcel(e.target.closest('.download-excel-btn').dataset.id);
        }));
        document.querySelectorAll('.edit-btn').forEach(btn => btn.addEventListener('click', (e) => {
            e.stopPropagation();
            openModalForEdit(e.target.closest('.edit-btn').dataset.id);
        }));
        document.querySelectorAll('.delete-btn').forEach(btn => btn.addEventListener('click', (e) => {
            e.stopPropagation();
            deleteAutomation(e.target.closest('.delete-btn').dataset.id);
        }));
    }

    async function syncGitHubAutomation(id) {
        if (!confirm('Sync this automation with the latest GitHub commit?')) return;
        
        try {
            const response = await fetch(`/api/automations/${id}/sync`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            const result = await response.json();
            
            if (result.success) {
                alert(`✅ Synced successfully!\nCommit: ${result.commit.message}\nAuthor: ${result.commit.author}`);
                fetchAutomations();
            } else {
                alert(`❌ Sync failed: ${result.message}`);
            }
        } catch (error) {
            alert(`❌ Error: ${error.message}`);
        }
    }

    async function viewAutomationOutput(id) {
        try {
            const response = await fetch(`/api/automations/${id}/output`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (!response.ok) {
                throw new Error('Failed to fetch output');
            }
            
            const data = await response.json();
            
            // Update modal title
            document.getElementById('view-modal-title').textContent = data.name;
            
            // Update status with color
            const statusEl = document.getElementById('view-status');
            statusEl.textContent = data.status || 'N/A';
            const statusLower = (data.status || '').toLowerCase();
            statusEl.style.color = statusLower === 'success' ? '#4CAF50' : statusLower === 'failed' || statusLower === 'fail' ? '#f44336' : '#FFC107';
            
            // Update last run
            const lastRun = data.lastRun ? new Date(data.lastRun).toLocaleString() : 'Never';
            document.getElementById('view-last-run').textContent = lastRun;
            
            // Update duration
            const duration = data.executionDuration 
                ? `${(data.executionDuration / 1000).toFixed(2)}s` 
                : 'N/A';
            document.getElementById('view-duration').textContent = duration;
            
            // Update execution output
            const outputEl = document.getElementById('view-execution-output');
            outputEl.textContent = data.executionOutput || 'No output available';
            
            // Handle files section
            const filesSection = document.getElementById('view-files-section');
            const filesContainer = document.getElementById('view-files-container');
            const downloadAllBtn = document.getElementById('download-all-excel-btn');
            
            if (data.executionFiles && Object.keys(data.executionFiles).length > 0) {
                filesSection.style.display = 'block';
                downloadAllBtn.style.display = 'inline-block';
                
                filesContainer.innerHTML = '';
                Object.entries(data.executionFiles).forEach(([fileName, fileInfo]) => {
                    const fileBtn = document.createElement('button');
                    fileBtn.style.cssText = 'padding: 10px 15px; background: #2196F3; color: white; border: none; border-radius: 6px; cursor: pointer; margin: 5px; display: inline-flex; align-items: center; gap: 8px;';
                    
                    // Format file size
                    let sizeText = '';
                    if (fileInfo.size && typeof fileInfo.size === 'number') {
                        sizeText = fileInfo.size < 1024 
                            ? `${fileInfo.size}B` 
                            : fileInfo.size < 1024 * 1024
                            ? `${(fileInfo.size / 1024).toFixed(1)}KB`
                            : `${(fileInfo.size / (1024 * 1024)).toFixed(1)}MB`;
                    }
                    
                    const icon = fileName.endsWith('.xlsx') || fileName.endsWith('.xls') ? '📊' : 
                                 fileName.endsWith('.csv') ? '📋' :
                                 fileName.endsWith('.json') ? '📄' : '📄';
                    
                    fileBtn.innerHTML = `<span>${icon}</span><span>${fileName}${sizeText ? ` (${sizeText})` : ''}</span>`;
                    fileBtn.onclick = () => downloadFile(id, fileName);
                    filesContainer.appendChild(fileBtn);
                });
                
                downloadAllBtn.onclick = () => downloadAllAsExcel(id);
            } else {
                filesSection.style.display = 'none';
                downloadAllBtn.style.display = 'none';
            }
            
            // Show modal
            document.getElementById('view-output-modal').style.display = 'block';
            
        } catch (error) {
            alert(`❌ Error fetching output: ${error.message}`);
        }
    }

    // Output is now shown in the View modal, not inline
    async function toggleOutput(automationId) {
        // Deprecated - output now shown via View button modal
        console.log('Output toggle deprecated - use View button');
    }

    async function runAutomation(id) {
        const row = document.querySelector(`tr[data-automation-id='${id}']`);
        row.classList.add('row-running');
        const startTime = Date.now();
        
        try {
            const autoResponse = await fetch(`/api/automations/${id}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!autoResponse.ok) {
                alert('Failed to fetch automation details.');
                return;
            }
            const automation = await autoResponse.json();

            const storedCreds = JSON.parse(localStorage.getItem('aws_credentials'));
            if (!storedCreds) {
                alert('Please save your AWS credentials on the Cloud Integration page first.');
                return;
            }

            const credentials = {
                aws_access_key_id: storedCreds.accessKeyId,
                aws_secret_access_key: storedCreds.secretAccessKey,
                aws_default_region: storedCreds.region
            };

            let response, results;
            
            if (automation.sourceType === 'github') {
                // Execute GitHub automation
                const repoUrl = `https://github.com/${automation.githubRepo}.git`;
                
                response = await fetch('/api/python-runner/execute-github', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        repo_url: repoUrl,
                        branch: automation.githubBranch || 'main',
                        script_path: automation.githubPath,
                        github_token: automation.githubToken || null,
                        credentials,
                        env_vars: automation.environmentVars || {}
                    })
                });
                
                results = await response.json();
            } else {
                // Execute inline script
                response = await fetch('/api/python-runner/execute', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        script: automation.script,
                        credentials
                    })
                });
                
                results = await response.json();
            }

            const executionTime = Date.now() - startTime;
            let output = results.output || results.error || 'No output';
            
            // Append stderr if present
            if (results.stderr) {
                output += `\n\nStderr:\n${results.stderr}`;
            }

            // Use actual generated files from Python runner if available
            const executionFiles = {};
            
            if (results.generated_files && Object.keys(results.generated_files).length > 0) {
                // Use actual files returned by Python runner
                Object.entries(results.generated_files).forEach(([fileName, fileData]) => {
                    executionFiles[fileName] = {
                        content: fileData.content,  // base64 encoded
                        size: fileData.size,
                        type: fileData.type,
                        created: fileData.created
                    };
                });
                console.log(`Captured ${Object.keys(executionFiles).length} generated files from execution`);
            } else {
                // Fallback: Parse output for file references (for backwards compatibility)
                const reportPattern = /---\s+Generating\s+(\w+)\s+Report\s+---/gi;
                let match;
                while ((match = reportPattern.exec(output)) !== null) {
                    const reportName = match[1];
                    const fileName = `${reportName}_report.xlsx`;
                    if (!executionFiles[fileName]) {
                        executionFiles[fileName] = {
                            created: new Date().toISOString(),
                            size: 'detected',
                            type: 'Excel Report'
                        };
                    }
                }
            }

            // Update the status and last run time
            await fetch(`/api/automations/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({
                    lastRun: new Date(),
                    status: response.ok ? 'Success' : 'Fail',
                    executionOutput: output,
                    executionDuration: executionTime,
                    executionFiles: Object.keys(executionFiles).length > 0 ? executionFiles : {}
                })
            });

            fetchAutomations();

        } catch (error) {
            console.error('Error running automation:', error);
            alert(`Error running automation: ${error.message}`);
            alert('An error occurred while running the automation.');
        } finally {
            row.classList.remove('row-running');
        }
    }

    async function downloadJSON(id) {
        const response = await fetch(`/api/automations/${id}`, { headers: { 'Authorization': `Bearer ${token}` } });
        const automation = await response.json();
        const output = {
            Name: automation.name,
            'Last Run': automation.lastRun,
            Language: automation.language,
            Status: automation.status,
            'Execution Output': automation.executionOutput
        };
        const blob = new Blob([JSON.stringify(output, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${automation.name}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }

    async function downloadExcel(id) {
        const response = await fetch(`/api/automations/${id}`, { headers: { 'Authorization': `Bearer ${token}` } });
        const automation = await response.json();
        const output = {
            Name: automation.name,
            'Last Run': automation.lastRun,
            Language: automation.language,
            Status: automation.status,
            'Execution Output': automation.executionOutput
        };
        const ws = XLSX.utils.json_to_sheet([output]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Automation');
        XLSX.writeFile(wb, `${automation.name}.xlsx`);
    }

    async function downloadFile(automationId, fileName) {
        try {
            const response = await fetch(`/api/automations/${automationId}/output`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            
            const fileInfo = data.executionFiles[fileName];
            
            if (!fileInfo) {
                alert(`❌ File not found: ${fileName}`);
                return;
            }
            
            // Check if we have the actual file content (base64)
            if (fileInfo.content) {
                // Decode base64 and download actual file
                const binaryString = atob(fileInfo.content);
                const bytes = new Uint8Array(binaryString.length);
                for (let i = 0; i < binaryString.length; i++) {
                    bytes[i] = binaryString.charCodeAt(i);
                }
                
                const blob = new Blob([bytes], {
                    type: fileName.endsWith('.xlsx') || fileName.endsWith('.xls') 
                        ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
                        : fileName.endsWith('.csv')
                        ? 'text/csv'
                        : fileName.endsWith('.json')
                        ? 'application/json'
                        : 'text/plain'
                });
                
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = fileName;
                a.click();
                URL.revokeObjectURL(url);
                
                console.log(`Downloaded actual file: ${fileName} (${fileInfo.size} bytes)`);
            } else {
                // Fallback: create placeholder Excel
                alert('⚠️ File content not available. The file was detected but not captured during execution.');
            }
        } catch (error) {
            alert(`❌ Error downloading file: ${error.message}`);
        }
    }

    async function downloadAllAsExcel(automationId) {
        try {
            const response = await fetch(`/api/automations/${automationId}/output`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            
            const wb = XLSX.utils.book_new();
            
            // Summary sheet
            const summary = {
                'Automation Name': data.name,
                'Status': data.status,
                'Last Run': data.lastRun ? new Date(data.lastRun).toLocaleString() : 'N/A',
                'Duration': data.executionDuration ? `${(data.executionDuration / 1000).toFixed(2)}s` : 'N/A',
                'Files Generated': Object.keys(data.executionFiles || {}).length
            };
            const summaryWs = XLSX.utils.json_to_sheet([summary]);
            XLSX.utils.book_append_sheet(wb, summaryWs, 'Summary');
            
            // Output sheet
            const outputLines = (data.executionOutput || '').split('\n').map((line, idx) => ({
                Line: idx + 1,
                Content: line
            }));
            const outputWs = XLSX.utils.json_to_sheet(outputLines);
            XLSX.utils.book_append_sheet(wb, outputWs, 'Execution Output');
            
            // Files sheet
            if (data.executionFiles && Object.keys(data.executionFiles).length > 0) {
                const filesData = Object.entries(data.executionFiles).map(([name, info]) => ({
                    'File Name': name,
                    'Type': info.type || 'Unknown',
                    'Size (bytes)': info.size || 'N/A',
                    'Created': info.created || 'N/A',
                    'Content Available': info.content ? 'Yes' : 'No'
                }));
                const filesWs = XLSX.utils.json_to_sheet(filesData);
                XLSX.utils.book_append_sheet(wb, filesWs, 'Generated Files');
            }
            
            const fileName = `${data.name}_output_${new Date().getTime()}.xlsx`;
            XLSX.writeFile(wb, fileName);
            
            console.log(`Downloaded summary workbook: ${fileName}`);
        } catch (error) {
            alert(`❌ Error downloading Excel: ${error.message}`);
        }
    }

    function openModalForCreate() {
        automationForm.reset();
        automationId.value = '';
        currentSourceType = 'inline';
        modalTitle.textContent = 'Create New Automation';
        
        // Reset source type buttons
        sourceTypeBtns.forEach(b => {
            b.classList.remove('active');
            b.style.background = '#333';
            b.style.borderColor = '#555';
        });
        sourceTypeBtns[0].classList.add('active');
        sourceTypeBtns[0].style.background = '#4CAF50';
        sourceTypeBtns[0].style.borderColor = '#4CAF50';
        
        // Show inline panel
        inlineConfigPanel.style.display = 'block';
        githubConfigPanel.style.display = 'none';
        
        // Clear environment variables
        envVarsContainer.innerHTML = '';
        fetchStatus.innerHTML = '';
        branchSelectGroup.style.display = 'none';
        scriptSelectGroup.style.display = 'none';
        
        modal.style.display = 'block';
    }

    async function openModalForEdit(id) {
        const response = await fetch(`/api/automations/${id}`, { headers: { 'Authorization': `Bearer ${token}` } });
        const automation = await response.json();

        if (automation) {
            automationId.value = automation.id;
            automationName.value = automation.name || '';
            automationGroup.value = automation.group || '';
            automationDescription.value = automation.description || '';
            
            currentSourceType = automation.sourceType || 'inline';
            
            // Update source type buttons
            sourceTypeBtns.forEach(b => {
                b.classList.remove('active');
                b.style.background = '#333';
                b.style.borderColor = '#555';
                if (b.dataset.source === currentSourceType) {
                    b.classList.add('active');
                    b.style.background = '#4CAF50';
                    b.style.borderColor = '#4CAF50';
                }
            });
            
            if (currentSourceType === 'inline') {
                automationLanguage.value = automation.language || 'python';
                automationScript.value = automation.script || '';
                inlineConfigPanel.style.display = 'block';
                githubConfigPanel.style.display = 'none';
            } else {
                githubRepo.value = automation.githubRepo || '';
                githubBranch.value = automation.githubBranch || 'main';
                githubPath.value = automation.githubPath || '';
                githubToken.value = ''; // Don't show encrypted token
                
                // Load environment variables
                envVarsContainer.innerHTML = '';
                if (automation.environmentVars) {
                    Object.entries(automation.environmentVars).forEach(([key, value]) => {
                        addEnvVarRow(key, value);
                    });
                }
                
                inlineConfigPanel.style.display = 'none';
                githubConfigPanel.style.display = 'block';
            }
            
            modalTitle.textContent = 'Edit Automation';
            modal.style.display = 'block';
        }
    }

    function closeModal() {
        modal.style.display = 'none';
        fetchStatus.innerHTML = '';
    }

    async function saveAutomation() {
        const id = automationId.value;
        const isEditing = !!id;

        const automationData = {
            name: automationName.value,
            group: automationGroup.value,
            description: automationDescription.value,
            sourceType: currentSourceType
        };

        if (currentSourceType === 'inline') {
            automationData.language = automationLanguage.value;
            automationData.script = automationScript.value;
            
            if (!automationData.script) {
                alert('Script is required for inline automations');
                return;
            }
        } else {
            automationData.githubRepo = githubRepo.value.trim();
            automationData.githubBranch = githubBranch.value.trim() || 'main';
            automationData.githubPath = githubPath.value.trim();
            automationData.githubToken = githubToken.value.trim() || null;
            
            // Collect environment variables
            const envVars = {};
            document.querySelectorAll('.env-var-row').forEach(row => {
                const key = row.querySelector('.env-key').value.trim();
                const value = row.querySelector('.env-value').value.trim();
                if (key) {
                    envVars[key] = value;
                }
            });
            automationData.environmentVars = envVars;
            
            if (!automationData.githubRepo || !automationData.githubPath) {
                alert('Repository and script path are required for GitHub automations');
                return;
            }
        }

        const url = isEditing ? `/api/automations/${id}` : '/api/automations';
        const method = isEditing ? 'PUT' : 'POST';

        try {
            const response = await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify(automationData)
            });

            if (response.ok) {
                closeModal();
                fetchAutomations();
            } else {
                const errorData = await response.json();
                alert(`Failed to save automation: ${errorData.message}`);
            }
        } catch (error) {
            console.error('Error saving automation:', error);
            alert('An error occurred while saving the automation.');
        }
    }

    async function deleteAutomation(id) {
        if (!confirm('Are you sure you want to delete this automation?')) return;
        try {
            const response = await fetch(`/api/automations/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                fetchAutomations();
            } else {
                alert('Failed to delete automation.');
            }
        } catch (error) {
            console.error('Error deleting automation:', error);
        }
    }

    // --- Initial Load ---
    fetchAutomations();
});
