const axios = require('axios');
const crypto = require('crypto');

class GitHubService {
    constructor() {
        this.apiBaseUrl = 'https://api.github.com';
    }

    /**
     * Validate GitHub repository access
     */
    async validateRepository(repo, branch = 'main', path = null, token = null) {
        try {
            const headers = {
                'Accept': 'application/vnd.github.v3+json',
                'User-Agent': 'CloudPulse360'
            };

            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }

            // Check if repository exists
            const repoUrl = `${this.apiBaseUrl}/repos/${repo}`;
            const repoResponse = await axios.get(repoUrl, { headers });

            if (!repoResponse.data) {
                return { success: false, message: 'Repository not found' };
            }

            // Get latest commit on branch
            const branchUrl = `${this.apiBaseUrl}/repos/${repo}/branches/${branch}`;
            const branchResponse = await axios.get(branchUrl, { headers });

            const commitSHA = branchResponse.data.commit.sha;

            // If path is specified, validate it exists
            let files = [];
            if (path) {
                const contentsUrl = `${this.apiBaseUrl}/repos/${repo}/contents/${path}?ref=${branch}`;
                try {
                    const contentsResponse = await axios.get(contentsUrl, { headers });
                    
                    if (Array.isArray(contentsResponse.data)) {
                        files = contentsResponse.data.map(f => f.name);
                    } else {
                        files = [contentsResponse.data.name];
                    }
                } catch (error) {
                    if (error.response && error.response.status === 404) {
                        return { 
                            success: false, 
                            message: `Path not found: ${path}` 
                        };
                    }
                    throw error;
                }
            }

            return {
                success: true,
                commitSHA,
                files,
                repoName: repoResponse.data.name,
                repoFullName: repoResponse.data.full_name,
                isPrivate: repoResponse.data.private,
                defaultBranch: repoResponse.data.default_branch
            };

        } catch (error) {
            if (error.response && error.response.status === 404) {
                return { 
                    success: false, 
                    message: 'Repository or branch not found' 
                };
            }
            if (error.response && error.response.status === 401) {
                return { 
                    success: false, 
                    message: 'Authentication failed. Check your GitHub token.' 
                };
            }
            throw new Error(`GitHub API error: ${error.message}`);
        }
    }

    /**
     * Get latest commit SHA for a branch
     */
    async getLatestCommit(repo, branch = 'main', token = null) {
        try {
            const headers = {
                'Accept': 'application/vnd.github.v3+json',
                'User-Agent': 'CloudPulse360'
            };

            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }

            const branchUrl = `${this.apiBaseUrl}/repos/${repo}/branches/${branch}`;
            const response = await axios.get(branchUrl, { headers });

            return {
                sha: response.data.commit.sha,
                message: response.data.commit.commit.message,
                author: response.data.commit.commit.author.name,
                date: response.data.commit.commit.author.date
            };

        } catch (error) {
            throw new Error(`Failed to get latest commit: ${error.message}`);
        }
    }

    /**
     * Get file contents from repository
     */
    async getFileContents(repo, path, branch = 'main', token = null) {
        try {
            const headers = {
                'Accept': 'application/vnd.github.v3.raw',
                'User-Agent': 'CloudPulse360'
            };

            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }

            const contentsUrl = `${this.apiBaseUrl}/repos/${repo}/contents/${path}?ref=${branch}`;
            const response = await axios.get(contentsUrl, { headers });

            return response.data;

        } catch (error) {
            throw new Error(`Failed to get file contents: ${error.message}`);
        }
    }

    /**
     * Encrypt GitHub token for storage
     */
    encryptToken(token) {
        if (!token) return null;

        const algorithm = 'aes-256-cbc';
        const key = crypto.scryptSync(
            process.env.JWT_SECRET || 'default-secret-key',
            'salt',
            32
        );
        const iv = crypto.randomBytes(16);

        const cipher = crypto.createCipheriv(algorithm, key, iv);
        let encrypted = cipher.update(token, 'utf8', 'hex');
        encrypted += cipher.final('hex');

        return JSON.stringify({
            encrypted,
            iv: iv.toString('hex')
        });
    }

    /**
     * Decrypt GitHub token for use
     */
    decryptToken(encryptedData) {
        if (!encryptedData) return null;

        try {
            const data = JSON.parse(encryptedData);
            const algorithm = 'aes-256-cbc';
            const key = crypto.scryptSync(
                process.env.JWT_SECRET || 'default-secret-key',
                'salt',
                32
            );

            const decipher = crypto.createDecipheriv(
                algorithm,
                key,
                Buffer.from(data.iv, 'hex')
            );

            let decrypted = decipher.update(data.encrypted, 'hex', 'utf8');
            decrypted += decipher.final('utf8');

            return decrypted;
        } catch (error) {
            console.error('Failed to decrypt token:', error);
            return null;
        }
    }

    /**
     * Convert GitHub repo URL to API format
     */
    parseGitHubUrl(url) {
        // Handle various GitHub URL formats
        // https://github.com/user/repo
        // https://github.com/user/repo.git
        // git@github.com:user/repo.git
        // user/repo

        if (!url) {
            throw new Error('Repository URL is required');
        }

        let match;

        // HTTPS format with .git
        match = url.match(/github\.com[\/:]([^\/]+)\/([^\/]+)\.git/);
        if (match) {
            return `${match[1]}/${match[2]}`;
        }

        // HTTPS format without .git
        match = url.match(/github\.com[\/:]([^\/]+)\/([^\/]+)/);
        if (match) {
            return `${match[1]}/${match[2]}`;
        }

        // Simple format (user/repo)
        match = url.match(/^([^\/]+)\/([^\/]+)$/);
        if (match) {
            return url;
        }

        throw new Error('Invalid GitHub repository format. Use "owner/repo" or GitHub URL');
    }

    /**
     * Build GitHub clone URL
     */
    buildCloneUrl(repo, token = null) {
        if (token) {
            return `https://${token}@github.com/${repo}.git`;
        }
        return `https://github.com/${repo}.git`;
    }

    /**
     * Get all branches from a repository
     */
    async getBranches(repo, token = null) {
        try {
            const headers = {
                'Accept': 'application/vnd.github.v3+json',
                'User-Agent': 'CloudPulse360'
            };

            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }

            const branchesUrl = `${this.apiBaseUrl}/repos/${repo}/branches`;
            const response = await axios.get(branchesUrl, { headers });

            return response.data.map(branch => ({
                name: branch.name,
                sha: branch.commit.sha
            }));

        } catch (error) {
            if (error.response && error.response.status === 404) {
                throw new Error('Repository not found');
            }
            if (error.response && error.response.status === 401) {
                throw new Error('Authentication failed. Check your GitHub token.');
            }
            throw new Error(`Failed to fetch branches: ${error.message}`);
        }
    }

    /**
     * Get all Python scripts from a repository branch
     */
    async getScripts(repo, branch = 'main', token = null) {
        try {
            const headers = {
                'Accept': 'application/vnd.github.v3+json',
                'User-Agent': 'CloudPulse360'
            };

            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }

            // Get repository tree recursively
            const treeUrl = `${this.apiBaseUrl}/repos/${repo}/git/trees/${branch}?recursive=1`;
            const response = await axios.get(treeUrl, { headers });

            // Filter for Python files only (.py extension)
            const pythonFiles = response.data.tree
                .filter(item => item.type === 'blob' && item.path.endsWith('.py'))
                .map(file => ({
                    path: file.path,
                    sha: file.sha,
                    size: file.size
                }));

            return pythonFiles;

        } catch (error) {
            if (error.response && error.response.status === 404) {
                throw new Error('Repository or branch not found');
            }
            if (error.response && error.response.status === 401) {
                throw new Error('Authentication failed. Check your GitHub token.');
            }
            throw new Error(`Failed to fetch scripts: ${error.message}`);
        }
    }
}

module.exports = new GitHubService();
