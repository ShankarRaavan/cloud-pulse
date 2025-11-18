# Cloud Pulse 360

![Cloud Pulse 360](https://img.shields.io/badge/Cloud-Pulse%20360-blue) ![Version](https://img.shields.io/badge/version-2.0.0-green) ![License](https://img.shields.io/badge/license-MIT-orange) ![Docker](https://img.shields.io/badge/docker-ready-blue) ![AI](https://img.shields.io/badge/AI-powered-purple)

**Cloud Pulse 360** is a comprehensive, AI-powered cloud monitoring and management platform that provides real-time infrastructure monitoring, cost optimization, synthetic monitoring, automation, and intelligent AI insights across multi-cloud environments (AWS, Azure, GCP).

---

## 📋 Table of Contents

- [Overview](#-overview)
- [Key Features](#-key-features)
- [Tech Stack](#-tech-stack)
- [Architecture](#-architecture)
- [Project Structure](#-project-structure)
- [Installation](#-installation)
- [Configuration](#-configuration)
- [Usage Guide](#-usage-guide)
- [API Documentation](#-api-documentation)
- [Contributing](#-contributing)
- [License](#-license)

---

## 🎯 Overview

Cloud Pulse 360 is an enterprise-grade monitoring platform designed for DevOps teams, SREs, and cloud architects to effectively manage their cloud infrastructure. The platform combines real-time monitoring, AI-powered insights, cost optimization, and automation capabilities in a unified interface.

### Why Cloud Pulse 360?

- **Unified Platform**: Monitor AWS, Azure, and GCP from a single dashboard
- **AI-Powered**: Google Gemini AI integration for intelligent insights and anomaly detection
- **Cost Optimization**: Track and optimize cloud spending across all providers
- **Automation**: Execute custom scripts, analyze logs, and automate workflows
- **Synthetic Monitoring**: Monitor external endpoints and APIs for availability
- **Real-time Alerts**: Multi-channel notifications (Email, Slack, Teams, Webhooks)
- **Open Source**: Fully customizable and self-hosted

---

## ✨ Key Features

### 1. **Multi-Cloud Infrastructure Monitoring**
- Real-time metrics from AWS CloudWatch, Azure Monitor, and GCP Stackdriver
- Monitor EC2, RDS, Lambda, S3, Azure VMs, and more
- Interactive time-range selection (1h, 6h, 24h, 7d, 30d, custom)
- Live charting with Chart.js for metrics visualization
- Resource discovery and automatic monitor creation

### 2. **AI Agent (Google Gemini Integration)**
- **4 Specialized Modes**:
  - 🛡️ **SRE Assistant**: Root cause analysis, anomaly detection, remediation suggestions
  - 📈 **Monitor Creation**: Natural language to CloudWatch alarm configuration
  - 🤖 **Automation Agent**: Safe automation workflow design with approval gates
  - 📚 **Knowledge Assistant**: SRE/DevOps Q&A and documentation
- Conversational interface with context retention
- Multi-turn conversations for complex queries
- Export conversation history

### 3. **Synthetic Monitoring**
- HTTP/HTTPS endpoint monitoring
- Uptime percentage tracking
- Response time analysis
- Status code monitoring
- Historical performance charts
- Configurable check intervals

### 4. **Cloud Cost Management**
- **AWS Cost Insights**: Service-wise breakdown, forecasting, optimization recommendations
- **Azure Cost Insights**: Subscription costs, resource group allocation, budget tracking
- Daily, weekly, and monthly cost trends
- Cost anomaly detection
- Reserved instance recommendations
- Export reports to CSV

### 5. **Automation & Scripting**
- Custom Python script execution
- GitHub repository integration
- Automated log analysis and pattern detection
- Environment variable injection
- File generation and download
- Execution history and status tracking

### 6. **Alert Management**
- Multi-channel notifications (Email, Slack, Teams, Custom Webhooks)
- Smart alert thresholds
- Alert history and analytics
- Maintenance window configuration
- Alert correlation

### 7. **Dashboard & Reporting**
- Customizable dashboards
- Real-time service health indicators
- Cost overview widgets
- Recent alerts summary
- Export capabilities

---

## 🛠️ Tech Stack

### Frontend
| Technology | Version | Purpose |
|------------|---------|---------|
| **HTML5 / CSS3 / JavaScript** | ES6+ | Core web technologies |
| **Tailwind CSS** | CDN | Utility-first CSS framework |
| **Chart.js** | ^4.4.0 | Data visualization |
| **Font Awesome** | ^6.4.0 | Icon library |
| **XLSX.js** | ^0.18.5 | Excel file generation |

### Backend Services

#### Node Service (Main Backend - Port 8080)
| Technology | Version | Purpose |
|------------|---------|---------|
| **Node.js** | ^18.x | JavaScript runtime |
| **Express.js** | ^4.18.0 | Web framework |
| **Sequelize** | ^6.35.0 | ORM for SQLite |
| **SQLite3** | ^5.1.6 | Database |
| **JWT** | ^9.0.0 | Authentication |
| **bcryptjs** | ^2.4.3 | Password hashing |
| **Passport.js** | ^0.7.0 | OAuth integration |
| **Axios** | ^1.6.0 | HTTP client |
| **Nodemailer** | ^6.9.7 | Email notifications |

#### AWS Service (Cloud Integration - Port 8000)
| Technology | Version | Purpose |
|------------|---------|---------|
| **Node.js** | ^18.x | JavaScript runtime |
| **Express.js** | ^4.18.0 | Web framework |
| **AWS SDK v3** | ^3.913.0 | AWS integration |
| - CloudWatch | ^3.913.0 | Metrics monitoring |
| - Cost Explorer | ^3.913.0 | Cost analysis |
| - EC2 | ^3.913.0 | Compute monitoring |
| - RDS | ^3.913.0 | Database monitoring |
| - Lambda | ^3.913.0 | Serverless monitoring |
| - S3 | ^3.913.0 | Storage monitoring |

#### AI Service (Machine Learning - Port 9000)
| Technology | Version | Purpose |
|------------|---------|---------|
| **Node.js** | ^18.x | JavaScript runtime |
| **Express.js** | ^4.18.0 | Web framework |
| **Google Generative AI** | Latest | Gemini AI integration |
| **OpenAI SDK** | Latest | GPT-4 integration |
| **Python** | 3.11 | ML/Data processing |
| **NumPy** | Latest | Numerical computing |
| **Pandas** | Latest | Data analysis |
| **scikit-learn** | Latest | Machine learning |

#### Python Runner (Script Execution - Port 5000)
| Technology | Version | Purpose |
|------------|---------|---------|
| **Flask** | ^3.0.0 | Python web framework |
| **Boto3** | Latest | AWS SDK for Python |
| **Pandas** | Latest | Data manipulation |
| **GitPython** | ^3.1.0 | GitHub integration |
| **Requests** | Latest | HTTP library |

### Infrastructure
| Technology | Purpose |
|------------|---------|
| **Docker** | Containerization |
| **Docker Compose** | Multi-container orchestration |
| **Git** | Version control |

### Cloud Providers
| Provider | Services Monitored |
|----------|-------------------|
| **AWS** | CloudWatch, Cost Explorer, EC2, RDS, Lambda, S3, ELB, SQS, SNS |
| **Azure** | Azure Monitor, Cost Management, VMs, SQL Database, Storage |
| **GCP** | Stackdriver, Compute Engine, Cloud Functions (Coming Soon) |

---

## 🏗️ Architecture

Cloud Pulse 360 follows a microservices architecture with 4 independent services:

```
┌────────────────────────────────────────────────────────────────┐
│                          Frontend                               │
│         (HTML/CSS/JS + Tailwind + Chart.js + Font Awesome)     │
│  ┌─────────────┬──────────────┬──────────────┬──────────────┐ │
│  │  Dashboard  │  Monitoring  │  Cost Report │  AI Agent    │ │
│  │  Synthetic  │  Automation  │  Alerts      │  Settings    │ │
│  └─────────────┴──────────────┴──────────────┴──────────────┘ │
└──────────────────────────────┬─────────────────────────────────┘
                               │ REST API (JWT Auth)
                               ▼
┌────────────────────────────────────────────────────────────────┐
│             Node Service (Main Backend - Port 8080)             │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │ • Authentication & Authorization (JWT, OAuth)            │ │
│  │ • User Management (SQLite Database)                      │ │
│  │ • Monitor CRUD Operations                                │ │
│  │ • Alert Configuration & Routing                          │ │
│  │ • Notification Management (Email, Slack, Teams)          │ │
│  │ • Dashboard & Metrics History                            │ │
│  │ • API Gateway & Request Routing                          │ │
│  └──────────────────────────────────────────────────────────┘ │
└────────┬──────────────────┬──────────────────┬────────────────┘
         │                  │                  │
         ▼                  ▼                  ▼
┌────────────────┐  ┌────────────────┐  ┌────────────────────┐
│  AWS Service   │  │  AI Service    │  │ Python Runner      │
│  (Port 8000)   │  │  (Port 9000)   │  │ (Port 5000)        │
│                │  │                │  │                    │
│ • CloudWatch   │  │ • Gemini AI    │  │ • Script Exec      │
│ • Cost Explorer│  │ • OpenAI GPT-4 │  │ • GitHub Clone     │
│ • EC2 Metrics  │  │ • Agent Engine │  │ • AWS Metrics      │
│ • RDS Metrics  │  │ • Anomaly Det. │  │ • Log Analysis     │
│ • Lambda Data  │  │ • RCA          │  │ • File Generation  │
│ • S3 Stats     │  │ • 4 Agents:    │  │ • Scheduled Jobs   │
│ • Credentials  │  │   - SRE        │  │                    │
│                │  │   - Monitor    │  │                    │
│                │  │   - Automation │  │                    │
│                │  │   - Knowledge  │  │                    │
└────────┬───────┘  └────────┬───────┘  └─────────┬──────────┘
         │                   │                     │
         └───────────────────┴─────────────────────┘
                             │
                             ▼
         ┌──────────────────────────────────────┐
         │         Cloud Providers              │
         │  AWS │ Azure │ GCP │ External APIs  │
         └──────────────────────────────────────┘
```

### Service Communication
- **Frontend ↔ Node Service**: REST API with JWT authentication
- **Node Service ↔ AWS Service**: HTTP proxy for AWS operations
- **Node Service ↔ AI Service**: REST API for AI insights
- **Node Service ↔ Python Runner**: REST API for script execution
- **All Services**: Docker network for inter-service communication

---

## 📁 Project Structure

```
Cloud-Pulse-360/
│
├── docker-compose.yml              # Multi-container orchestration
├── package.json                    # Root dependencies
├── .env                            # Environment variables (create this)
├── README.md                       # This file
│
├── docs/                           # Documentation
│   ├── tool_guide.md              # Feature documentation
│   ├── agent_integration_guide.md # AI Agent setup guide
│   ├── AI_AGENT_IMPLEMENTATION.md # AI implementation details
│   └── sample_agent_responses.json # Example AI responses
│
├── frontend/                       # Frontend Application (44 files)
│   │
│   ├── index.html                 # Login page (entry point)
│   ├── register.html              # User registration
│   ├── register.js
│   ├── register.css
│   ├── forgot-password.html       # Password recovery
│   ├── reset-password.html        # Password reset
│   ├── login.js                   # Login logic
│   │
│   ├── dashboard.html             # Main dashboard
│   ├── dashboard.js
│   ├── dashboard.css
│   │
│   ├── sidebar.js                 # Navigation sidebar (shared)
│   ├── sidebar.html               # Sidebar test page
│   ├── styles.css                 # Global styles
│   │
│   ├── synthetic.html             # Synthetic monitoring table
│   ├── synthetic.js
│   ├── synthetic.css
│   ├── synthetic_graph.html       # Synthetic graphs
│   ├── synthetic_graph.js
│   ├── synthetic_graph.css
│   │
│   ├── aws_dashboard.html         # Cloud integration (AWS/Azure setup)
│   ├── aws_dashboard.js
│   ├── aws_dashboard.css
│   │
│   ├── aws_infra_monitoring.html  # AWS infrastructure monitoring
│   ├── aws_infra_monitoring.js
│   ├── aws_infra_monitoring.css
│   │
│   ├── aws_monitor_graph.html     # AWS monitoring graphs
│   ├── aws_monitor_graph.js
│   ├── aws_monitor_graph.css
│   │
│   ├── aws_monitor_setup.html     # AWS monitor setup wizard (deprecated)
│   ├── aws_monitor_setup.js
│   │
│   ├── cost_report_aws.html       # AWS cost insights
│   ├── cost_report_aws.js
│   ├── cost_report_azure.html     # Azure cost insights
│   ├── cost_report_azure.js
│   ├── cost_report.css            # Shared cost report styles
│   │
│   ├── alert_management.html      # Alert management
│   ├── alert_management.js
│   ├── alert_management.css
│   │
│   ├── agent.html                 # AI Agent chat interface
│   ├── agent.js
│   ├── agent.css
│   │
│   ├── automation.html            # Automation & log analysis
│   ├── automation.js
│   └── automation.css
│
├── services/                       # Backend Microservices
│   │
│   ├── node-service/              # Main Backend (Port 8080 → 3000)
│   │   ├── Dockerfile
│   │   ├── package.json
│   │   ├── .env                   # Service-specific env vars
│   │   ├── database.sqlite        # SQLite database
│   │   │
│   │   └── src/
│   │       ├── index.js           # Express app entry point
│   │       │
│   │       ├── config/
│   │       │   └── passport.js    # OAuth configuration
│   │       │
│   │       ├── middleware/
│   │       │   └── auth.js        # JWT authentication
│   │       │
│   │       ├── models/            # Sequelize models (11 models)
│   │       │   ├── index.js       # Model initialization
│   │       │   ├── User.js
│   │       │   ├── Monitor.js
│   │       │   ├── History.js
│   │       │   ├── Notification.js
│   │       │   ├── Automation.js
│   │       │   ├── Dashboard.js
│   │       │   ├── ApiCredential.js
│   │       │   ├── AwsCredential.js
│   │       │   ├── AzureCredential.js
│   │       │   ├── SystemCredential.js
│   │       │   └── MetricsHistory.js
│   │       │
│   │       ├── controllers/       # Business logic (14 controllers)
│   │       │   ├── authController.js
│   │       │   ├── oauthController.js
│   │       │   ├── monitorController.js
│   │       │   ├── notificationController.js
│   │       │   ├── automationController.js
│   │       │   ├── dashboardsController.js
│   │       │   ├── awsCredentialController.js
│   │       │   ├── azureCredentialController.js
│   │       │   ├── azureCostController.js
│   │       │   ├── apiCredentialController.js
│   │       │   ├── systemCredentialController.js
│   │       │   ├── metricsHistoryController.js
│   │       │   ├── rcaController.js
│   │       │   └── agentController.js
│   │       │
│   │       ├── routes/            # API routes (16 route files)
│   │       │   ├── authRoutes.js
│   │       │   ├── oauthRoutes.js
│   │       │   ├── monitorRoutes.js
│   │       │   ├── notificationRoutes.js
│   │       │   ├── alertingRoutes.js
│   │       │   ├── automationRoutes.js
│   │       │   ├── dashboardsRoutes.js
│   │       │   ├── awsCredentialRoutes.js
│   │       │   ├── azureRoutesV2.js
│   │       │   ├── azureCostRoutes.js
│   │       │   ├── apiCredentialRoutes.js
│   │       │   ├── systemCredentialRoutes.js
│   │       │   ├── metricsHistoryRoutes.js
│   │       │   ├── rcaRoutes.js
│   │       │   ├── realAwsRoutes.js
│   │       │   └── agentRoutes.js
│   │       │
│   │       ├── services/          # Service layer (6 services)
│   │       │   ├── healthCheckService.js
│   │       │   ├── realAwsMonitoringService.js
│   │       │   ├── tokenRefreshService.js
│   │       │   ├── githubService.js
│   │       │   ├── agentOrchestrator.js
│   │       │   └── monitorSchemaService.js
│   │       │
│   │       └── utils/
│   │           └── seedAzureCredentials.js
│   │
│   ├── aws-service-js/            # AWS Integration (Port 8000)
│   │   ├── Dockerfile
│   │   ├── package.json
│   │   │
│   │   └── src/
│   │       ├── index.js           # Express app
│   │       │
│   │       ├── controllers/
│   │       │   ├── costController.js
│   │       │   └── credentialsController.js
│   │       │
│   │       ├── routes/
│   │       │   ├── costRoutes.js
│   │       │   ├── credentialsRoutes.js
│   │       │   ├── monitoringRoutes.js
│   │       │   └── realCloudWatchEndpoint.js
│   │       │
│   │       └── services/
│   │           └── costService.js
│   │
│   ├── ai-service/                # AI & ML Service (Port 9000)
│   │   ├── Dockerfile
│   │   ├── package.json           # Node dependencies
│   │   ├── requirements.txt       # Python dependencies
│   │   │
│   │   └── src/
│   │       ├── index.js           # Express app
│   │       ├── agentEngine.js     # Gemini AI integration
│   │       ├── anomaly_detection.py # ML anomaly detection
│   │       │
│   │       └── prompts/           # AI agent prompts
│   │           ├── agentSystemPrompt.txt
│   │           ├── srePrompt.txt
│   │           ├── monitorPrompt.txt
│   │           ├── automationPrompt.txt
│   │           └── knowledgePrompt.txt
│   │
│   └── python-runner/             # Python Execution Service (Port 5000)
│       ├── Dockerfile
│       ├── requirements.txt
│       ├── app.py                 # Flask application
│       └── metrics_collector.py   # AWS metrics collection
│
└── node_modules/                  # Dependencies (auto-generated)
```

### File Count Summary
- **Total Files**: 128
- **Frontend Files**: 44 (HTML: 14, JavaScript: 17, CSS: 13)
- **Backend Files**: 84
  - node-service: 48 files
  - aws-service-js: 8 files
  - ai-service: 9 files
  - python-runner: 4 files
  - Config files: 15 files

---

## 🚀 Installation

### Prerequisites

Before you begin, ensure you have the following installed:

- **Docker** (v20.x or higher) - [Install Docker](https://docs.docker.com/get-docker/)
- **Docker Compose** (v2.x or higher) - [Install Docker Compose](https://docs.docker.com/compose/install/)
- **Git** - [Install Git](https://git-scm.com/downloads)

### Optional (for AI features):
- **Google Gemini API Key** - [Get API Key](https://makersuite.google.com/app/apikey)
- **OpenAI API Key** - [Get API Key](https://platform.openai.com/api-keys)

### Step 1: Clone the Repository

```bash
git clone https://github.com/your-org/cloud-pulse-360.git
cd cloud-pulse-360
```

### Step 2: Create Environment Variables

Create a `.env` file in the root directory:

```bash
# Copy example environment file
cp .env.example .env

# Edit the .env file with your credentials
nano .env
```

**Required `.env` Configuration:**

```env
# ============================================
# JWT Configuration (Required)
# ============================================
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production

# ============================================
# AI Service Configuration (Required for AI features)
# ============================================
# Get your API key from: https://makersuite.google.com/app/apikey
GEMINI_API_KEY=your-google-gemini-api-key-here

# Optional: OpenAI API Key for GPT-4 integration
OPENAI_API_KEY=your-openai-api-key-here

# ============================================
# Email Notifications (Optional)
# ============================================
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-specific-password

# ============================================
# AWS Credentials (Optional - can be configured via UI)
# ============================================
AWS_ACCESS_KEY_ID=your-aws-access-key-id
AWS_SECRET_ACCESS_KEY=your-aws-secret-access-key
AWS_DEFAULT_REGION=us-east-1

# ============================================
# Azure Credentials (Optional - can be configured via UI)
# ============================================
AZURE_CLIENT_ID=your-azure-client-id
AZURE_CLIENT_SECRET=your-azure-client-secret
AZURE_TENANT_ID=your-azure-tenant-id
AZURE_SUBSCRIPTION_ID=your-azure-subscription-id

# ============================================
# OAuth Configuration (Optional)
# ============================================
GOOGLE_CLIENT_ID=your-google-oauth-client-id
GOOGLE_CLIENT_SECRET=your-google-oauth-client-secret
GOOGLE_CALLBACK_URL=http://localhost:8080/api/auth/google/callback

GITHUB_CLIENT_ID=your-github-oauth-client-id
GITHUB_CLIENT_SECRET=your-github-oauth-client-secret
GITHUB_CALLBACK_URL=http://localhost:8080/api/auth/github/callback

# ============================================
# Service Ports (Optional - defaults shown)
# ============================================
NODE_SERVICE_PORT=8080
AWS_SERVICE_PORT=8000
AI_SERVICE_PORT=9000
PYTHON_RUNNER_PORT=5000

# ============================================
# Database (Optional)
# ============================================
DB_PATH=./data/database.sqlite
```

### Step 3: Build and Start Services

```bash
# Build Docker images
docker-compose build

# Start all services in detached mode
docker-compose up -d

# View logs (optional)
docker-compose logs -f

# Check service status
docker-compose ps
```

**Expected Output:**
```
NAME                IMAGE                        STATUS         PORTS
ai-service          cloud-pulse-360-ai-service   Up            0.0.0.0:9000->9000/tcp
aws-service-js      cloud-pulse-360-aws-service  Up            0.0.0.0:8000->8000/tcp
node-service        cloud-pulse-360-node-service Up            0.0.0.0:8080->3000/tcp
python-runner       cloud-pulse-360-python       Up            0.0.0.0:5000->5000/tcp
```

### Step 4: Access the Application

- **Frontend Application**: http://localhost:8080
- **Node Service API**: http://localhost:8080/api
- **AWS Service API**: http://localhost:8000
- **AI Service API**: http://localhost:9000
- **Python Runner API**: http://localhost:5000

### Step 5: Initial Setup

#### 1. Register a User Account
- Navigate to: http://localhost:8080/register.html
- Fill in:
  - Username
  - Email
  - Password
- Click **Register**
- You'll be redirected to the login page

#### 2. Log In
- Navigate to: http://localhost:8080 (or http://localhost:8080/index.html)
- Enter your credentials
- Click **Login**
- You'll be redirected to the Dashboard

#### 3. Configure Cloud Credentials (Optional but Recommended)
- Click **Cloud Integration** in the sidebar
- Add AWS credentials:
  - Access Key ID
  - Secret Access Key
  - Default Region (e.g., us-east-1)
- Add Azure credentials (if using Azure):
  - Client ID
  - Client Secret
  - Tenant ID
  - Subscription ID
- Click **Save Credentials**
- Test connection by clicking **Test Connection**

#### 4. Create Your First Monitor
- Click **Synthetic Monitoring** in the sidebar
- Click **+ Create Monitor**
- Fill in:
  - Monitor Name (e.g., "Google Homepage")
  - URL (e.g., https://www.google.com)
  - Check Interval (e.g., 5 minutes)
- Click **Create**
- Monitor will start checking immediately

#### 5. Explore AI Agent (if Gemini API key is configured)
- Click **AI Agent** in the sidebar
- Try example prompts:
  - "Analyze EC2 CPU utilization above 80%"
  - "Create CPU alert for EC2 above 70%"
  - "What is the difference between ECS and EKS?"
- Select different agent modes (SRE, Monitor, Automation, Knowledge)

---

## ⚙️ Configuration

### Environment Variables Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `JWT_SECRET` | **Yes** | - | Secret key for JWT token signing (change in production) |
| `GEMINI_API_KEY` | No* | - | Google Gemini API key (required for AI features) |
| `OPENAI_API_KEY` | No | - | OpenAI API key (alternative to Gemini) |
| `EMAIL_HOST` | No | - | SMTP server hostname (e.g., smtp.gmail.com) |
| `EMAIL_PORT` | No | 587 | SMTP server port |
| `EMAIL_USER` | No | - | Email account for sending notifications |
| `EMAIL_PASSWORD` | No | - | Email account password or app-specific password |
| `AWS_ACCESS_KEY_ID` | No | - | AWS access key (can be set via UI) |
| `AWS_SECRET_ACCESS_KEY` | No | - | AWS secret key (can be set via UI) |
| `AWS_DEFAULT_REGION` | No | us-east-1 | Default AWS region |
| `AZURE_CLIENT_ID` | No | - | Azure service principal client ID |
| `AZURE_CLIENT_SECRET` | No | - | Azure service principal secret |
| `AZURE_TENANT_ID` | No | - | Azure Active Directory tenant ID |
| `AZURE_SUBSCRIPTION_ID` | No | - | Azure subscription ID |
| `NODE_SERVICE_PORT` | No | 8080 | Node service external port |
| `AWS_SERVICE_PORT` | No | 8000 | AWS service external port |
| `AI_SERVICE_PORT` | No | 9000 | AI service external port |
| `PYTHON_RUNNER_PORT` | No | 5000 | Python runner external port |
| `DB_PATH` | No | /app/data/database.sqlite | SQLite database file path |

**Note**: *GEMINI_API_KEY is required only if you want to use AI Agent features.

### Docker Compose Configuration

The `docker-compose.yml` file defines 4 services:

```yaml
services:
  node-service:      # Main backend (Port 8080 → 3000)
  aws-service-js:    # AWS integration (Port 8000)
  ai-service:        # AI/ML service (Port 9000)
  python-runner:     # Script execution (Port 5000)
```

### Managing Services

```bash
# Stop all services
docker-compose stop

# Start all services
docker-compose start

# Restart all services
docker-compose restart

# Stop and remove containers
docker-compose down

# Stop, remove containers, and delete volumes (WARNING: deletes database)
docker-compose down -v

# View logs for specific service
docker-compose logs -f node-service

# Execute command in running container
docker-compose exec node-service sh
```

---

## 📖 Usage Guide

### 1. Dashboard
**URL**: `/dashboard.html`

**Features**:
- View total monitors and outages
- Azure subscription cost summary
- Quick navigation tiles

**Use Cases**:
- Daily health check of all services
- Quick cost overview

---

### 2. Synthetic Monitoring
**URL**: `/synthetic.html`

**Features**:
- Create HTTP/HTTPS endpoint monitors
- View monitor status (UP/DOWN)
- Track response times
- View historical graphs
- Edit/Delete monitors

**Create Monitor Steps**:
1. Click **+ Create Monitor**
2. Enter monitor details:
   - Name (e.g., "API Health Check")
   - URL (e.g., https://api.example.com/health)
   - Method: GET/POST
   - Check Interval: 1, 5, 10, 15, 30 minutes
   - Timeout: 5-60 seconds
3. (Optional) Add authentication:
   - Basic Auth (username/password)
   - Bearer Token
   - API Key
4. (Optional) Configure notifications
5. Click **Create**

**View Graphs**:
- Click graph icon on any monitor
- View response time trends
- Analyze status code distribution

---

### 3. Cloud Integration
**URL**: `/aws_dashboard.html`

**Features**:
- Configure AWS credentials
- Configure Azure credentials
- Test cloud connectivity
- Edit/Delete credentials

**AWS Setup**:
1. Go to AWS IAM Console
2. Create user with permissions:
   - CloudWatch: Read
   - Cost Explorer: Read
   - EC2: Describe*
   - RDS: Describe*
   - Lambda: List*, Get*
   - S3: ListBucket, GetObject
3. Generate Access Key
4. Enter credentials in Cloud Pulse 360
5. Click **Test Connection**

**Azure Setup**:
1. Go to Azure Portal → Azure Active Directory
2. Create App Registration
3. Create Client Secret
4. Assign **Reader** role to subscription
5. Enter credentials in Cloud Pulse 360

---

### 4. AWS Infrastructure Monitoring
**URL**: `/aws_infra_monitoring.html`

**Features**:
- Monitor EC2, RDS, Lambda, S3, ELB
- Real-time CloudWatch metrics
- Interactive charts
- Time range selection (1h, 6h, 24h, 7d, 30d, custom)
- Add/Remove monitors

**Setup**:
1. Configure AWS credentials in Cloud Integration
2. Navigate to AWS Infrastructure Monitoring
3. Select resource type (EC2, RDS, Lambda, etc.)
4. Choose metric (CPU, Memory, Disk, Network, etc.)
5. Select time range
6. Click **Add Monitor**

**Viewing Graphs**:
- Click graph icon on any monitor
- View detailed metric charts
- Compare multiple metrics

---

### 5. AWS Cost Insights
**URL**: `/cost_report_aws.html`

**Features**:
- Service-wise cost breakdown
- Time range filtering
- Cost trends charts
- Top 10 expensive services
- Export to CSV

**Use Cases**:
- Track monthly cloud spending
- Identify cost spikes
- Optimize resource allocation

---

### 6. Azure Cost Insights
**URL**: `/cost_report_azure.html`

**Features**:
- Subscription cost overview
- Resource group cost allocation
- Meter category breakdown
- Reserved instance coverage

---

### 7. AI Agent
**URL**: `/agent.html`

**Features**:
- 4 specialized agent modes
- Conversational interface
- Context-aware responses
- Export conversation history

**Agent Modes**:

1. **🛡️ SRE Assistant**:
   - Root cause analysis
   - Anomaly detection
   - Remediation suggestions
   - Example: "Analyze EC2 CPU above 80%"

2. **📈 Monitor Creation**:
   - Natural language to CloudWatch alarm
   - Multi-turn configuration gathering
   - Example: "Create CPU alert for EC2 above 70%"

3. **🤖 Automation Agent**:
   - Automation workflow design
   - Safe approval gates
   - Example: "Restart EC2 if CPU stuck for 10 minutes"

4. **📚 Knowledge Assistant**:
   - SRE/DevOps Q&A
   - Best practices
   - Example: "What's the difference between ECS and EKS?"

---

### 8. Automation
**URL**: `/automation.html`

**Features**:
- Execute custom Python scripts
- GitHub integration
- Log file analysis
- File generation
- Execution history

**Create Automation**:
1. Click **+ Create Automation**
2. Enter automation details:
   - Name
   - Description
   - Script source:
     - **Inline**: Paste Python code
     - **GitHub**: Enter repo URL
3. Add environment variables (optional)
4. Click **Create**

**Execute Automation**:
1. Find automation in table
2. Click **Execute** button
3. View output in modal

---

### 9. Alert Management
**URL**: `/alert_management.html`

**Features**:
- Configure notification channels (Email, Slack, Teams, Webhook)
- Create alert rules
- View alert history
- Test notifications

**Setup Email Notifications**:
1. Configure `EMAIL_*` variables in `.env`
2. Navigate to Alert Management
3. Create notification channel:
   - Name: "Admin Email"
   - Type: Email
   - Recipient: admin@example.com
4. Click **Save**
5. Click **Test** to verify

---

## 🔌 API Documentation

### Authentication

All API endpoints (except `/api/auth/*`) require JWT authentication.

**Headers**:
```http
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

### Authentication Endpoints

```http
POST /api/register
Content-Type: application/json

{
  "username": "string",
  "email": "string",
  "password": "string"
}

Response 201:
{
  "message": "User registered successfully"
}
```

```http
POST /api/login
Content-Type: application/json

{
  "username": "string",
  "password": "string"
}

Response 200:
{
  "token": "jwt_token_here",
  "user": {
    "id": 1,
    "username": "string",
    "email": "string"
  }
}
```

### Monitor Endpoints

```http
GET /api/monitors
Authorization: Bearer <token>

Response 200:
[
  {
    "id": "uuid",
    "name": "string",
    "url": "string",
    "method": "GET",
    "status": "UP",
    "responseTime": 123,
    "lastChecked": "2025-11-18T12:00:00Z"
  }
]
```

```http
POST /api/monitors
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "string",
  "url": "string",
  "method": "GET|POST|PUT|DELETE",
  "interval": 300,
  "timeout": 30,
  "expectedStatusCode": 200,
  "headers": {},
  "authentication": {
    "type": "none|basic|bearer|api_key",
    "credentials": {}
  }
}

Response 201:
{
  "id": "uuid",
  "message": "Monitor created successfully"
}
```

### AWS Integration Endpoints

```http
GET /api/real-aws/metrics
Authorization: Bearer <token>
Query Parameters:
  - namespace: AWS/EC2|AWS/RDS|AWS/Lambda
  - metricName: CPUUtilization|NetworkIn|etc
  - dimensions: [{"Name": "InstanceId", "Value": "i-12345"}]
  - startTime: ISO8601 timestamp
  - endTime: ISO8601 timestamp
  - period: 300 (seconds)

Response 200:
{
  "Label": "CPUUtilization",
  "Datapoints": [
    {
      "Timestamp": "2025-11-18T12:00:00Z",
      "Average": 45.5,
      "Unit": "Percent"
    }
  ]
}
```

### AI Agent Endpoints

```http
POST /api/agent/ask
Authorization: Bearer <token>
Content-Type: application/json

{
  "prompt": "string",
  "agentType": "sre|monitor|automation|knowledge",
  "conversationHistory": [
    {
      "role": "user",
      "content": "string"
    }
  ]
}

Response 200:
{
  "type": "sre",
  "summary": "string",
  "root_cause": "string",
  "remediation_steps": ["string"],
  "code_blocks": [
    {
      "title": "string",
      "language": "bash",
      "content": "string"
    }
  ],
  "ui_hints": {
    "resource": "string",
    "metric": "string",
    "threshold": "string"
  }
}
```

### Automation Endpoints

```http
POST /api/automations/:id/execute
Authorization: Bearer <token>

Response 200:
{
  "status": "success",
  "output": "string",
  "execution_time": 1234,
  "files_generated": ["file1.txt"]
}
```

---

## 🤝 Contributing

We welcome contributions from the community! Here's how you can help:

### Reporting Issues

1. Check existing issues to avoid duplicates
2. Create a new issue with:
   - Clear title
   - Detailed description
   - Steps to reproduce (for bugs)
   - Expected vs actual behavior
   - Screenshots (if applicable)

### Submitting Pull Requests

1. **Fork the repository**
```bash
git clone https://github.com/your-username/cloud-pulse-360.git
cd cloud-pulse-360
```

2. **Create a feature branch**
```bash
git checkout -b feature/amazing-feature
```

3. **Make your changes**
   - Follow existing code style
   - Add comments for complex logic
   - Update documentation if needed

4. **Test your changes**
```bash
docker-compose down
docker-compose up --build
```

5. **Commit your changes**
```bash
git add .
git commit -m "Add amazing feature"
```

6. **Push to your fork**
```bash
git push origin feature/amazing-feature
```

7. **Open a Pull Request**
   - Provide clear description of changes
   - Reference related issues
   - Include screenshots (for UI changes)

### Development Guidelines

- **Code Style**: Follow existing conventions
- **Commit Messages**: Use clear, descriptive messages
- **Documentation**: Update README and comments
- **Testing**: Test locally before submitting PR
- **Security**: Never commit `.env` files or secrets

---

## 📄 License

This project is licensed under the **MIT License**.

```
MIT License

Copyright (c) 2025 Cloud Pulse 360

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

## 📞 Support & Contact

### Documentation
- **Tool Guide**: [docs/tool_guide.md](docs/tool_guide.md)
- **AI Agent Guide**: [docs/AI_AGENT_IMPLEMENTATION.md](docs/AI_AGENT_IMPLEMENTATION.md)
- **Module Structure**: [Module Folder Struture.md](Module%20Folder%20Struture.md)

### Get Help
- **GitHub Issues**: [Report bugs or request features](https://github.com/your-org/cloud-pulse-360/issues)
- **Discussions**: [Join community discussions](https://github.com/your-org/cloud-pulse-360/discussions)
- **Email**: support@cloudpulse360.com

### Social
- **Twitter**: @CloudPulse360
- **LinkedIn**: Cloud Pulse 360

---

## 🙏 Acknowledgments

Cloud Pulse 360 is built with amazing open-source technologies:

- **[Google Gemini AI](https://ai.google.dev/)** - Intelligent insights and conversational AI
- **[OpenAI GPT-4](https://openai.com/)** - Alternative AI integration
- **[AWS SDK](https://aws.amazon.com/sdk-for-javascript/)** - Comprehensive AWS integration
- **[Chart.js](https://www.chartjs.org/)** - Beautiful data visualizations
- **[Tailwind CSS](https://tailwindcss.com/)** - Utility-first CSS framework
- **[Font Awesome](https://fontawesome.com/)** - Icon library
- **[Express.js](https://expressjs.com/)** - Web framework
- **[Sequelize](https://sequelize.org/)** - ORM for Node.js
- **[Docker](https://www.docker.com/)** - Containerization platform
- **[Flask](https://flask.palletsprojects.com/)** - Python web framework

Special thanks to all contributors and the open-source community! 💙

---

## 🗺️ Roadmap

### Upcoming Features
- [ ] **GCP Integration**: Google Cloud Platform monitoring
- [ ] **Kubernetes Monitoring**: Pod, node, and cluster monitoring
- [ ] **Custom Dashboards**: Drag-and-drop dashboard builder
- [ ] **Mobile App**: iOS and Android monitoring apps
- [ ] **Slack Bot**: Interactive Slack integration
- [ ] **RBAC**: Advanced role-based access control
- [ ] **Multi-Tenancy**: Team workspaces and isolation
- [ ] **SSO Integration**: SAML/OIDC authentication
- [ ] **Audit Logs**: Comprehensive activity tracking
- [ ] **API Rate Limiting**: Protection against abuse
- [ ] **Webhook Integrations**: PagerDuty, Opsgenie, ServiceNow
- [ ] **Cost Anomaly Detection**: AI-powered cost alerts
- [ ] **Performance Baselines**: Automatic baseline establishment
- [ ] **Incident Management**: Built-in incident response workflows

---

<div align="center">

**Cloud Pulse 360** - *Monitor Smarter, Scale Faster* 🚀

[![Docker](https://img.shields.io/badge/docker-ready-blue?logo=docker)](https://www.docker.com/)
[![AI Powered](https://img.shields.io/badge/AI-powered-purple?logo=google)](https://ai.google.dev/)
[![Open Source](https://img.shields.io/badge/open-source-green?logo=github)](https://github.com/)

Built with ❤️ by the Cloud Pulse 360 Team

[⭐ Star on GitHub](https://github.com/your-org/cloud-pulse-360) | [📖 Documentation](docs/) | [🐛 Report Bug](https://github.com/your-org/cloud-pulse-360/issues) | [💡 Request Feature](https://github.com/your-org/cloud-pulse-360/issues)

</div>

