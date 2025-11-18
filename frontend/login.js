document.addEventListener('DOMContentLoaded', () => {
    const wrapper = document.querySelector('.wrapper');
    const registerLink = document.querySelector('.register-link');
    
    // Login form elements
    const loginForm = document.getElementById('login-form');
    const loginUsername = document.getElementById('login-username');
    const loginPassword = document.getElementById('login-password');
    const loginErrorMessage = document.getElementById('login-error-message');
    const rememberMe = document.getElementById('remember-me');
    
    // Social login buttons
    const googleLoginBtn = document.getElementById('google-login');
    const microsoftLoginBtn = document.getElementById('microsoft-login');
    const githubLoginBtn = document.getElementById('github-login');

    // Password visibility toggle
    document.querySelectorAll('.toggle-password').forEach(toggle => {
        toggle.addEventListener('click', function() {
            const targetId = this.getAttribute('data-target');
            const passwordInput = document.getElementById(targetId);
            const eyeIcon = this.querySelector('.eye-icon');
            
            if (passwordInput.type === 'password') {
                passwordInput.type = 'text';
                this.classList.add('active');
                eyeIcon.innerHTML = `
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                    <line x1="1" y1="1" x2="23" y2="23"></line>
                `;
            } else {
                passwordInput.type = 'password';
                this.classList.remove('active');
                eyeIcon.innerHTML = `
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                    <circle cx="12" cy="12" r="3"></circle>
                `;
            }
        });
    });

    // Check for OAuth callbacks and registration success
    const urlParams = new URLSearchParams(window.location.search);
    
    // Handle OAuth redirect callback
    const token = urlParams.get('token');
    if (token) {
        localStorage.setItem('token', token);
        window.location.href = 'dashboard.html';
        return;
    }
    
    // Handle OAuth error
    const oauthError = urlParams.get('error');
    if (oauthError) {
        const provider = urlParams.get('provider');
        
        // Only show error for non-configuration issues
        if (oauthError !== 'oauth_not_configured' && oauthError !== 'not_implemented') {
            loginErrorMessage.textContent = decodeURIComponent(urlParams.get('message') || 'Authentication failed. Please try again.');
            loginErrorMessage.style.display = 'block';
        }
        
        // Clear the URL parameters
        if (oauthError === 'oauth_not_configured' || oauthError === 'not_implemented') {
            window.history.replaceState({}, document.title, window.location.pathname);
        }
    }
    
    // Check for registration success
    if (urlParams.has('registration') && urlParams.get('registration') === 'success') {
        // Clear the URL parameter immediately
        window.history.replaceState({}, document.title, window.location.pathname);
    }

    // Login form submission
    if (loginForm) {
        loginForm.addEventListener('submit', async function(event) {
            event.preventDefault();

            const username = loginUsername.value.trim();
            const password = loginPassword.value;

        if (!username || !password) {
            loginErrorMessage.textContent = 'Please enter both username and password.';
            loginErrorMessage.style.display = 'block';
            loginErrorMessage.style.color = '#ef4444';
            return;
        }

        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ 
                    username, 
                    password,
                    rememberMe: rememberMe.checked 
                })
            });

            if (response.ok) {
                const data = await response.json();
                localStorage.setItem('token', data.token);
                
                // Redirect immediately without showing message
                window.location.href = 'dashboard.html';
            } else {
                const errorData = await response.json();
                loginErrorMessage.textContent = errorData.message || 'Login failed. Please check your credentials.';
                loginErrorMessage.style.color = '#ef4444';
                loginErrorMessage.style.display = 'block';
            }
        } catch (error) {
            loginErrorMessage.textContent = 'An error occurred. Please try again later.';
            loginErrorMessage.style.color = '#ef4444';
            loginErrorMessage.style.display = 'block';
            console.error('Login error:', error);
        }
        });
    } else {
        console.error('Login form not found!');
    }

    // Social Login Handlers
    if (googleLoginBtn) {
        googleLoginBtn.addEventListener('click', (e) => {
            e.preventDefault();
            showLoadingState(googleLoginBtn);
            window.location.href = '/api/auth/google';
        });
    }
    
    if (microsoftLoginBtn) {
        microsoftLoginBtn.addEventListener('click', (e) => {
            e.preventDefault();
            showLoadingState(microsoftLoginBtn);
            window.location.href = '/api/auth/microsoft';
        });
    }
    
    if (githubLoginBtn) {
        githubLoginBtn.addEventListener('click', (e) => {
            e.preventDefault();
            showLoadingState(githubLoginBtn);
            window.location.href = '/api/auth/github';
        });
    }
    
    function showLoadingState(button) {
        button.disabled = true;
        button.style.opacity = '0.6';
        button.innerHTML = `
            <svg class="animate-spin" style="width: 22px; height: 22px;" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none" opacity="0.25"/>
                <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" opacity="0.75"/>
            </svg>
        `;
    }

    // Add smooth scroll behavior for better UX
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth'
                });
            }
        });
    });

    // Add entrance animation
    setTimeout(() => {
        wrapper.style.opacity = '1';
        wrapper.style.transform = 'scale(1)';
    }, 100);
});
