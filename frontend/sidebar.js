document.addEventListener('DOMContentLoaded', () => {
    // Load sidebar HTML
    loadSidebar();
    
    // Wait for sidebar to be loaded before accessing elements
    setTimeout(() => {
        const sidebar = document.getElementById('sidebar');
        const toggleBtn = document.getElementById('sidebar-toggle');
        const sidebarTexts = document.querySelectorAll('.sidebar-text');
        const logoImg = document.querySelector('.brand-logo-container svg');
        const costReportToggle = document.getElementById('cost-report-toggle');
        const costReportSubmenu = document.getElementById('cost-report-submenu');
        const cloudMonitoringToggle = document.getElementById('cloud-monitoring-toggle');
        const cloudMonitoringSubmenu = document.getElementById('cloud-monitoring-submenu');
        

        
        function setSidebarState(isExpanded) {
            if (!sidebar) {
                return;
            }
            
            // Toggle sidebar width
            sidebar.classList.toggle('w-64', isExpanded);
            sidebar.classList.toggle('w-20', !isExpanded);
            
            // Toggle text visibility
            sidebarTexts.forEach(text => text.classList.toggle('hidden', !isExpanded));
            
            // Toggle logo size
            if (logoImg) {
                logoImg.classList.toggle('h-9', !isExpanded);
                logoImg.classList.toggle('w-9', !isExpanded);
                logoImg.classList.toggle('h-10', isExpanded);
                logoImg.classList.toggle('w-10', isExpanded);
            }
            
            // Dynamically adjust main content area margin
            const mainContent = document.getElementById('main-content');
            if (mainContent) {
                if (isExpanded) {
                    mainContent.classList.remove('ml-20');
                    mainContent.classList.add('ml-64');
                } else {
                    mainContent.classList.remove('ml-64');
                    mainContent.classList.add('ml-20');
                }
            }
            
            localStorage.setItem('sidebarExpanded', isExpanded);
        }

    // Check for saved state (default to expanded if no state saved)
    const savedState = localStorage.getItem('sidebarExpanded');
    const isExpanded = savedState === null ? true : savedState === 'true';
    setSidebarState(isExpanded);
    
    if (isExpanded) {
         // If expanded on load, show submenus if they were open
        if (localStorage.getItem('costSubmenuOpen') === 'true') {
            costReportSubmenu.style.maxHeight = costReportSubmenu.scrollHeight + "px";
        }
        if (localStorage.getItem('cloudMonitoringSubmenuOpen') === 'true') {
            cloudMonitoringSubmenu.style.maxHeight = cloudMonitoringSubmenu.scrollHeight + "px";
        }
    }

        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => {
                const willExpand = sidebar.classList.contains('w-20');
                setSidebarState(willExpand);
            });
        }

        if (costReportToggle && costReportSubmenu) {
            costReportToggle.addEventListener('click', () => {
        const isCurrentlyExpanded = sidebar.classList.contains('w-64');
        if (isCurrentlyExpanded) {
            const submenuOpen = costReportSubmenu.style.maxHeight !== '0px';
            if (submenuOpen) {
                costReportSubmenu.style.maxHeight = '0px';
                localStorage.setItem('costSubmenuOpen', 'false');
            } else {
                costReportSubmenu.style.maxHeight = costReportSubmenu.scrollHeight + "px";
                localStorage.setItem('costSubmenuOpen', 'true');
            }
        } else {
            // Expand the main sidebar first
            setSidebarState(true);
            // Then open the submenu
            setTimeout(() => {
                costReportSubmenu.style.maxHeight = costReportSubmenu.scrollHeight + "px";
                localStorage.setItem('costSubmenuOpen', 'true');
            }, 50); // A small delay to allow the main sidebar to start expanding
        }
            });
        }

        if (cloudMonitoringToggle && cloudMonitoringSubmenu) {
            cloudMonitoringToggle.addEventListener('click', () => {
        const isCurrentlyExpanded = sidebar.classList.contains('w-64');
        if (isCurrentlyExpanded) {
            const submenuOpen = cloudMonitoringSubmenu.style.maxHeight !== '0px';
            if (submenuOpen) {
                cloudMonitoringSubmenu.style.maxHeight = '0px';
                localStorage.setItem('cloudMonitoringSubmenuOpen', 'false');
            } else {
                cloudMonitoringSubmenu.style.maxHeight = cloudMonitoringSubmenu.scrollHeight + "px";
                localStorage.setItem('cloudMonitoringSubmenuOpen', 'true');
            }
        } else {
            // Expand the main sidebar first
            setSidebarState(true);
            // Then open the submenu
            setTimeout(() => {
                cloudMonitoringSubmenu.style.maxHeight = cloudMonitoringSubmenu.scrollHeight + "px";
                localStorage.setItem('cloudMonitoringSubmenuOpen', 'true');
            }, 50); // A small delay to allow the main sidebar to start expanding
            }
            });
        }

        const signoutBtn = document.getElementById('signout-btn-sidebar');
        if (signoutBtn) {
            signoutBtn.addEventListener('click', (e) => {
                e.preventDefault();
                try {
                    // Clear all stored data
                    localStorage.removeItem('token');
                    localStorage.removeItem('sidebarExpanded');
                    localStorage.removeItem('costSubmenuOpen');
                    localStorage.removeItem('cloudMonitoringSubmenuOpen');
                    localStorage.removeItem('awsMonitoringSubmenuOpen');
                    

                    // Redirect to login page
                    window.location.href = '/index.html';
                } catch (error) {
                    console.error('Error during sign out:', error);
                    // Force redirect even if there's an error
                    window.location.href = '/index.html';
                }
            });
        }
    }, 500); // Wait 500ms for sidebar to load
});

