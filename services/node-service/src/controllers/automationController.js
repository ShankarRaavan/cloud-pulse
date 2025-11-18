const db = require('../models');
const Automation = db.Automation;
const githubService = require('../services/githubService');

exports.getAllAutomations = async (req, res) => {
    const automations = await Automation.findAll();
    res.json(automations);
};

exports.getAutomationById = async (req, res) => {
    const automation = await Automation.findByPk(req.params.id);
    if (automation) {
        res.json(automation);
    } else {
        res.status(404).json({ message: 'Automation not found' });
    }
};

exports.createAutomation = async (req, res) => {
    try {
        const automationData = { ...req.body };
        
        // Encrypt GitHub token if provided
        if (automationData.githubToken) {
            automationData.githubToken = githubService.encryptToken(automationData.githubToken);
        }
        
        // Validate required fields based on source type
        if (automationData.sourceType === 'github') {
            if (!automationData.githubRepo || !automationData.githubPath) {
                return res.status(400).json({ 
                    message: 'GitHub repository and path are required for GitHub source type' 
                });
            }
            
            // Parse GitHub URL if full URL is provided
            try {
                automationData.githubRepo = githubService.parseGitHubUrl(automationData.githubRepo);
            } catch (error) {
                return res.status(400).json({ 
                    message: `Invalid GitHub repository format: ${error.message}` 
                });
            }
        } else {
            // Inline script validation
            if (!automationData.language || !automationData.script) {
                return res.status(400).json({ 
                    message: 'Language and script are required for inline source type' 
                });
            }
        }
        
        const automation = await Automation.create(automationData);
        res.status(201).json(automation);
    } catch (error) {
        res.status(400).json({ message: 'Invalid data provided for automation', details: error.message });
    }
};

exports.updateAutomation = async (req, res) => {
    try {
        const automation = await Automation.findByPk(req.params.id);
        if (automation) {
            const updateData = { ...req.body };
            
            // Encrypt GitHub token if provided
            if (updateData.githubToken) {
                updateData.githubToken = githubService.encryptToken(updateData.githubToken);
            }
            
            await automation.update(updateData);
            res.json(automation);
        } else {
            res.status(404).json({ message: 'Automation not found' });
        }
    } catch (error) {
        res.status(400).json({ message: 'Invalid data provided for automation', details: error.message });
    }
};

exports.deleteAutomation = async (req, res) => {
    const automation = await Automation.findByPk(req.params.id);
    if (automation) {
        await automation.destroy();
        res.sendStatus(204);
    } else {
        res.status(404).json({ message: 'Automation not found' });
    }
};

// Test GitHub repository access
exports.testGitHubRepository = async (req, res) => {
    try {
        let { repo, branch, path, token } = req.body;
        
        if (!repo) {
            return res.status(400).json({ message: 'Repository is required' });
        }
        
        // Parse GitHub URL if full URL is provided
        try {
            repo = githubService.parseGitHubUrl(repo);
        } catch (error) {
            return res.status(400).json({ 
                success: false, 
                message: error.message 
            });
        }
        
        const result = await githubService.validateRepository(
            repo,
            branch || 'main',
            path,
            token
        );
        
        if (result.success) {
            res.json({
                success: true,
                message: 'Repository is accessible',
                data: result
            });
        } else {
            res.status(404).json({
                success: false,
                message: result.message
            });
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to test repository',
            error: error.message
        });
    }
};

// Sync automation with latest GitHub commit
exports.syncGitHubAutomation = async (req, res) => {
    try {
        const automation = await Automation.findByPk(req.params.id);
        
        if (!automation) {
            return res.status(404).json({ message: 'Automation not found' });
        }
        
        if (automation.sourceType !== 'github') {
            return res.status(400).json({ 
                message: 'Only GitHub automations can be synced' 
            });
        }
        
        const token = automation.githubToken 
            ? githubService.decryptToken(automation.githubToken)
            : null;
        
        const latestCommit = await githubService.getLatestCommit(
            automation.githubRepo,
            automation.githubBranch || 'main',
            token
        );
        
        await automation.update({
            githubLastCommit: latestCommit.sha
        });
        
        res.json({
            success: true,
            message: 'Synced to latest commit',
            commit: latestCommit
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to sync automation',
            error: error.message
        });
    }
};

// Get automation execution output
exports.getAutomationOutput = async (req, res) => {
    try {
        const automation = await Automation.findByPk(req.params.id);
        
        if (!automation) {
            return res.status(404).json({ message: 'Automation not found' });
        }
        
        res.json({
            id: automation.id,
            name: automation.name,
            lastRun: automation.lastRun,
            status: automation.status,
            executionDuration: automation.executionDuration,
            executionOutput: automation.executionOutput,
            executionFiles: automation.executionFiles || {}
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to get automation output',
            error: error.message
        });
    }
};

// Fetch GitHub branches
exports.fetchGitHubBranches = async (req, res) => {
    try {
        const { repo, token } = req.body;
        
        if (!repo) {
            return res.status(400).json({
                success: false,
                message: 'Repository is required'
            });
        }
        
        const parsedRepo = githubService.parseGitHubUrl(repo);
        const branches = await githubService.getBranches(parsedRepo, token);
        
        res.json({
            success: true,
            data: branches,
            message: 'Branches fetched successfully'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to fetch branches',
            error: error.message
        });
    }
};

// Fetch GitHub scripts (Python files)
exports.fetchGitHubScripts = async (req, res) => {
    try {
        const { repo, branch, token } = req.body;
        
        if (!repo || !branch) {
            return res.status(400).json({
                success: false,
                message: 'Repository and branch are required'
            });
        }
        
        const parsedRepo = githubService.parseGitHubUrl(repo);
        const scripts = await githubService.getScripts(parsedRepo, branch, token);
        
        res.json({
            success: true,
            data: scripts,
            message: 'Scripts fetched successfully'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to fetch scripts',
            error: error.message
        });
    }
};