function loadSidebar() {
    // Load Font Awesome if not already loaded
    if (!document.querySelector('link[href*="font-awesome"]')) {
        const fontAwesome = document.createElement('link');
        fontAwesome.rel = 'stylesheet';
        fontAwesome.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css';
        document.head.appendChild(fontAwesome);
    }
    
    // Add custom sidebar styles if not already added
    if (!document.getElementById('sidebar-flexbox-styles')) {
        const style = document.createElement('style');
        style.id = 'sidebar-flexbox-styles';
        style.textContent = `
            /* Sidebar Flexbox Layout */
            #sidebar {
                display: flex !important;
                flex-direction: column !important;
                height: 100vh !important;
                overflow: hidden !important;
                transition: width 0.3s ease-in-out !important;
            }
            
            /* Main Content Responsive Behavior */
            #main-content {
                transition: margin-left 0.3s ease-in-out !important;
                width: auto !important;
                flex: 1 !important;
            }
            
            /* Header section - fixed at top */
            #sidebar > div:first-child {
                flex-shrink: 0 !important;
            }
            
            /* Scrollable navigation section - grows to fill space */
            #sidebar > nav {
                flex: 1 1 auto !important;
                overflow-y: auto !important;
                overflow-x: hidden !important;
            }
            
            /* Auto-hide scrollbar for webkit browsers */
            #sidebar > nav::-webkit-scrollbar {
                width: 6px;
                background: transparent;
            }
            
            #sidebar > nav::-webkit-scrollbar-track {
                background: transparent;
                border: none;
            }
            
            #sidebar > nav::-webkit-scrollbar-thumb {
                background: transparent;
                border-radius: 3px;
                border: none;
                transition: background 0.2s ease;
            }
            
            /* Show scrollbar on hover or scroll */
            #sidebar > nav:hover::-webkit-scrollbar-thumb,
            #sidebar > nav:active::-webkit-scrollbar-thumb {
                background: #4a5568;
            }
            
            #sidebar > nav::-webkit-scrollbar-thumb:hover {
                background: #718096;
            }
            
            /* Firefox scrollbar styling - auto-hide */
            #sidebar > nav {
                scrollbar-width: thin;
                scrollbar-color: transparent transparent;
            }
            
            #sidebar > nav:hover,
            #sidebar > nav:active {
                scrollbar-color: #4a5568 transparent;
            }
            
            /* Bottom fixed section - stays at bottom */
            #sidebar > nav + div {
                flex-shrink: 0 !important;
                background-color: #111827 !important;
            }
            
            /* Remove all borders and dividers */
            #sidebar,
            #sidebar *,
            #sidebar > div,
            #sidebar > nav + div {
                border: none !important;
                box-shadow: none !important;
            }
            
            /* Ensure consistent background across sections */
            #sidebar > div:first-child,
            #sidebar > nav,
            #sidebar > nav + div {
                background-color: #111827 !important;
            }
            
            /* Smooth transitions */
            #sidebar a,
            #sidebar button {
                transition: all 0.2s ease-in-out !important;
                border: none !important;
                outline: none !important;
            }
            
            /* Remove outline and border on all states */
            #sidebar a:hover,
            #sidebar a:active,
            #sidebar a:focus,
            #sidebar button:hover,
            #sidebar button:active,
            #sidebar button:focus {
                outline: none !important;
                border: none !important;
                box-shadow: none !important;
            }
            
            /* Subtle focus indicator for accessibility (using background instead of border) */
            #sidebar a:focus-visible,
            #sidebar button:focus-visible {
                background-color: rgba(59, 130, 246, 0.15) !important;
                outline: none !important;
                border: none !important;
            }
            
            /* Ensure submenu items also have no borders */
            #sidebar [id$="-submenu"] a {
                border: none !important;
            }
            
            /* Remove any potential button default borders */
            #sidebar button[id$="-toggle"] {
                border: none !important;
                outline: none !important;
            }
            
            /* Ensure proper layout at different screen sizes */
            @media screen and (max-height: 600px) {
                #sidebar > nav {
                    min-height: 200px;
                }
                /* Reduce padding on small screens */
                #sidebar > nav .space-y-2 {
                    padding-bottom: 8px;
                }
            }
            
            /* Very small screens */
            @media screen and (max-height: 400px) {
                #sidebar > nav .px-4 {
                    padding-top: 8px !important;
                    padding-bottom: 8px !important;
                }
            }
            
            /* Collapsed sidebar behavior */
            #sidebar.w-20 > nav {
                overflow-y: auto !important;
            }
            
            /* Ensure submenu transitions work smoothly */
            #sidebar [id$="-submenu"] {
                transition: max-height 0.3s ease-in-out !important;
            }
            
            /* Rotate collapse icon when sidebar is collapsed */
            #sidebar.w-20 #sidebar-toggle i.fa-angle-double-left {
                transform: rotate(180deg);
            }
            
            #sidebar-toggle i {
                transition: transform 0.3s ease-in-out;
            }
            
            /* Font Size Optimization - Compact and Professional */
            #sidebar .sidebar-text {
                font-size: 14px !important;
                line-height: 1.3 !important;
                white-space: nowrap !important;
                overflow: hidden !important;
                text-overflow: ellipsis !important;
            }
            
            /* Header brand text */
            #sidebar h2.sidebar-text {
                font-size: 18px !important;
                line-height: 1.4 !important;
            }
            
            /* Menu item links - optimized padding */
            #sidebar nav a,
            #sidebar nav > div > button {
                padding: 10px 12px !important;
                font-size: 14px !important;
            }
            
            /* Icons sizing */
            #sidebar i.fas,
            #sidebar i.fab {
                font-size: 16px !important;
                width: 20px !important;
                height: 20px !important;
                display: inline-flex !important;
                align-items: center !important;
                justify-content: center !important;
                margin-right: 12px !important;
            }
            
            /* Submenu items - slightly smaller */
            #sidebar [id$="-submenu"] a {
                padding: 8px 12px !important;
                font-size: 13px !important;
            }
            
            #sidebar [id$="-submenu"] i {
                font-size: 14px !important;
                width: 16px !important;
                height: 16px !important;
                margin-right: 10px !important;
            }
            
            /* Submenu left margin adjustment for better alignment */
            #sidebar [id$="-submenu"] > div {
                margin-left: 32px !important;
            }
            
            /* Bottom buttons - optimized */
            #sidebar-toggle,
            #signout-btn-sidebar {
                padding: 10px 12px !important;
                font-size: 14px !important;
            }
            
            /* Adjust spacing between items */
            #sidebar nav > div > div.px-4 {
                gap: 6px !important;
            }
            
            /* Logo size optimization */
            #sidebar .brand-logo-container svg {
                width: 32px !important;
                height: 32px !important;
                margin-right: 10px !important;
            }
            
            /* Ensure proper line height for all text */
            #sidebar a span,
            #sidebar button span {
                line-height: 1.3 !important;
            }
            
            /* Collapsed sidebar - icon only mode */
            #sidebar.w-20 .sidebar-text {
                display: none !important;
            }
            
            #sidebar.w-20 i {
                margin-right: 0 !important;
            }
        `;
        document.head.appendChild(style);
    }
    
    const sidebarPlaceholder = document.getElementById('sidebar-placeholder');
    if (sidebarPlaceholder) {
        sidebarPlaceholder.innerHTML = `
            <!-- Sidebar with Flexbox Layout -->
            <div id="sidebar" class="bg-gray-900 h-screen fixed left-0 top-0 z-30 transition-all duration-300 w-64 flex flex-col">
                <!-- Header Section (Fixed) -->
                <div class="p-4 pb-6 flex-shrink-0">
                    <div class="brand-logo-container flex items-center">
                        <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path
                                d="M16 44C10 44 6 39 6 33C6 27 11 22 17 22C19.5 22 22 23 24 25C26 19 32 16 38 18C43 20 46 25 45 30C51 31 54 36 54 41C54 47 49 52 43 52H18C16.9 52 16 44 16 44Z"
                                stroke="#17627a"
                                stroke-width="3"
                                fill="none"
                                stroke-linecap="round"
                                stroke-linejoin="round"
                            />
                            <polyline
                                points="18,40 26,32 30,36 34,28 38,40 46,40"
                                stroke="#00bcd4"
                                stroke-width="3"
                                fill="none"
                                stroke-linecap="round"
                                stroke-linejoin="round"
                            />
                        </svg>
                        <h2 class="sidebar-text font-bold text-white">Cloud Pulse 360</h2>
                    </div>
                </div>

                <!-- Scrollable Navigation Section (Flexible) -->
                <nav class="flex-1 overflow-y-auto mt-6" style="scrollbar-width: thin; scrollbar-color: transparent transparent;">
                    <div class="px-4 space-y-2 pb-4">
                        <!-- Dashboard -->
                        <a href="/dashboard.html" class="flex items-center px-4 py-3 text-gray-300 hover:bg-gray-800 hover:text-white rounded-lg transition-colors">
                            <i class="fas fa-tachometer-alt text-blue-400"></i>
                            <span class="sidebar-text">Dashboard</span>
                        </a>

                        <!-- Synthetic Monitoring -->
                        <a href="/synthetic.html" class="flex items-center px-4 py-3 text-gray-300 hover:bg-gray-800 hover:text-white rounded-lg transition-colors">
                            <i class="fas fa-heartbeat text-red-400"></i>
                            <span class="sidebar-text">Synthetic Monitoring</span>
                        </a>

                        <!-- Cloud Integration -->
                        <a href="/aws_dashboard.html" class="flex items-center px-4 py-3 text-gray-300 hover:bg-gray-800 hover:text-white rounded-lg transition-colors">
                            <i class="fas fa-cloud text-cyan-400"></i>
                            <span class="sidebar-text">Cloud Integration</span>
                        </a>

                        <!-- Cloud Monitoring -->
                        <div>
                            <button id="cloud-monitoring-toggle" class="flex items-center w-full px-4 py-3 text-gray-300 hover:bg-gray-800 hover:text-white rounded-lg transition-colors">
                                <i class="fas fa-chart-line mr-3 text-green-400"></i>
                                <span class="sidebar-text">Cloud Monitoring</span>
                            </button>
                            <div id="cloud-monitoring-submenu" class="overflow-hidden transition-all duration-300" style="max-height: 0px;">
                                <div class="ml-10 mt-2 space-y-1">
                                    <a href="/aws_infra_monitoring.html" class="flex items-center px-4 py-2 text-sm text-gray-400 hover:bg-gray-800 hover:text-white rounded-lg transition-colors">
                                        <i class="fab fa-aws mr-3 text-orange-400"></i>
                                        <span class="sidebar-text">AWS</span>
                                    </a>
                                    <a href="#" class="flex items-center px-4 py-2 text-sm text-gray-400 hover:bg-gray-800 hover:text-white rounded-lg transition-colors">
                                        <i class="fab fa-microsoft mr-3 text-blue-500"></i>
                                        <span class="sidebar-text">Azure</span>
                                    </a>
                                    <a href="#" class="flex items-center px-4 py-2 text-sm text-gray-400 hover:bg-gray-800 hover:text-white rounded-lg transition-colors">
                                        <i class="fab fa-google mr-3 text-blue-400"></i>
                                        <span class="sidebar-text">GCP</span>
                                    </a>
                                </div>
                            </div>
                        </div>

                        <!-- Cloud Cost Report -->
                        <div>
                            <button id="cost-report-toggle" class="flex items-center w-full px-4 py-3 text-gray-300 hover:bg-gray-800 hover:text-white rounded-lg transition-colors">
                                <i class="fas fa-dollar-sign mr-3 text-yellow-400"></i>
                                <span class="sidebar-text">Cloud Cost Report</span>
                            </button>
                            <div id="cost-report-submenu" class="overflow-hidden transition-all duration-300" style="max-height: 0px;">
                                <div class="ml-10 mt-2 space-y-1">
                                    <a href="/cost_report_aws.html" class="flex items-center px-4 py-2 text-sm text-gray-400 hover:bg-gray-800 hover:text-white rounded-lg transition-colors">
                                        <i class="fab fa-aws mr-3 text-orange-400"></i>
                                        <span class="sidebar-text">AWS</span>
                                    </a>
                                    <a href="/cost_report_azure.html" class="flex items-center px-4 py-2 text-sm text-gray-400 hover:bg-gray-800 hover:text-white rounded-lg transition-colors">
                                        <i class="fab fa-microsoft mr-3 text-blue-500"></i>
                                        <span class="sidebar-text">Azure</span>
                                    </a>
                                    <a href="#" class="flex items-center px-4 py-2 text-sm text-gray-400 hover:bg-gray-800 hover:text-white rounded-lg transition-colors">
                                        <i class="fab fa-google mr-3 text-blue-400"></i>
                                        <span class="sidebar-text">GCP</span>
                                    </a>
                                </div>
                            </div>
                        </div>

                        <!-- Automation -->
                        <a href="/automation.html" class="flex items-center px-4 py-3 text-gray-300 hover:bg-gray-800 hover:text-white rounded-lg transition-colors">
                            <i class="fas fa-cogs mr-3 text-purple-400"></i>
                            <span class="sidebar-text">Automation</span>
                        </a>

                        <!-- Alert Management -->
                        <a href="/alert_management.html" class="flex items-center px-4 py-3 text-gray-300 hover:bg-gray-800 hover:text-white rounded-lg transition-colors">
                            <i class="fas fa-bell mr-3 text-red-400"></i>
                            <span class="sidebar-text">Alert Management</span>
                        </a>

                        <!-- AI Agent -->
                        <a href="/agent.html" class="flex items-center px-4 py-3 text-gray-300 hover:bg-gray-800 hover:text-white rounded-lg transition-colors">
                            <i class="fas fa-robot mr-3 text-teal-400"></i>
                            <span class="sidebar-text">AI Agent</span>
                        </a>
                    </div>
                </nav>

                <!-- Bottom Fixed Section (Static) -->
                <div class="flex-shrink-0 p-4 pt-6 bg-gray-900 flex flex-col gap-2">
                    <button id="sidebar-toggle" class="flex items-center w-full px-4 py-2 text-gray-300 hover:bg-gray-700 hover:text-white rounded-lg transition-colors">
                        <i class="fas fa-angle-double-left mr-3 text-gray-400"></i>
                        <span class="sidebar-text">Collapse</span>
                    </button>
                    <button id="signout-btn-sidebar" class="flex items-center w-full px-4 py-2 text-gray-300 hover:bg-red-700 hover:text-white rounded-lg transition-colors">
                        <i class="fas fa-sign-out-alt mr-3 text-red-400"></i>
                        <span class="sidebar-text">Sign Out</span>
                    </button>
                </div>
            </div>
        `;
    }
}
