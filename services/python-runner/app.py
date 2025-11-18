from flask import Flask, request, jsonify
import subprocess
import os
import boto3
from datetime import datetime, timedelta
import threading
import time
import tempfile
import shutil
from pathlib import Path
try:
    import git
except ImportError:
    git = None
    print("Warning: GitPython not installed. GitHub integration will not work.")

from metrics_collector import metrics_collector, start_collection_thread

app = Flask(__name__)

# Start the metrics collection thread when the app starts
collection_thread = None


@app.route('/execute', methods=['POST'])
def execute_script():
    data = request.json
    script = data.get('script')
    credentials = data.get('credentials', {})

    if not script:
        return jsonify({"error": "No script provided"}), 400

    env = os.environ.copy()
    env['AWS_ACCESS_KEY_ID'] = credentials.get('aws_access_key_id')
    env['AWS_SECRET_ACCESS_KEY'] = credentials.get('aws_secret_access_key')
    env['AWS_DEFAULT_REGION'] = credentials.get('aws_default_region')

    try:
        result = subprocess.run(
            ['python', '-c', script],
            capture_output=True,
            text=True,
            env=env,
            timeout=300 # 5 minute timeout
        )
        
        output_data = {
            "output": result.stdout,
            "stderr": result.stderr,
            "returncode": result.returncode,
            "generated_files": {}
        }
        
        if result.returncode != 0:
            return jsonify({**output_data, "error": result.stderr}), 500
        
        return jsonify(output_data)

    except subprocess.TimeoutExpired:
        return jsonify({"error": "Script execution timed out"}), 500
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/execute-github', methods=['POST'])
def execute_github_script():
    """
    Execute a Python script from a GitHub repository
    Supports multi-file projects with dependencies
    """
    if git is None:
        return jsonify({"error": "GitPython not installed"}), 500
    
    data = request.json
    repo_url = data.get('repo_url')  # https://github.com/user/repo.git
    branch = data.get('branch', 'main')
    script_path = data.get('script_path')  # scripts/main.py or scripts/
    github_token = data.get('github_token')  # Optional for private repos
    credentials = data.get('credentials', {})
    env_vars = data.get('env_vars', {})
    
    if not repo_url or not script_path:
        return jsonify({"error": "repo_url and script_path required"}), 400
    
    # Create temporary workspace
    workspace = tempfile.mkdtemp(prefix='automation_')
    start_time = datetime.now()
    
    try:
        # Clone repository
        print(f"Cloning {repo_url} (branch: {branch})...")
        
        if github_token:
            # Inject token for private repos
            if 'github.com' in repo_url:
                auth_url = repo_url.replace('https://', f'https://{github_token}@')
            else:
                auth_url = repo_url
            git.Repo.clone_from(auth_url, workspace, branch=branch, depth=1)
        else:
            git.Repo.clone_from(repo_url, workspace, branch=branch, depth=1)
        
        # Determine script to execute
        full_script_path = os.path.join(workspace, script_path)
        
        # If path is a directory, look for main.py
        if os.path.isdir(full_script_path):
            main_py = os.path.join(full_script_path, 'main.py')
            if os.path.exists(main_py):
                full_script_path = main_py
            else:
                return jsonify({
                    "error": f"No main.py found in directory: {script_path}"
                }), 404
        
        if not os.path.exists(full_script_path):
            return jsonify({
                "error": f"Script not found: {script_path}"
            }), 404
        
        # Check for requirements.txt in root or script directory
        requirements_paths = [
            os.path.join(workspace, 'requirements.txt'),
            os.path.join(os.path.dirname(full_script_path), 'requirements.txt')
        ]
        
        requirements_path = None
        for req_path in requirements_paths:
            if os.path.exists(req_path):
                requirements_path = req_path
                break
        
        venv_path = os.path.join(workspace, 'venv')
        python_executable = 'python'
        
        if requirements_path:
            print(f"Installing dependencies from {requirements_path}...")
            
            try:
                # Create virtual environment
                subprocess.run([
                    'python', '-m', 'venv', venv_path
                ], check=True, capture_output=True)
                
                # Determine pip and python executables
                if os.name == 'nt':  # Windows
                    pip_executable = os.path.join(venv_path, 'Scripts', 'pip.exe')
                    python_executable = os.path.join(venv_path, 'Scripts', 'python.exe')
                else:  # Unix/Linux
                    pip_executable = os.path.join(venv_path, 'bin', 'pip')
                    python_executable = os.path.join(venv_path, 'bin', 'python')
                
                # Install dependencies
                install_result = subprocess.run([
                    pip_executable, 'install', '-r', requirements_path
                ], capture_output=True, text=True, timeout=300)
                
                if install_result.returncode != 0:
                    print(f"Warning: Some dependencies failed to install:\n{install_result.stderr}")
                
            except Exception as e:
                print(f"Warning: Failed to setup virtual environment: {e}")
                python_executable = 'python'
        
        # Prepare environment variables
        env = os.environ.copy()
        env.update({
            'AWS_ACCESS_KEY_ID': credentials.get('aws_access_key_id', ''),
            'AWS_SECRET_ACCESS_KEY': credentials.get('aws_secret_access_key', ''),
            'AWS_DEFAULT_REGION': credentials.get('aws_default_region', 'us-east-1'),
            'PYTHONPATH': workspace  # Allow imports from repo root
        })
        
        # Add custom environment variables
        if env_vars:
            env.update(env_vars)
        
        # Execute the script
        print(f"Executing {script_path}...")
        result = subprocess.run(
            [python_executable, full_script_path],
            capture_output=True,
            text=True,
            env=env,
            timeout=600,  # 10 minute timeout
            cwd=workspace  # Run from repo root
        )
        
        execution_time = (datetime.now() - start_time).total_seconds()
        
        # Scan workspace for generated files (Excel, CSV, JSON, TXT)
        generated_files = {}
        file_extensions = ['.xlsx', '.xls', '.csv', '.json', '.txt']
        
        try:
            import base64
            for root, dirs, files in os.walk(workspace):
                # Skip venv and git directories
                dirs[:] = [d for d in dirs if d not in ['.git', 'venv', '__pycache__']]
                
                for file in files:
                    if any(file.lower().endswith(ext) for ext in file_extensions):
                        file_path = os.path.join(root, file)
                        try:
                            # Read file as binary
                            with open(file_path, 'rb') as f:
                                file_content = f.read()
                            
                            # Encode as base64
                            encoded_content = base64.b64encode(file_content).decode('utf-8')
                            
                            # Get file stats
                            file_stats = os.stat(file_path)
                            
                            generated_files[file] = {
                                'content': encoded_content,
                                'size': file_stats.st_size,
                                'type': os.path.splitext(file)[1][1:].upper(),
                                'created': datetime.fromtimestamp(file_stats.st_ctime).isoformat()
                            }
                            
                            print(f"Captured file: {file} ({file_stats.st_size} bytes)")
                        except Exception as e:
                            print(f"Warning: Failed to read file {file}: {e}")
        except Exception as e:
            print(f"Warning: Failed to scan for generated files: {e}")
        
        output_data = {
            "output": result.stdout,
            "stderr": result.stderr,
            "returncode": result.returncode,
            "execution_time": execution_time,
            "generated_files": generated_files
        }
        
        if result.returncode != 0:
            return jsonify({
                **output_data,
                "error": "Script execution failed"
            }), 500
        
        return jsonify(output_data)
    
    except git.exc.GitCommandError as e:
        return jsonify({
            "error": f"Git error: {str(e)}",
            "hint": "Check repository URL, branch name, and access permissions"
        }), 400
    
    except subprocess.TimeoutExpired:
        return jsonify({
            "error": "Script execution timed out (10 minutes)"
        }), 500
    
    except Exception as e:
        return jsonify({
            "error": f"Execution failed: {str(e)}"
        }), 500
    
    finally:
        # Cleanup temporary workspace
        try:
            shutil.rmtree(workspace, ignore_errors=True)
        except Exception as e:
            print(f"Failed to cleanup workspace: {e}")

@app.route('/metrics/start', methods=['POST'])
def start_metrics_collection():
    """Start the automated metrics collection"""
    global collection_thread
    
    try:
        if collection_thread and collection_thread.is_alive():
            return jsonify({
                "message": "Metrics collection is already running",
                "status": "running"
            }), 200
        
        # Configure AWS credentials if provided
        data = request.json or {}
        aws_creds = data.get('aws_credentials')
        
        if aws_creds:
            success = metrics_collector.initialize_aws_clients(
                aws_creds.get('aws_access_key_id'),
                aws_creds.get('aws_secret_access_key'),
                aws_creds.get('aws_default_region', 'us-east-1')
            )
            
            if not success:
                return jsonify({"error": "Failed to initialize AWS credentials"}), 400
        
        # Start collection thread
        collection_thread = start_collection_thread()
        
        return jsonify({
            "message": "Metrics collection started successfully",
            "status": "started",
            "collection_interval_minutes": metrics_collector.collection_interval,
            "timestamp": datetime.utcnow().isoformat()
        }), 200
        
    except Exception as e:
        return jsonify({"error": f"Failed to start metrics collection: {str(e)}"}), 500

@app.route('/metrics/stop', methods=['POST'])
def stop_metrics_collection():
    """Stop the automated metrics collection"""
    try:
        metrics_collector.stop_collection()
        
        return jsonify({
            "message": "Metrics collection stopped successfully",
            "status": "stopped",
            "timestamp": datetime.utcnow().isoformat()
        }), 200
        
    except Exception as e:
        return jsonify({"error": f"Failed to stop metrics collection: {str(e)}"}), 500

@app.route('/metrics/status', methods=['GET'])
def get_metrics_collection_status():
    """Get the current status of metrics collection"""
    try:
        status = metrics_collector.get_collection_status()
        status['thread_alive'] = collection_thread.is_alive() if collection_thread else False
        
        return jsonify(status), 200
        
    except Exception as e:
        return jsonify({"error": f"Failed to get status: {str(e)}"}), 500

@app.route('/metrics/collect-now', methods=['POST'])
def collect_metrics_now():
    """Trigger an immediate metrics collection"""
    try:
        # Configure AWS credentials if provided
        data = request.json or {}
        aws_creds = data.get('aws_credentials')
        
        if aws_creds:
            success = metrics_collector.initialize_aws_clients(
                aws_creds.get('aws_access_key_id'),
                aws_creds.get('aws_secret_access_key'),
                aws_creds.get('aws_default_region', 'us-east-1')
            )
            
            if not success:
                return jsonify({"error": "Failed to initialize AWS credentials"}), 400
        
        # Run immediate collection
        success = metrics_collector.collect_all_metrics()
        
        if success:
            return jsonify({
                "message": "Metrics collection completed successfully",
                "status": "completed",
                "timestamp": datetime.utcnow().isoformat(),
                "statistics": metrics_collector.collection_stats
            }), 200
        else:
            return jsonify({
                "error": "Metrics collection failed",
                "statistics": metrics_collector.collection_stats
            }), 500
            
    except Exception as e:
        return jsonify({"error": f"Failed to collect metrics: {str(e)}"}), 500

@app.route('/metrics/configure', methods=['POST'])
def configure_metrics_collection():
    """Configure metrics collection parameters"""
    try:
        data = request.json or {}
        
        # Update collection intervals if provided
        if 'collection_interval_minutes' in data:
            metrics_collector.collection_interval = int(data['collection_interval_minutes'])
        
        if 'anomaly_check_interval_minutes' in data:
            metrics_collector.anomaly_check_interval = int(data['anomaly_check_interval_minutes'])
        
        # Update service URLs if provided
        if 'node_service_url' in data:
            metrics_collector.node_service_url = data['node_service_url']
            
        if 'ai_service_url' in data:
            metrics_collector.ai_service_url = data['ai_service_url']
        
        return jsonify({
            "message": "Configuration updated successfully",
            "configuration": {
                "collection_interval_minutes": metrics_collector.collection_interval,
                "anomaly_check_interval_minutes": metrics_collector.anomaly_check_interval,
                "node_service_url": metrics_collector.node_service_url,
                "ai_service_url": metrics_collector.ai_service_url
            }
        }), 200
        
    except Exception as e:
        return jsonify({"error": f"Failed to update configuration: {str(e)}"}), 500

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    try:
        status = {
            "service": "python-runner",
            "status": "healthy",
            "timestamp": datetime.utcnow().isoformat(),
            "metrics_collector": {
                "initialized": metrics_collector is not None,
                "running": metrics_collector.is_running if metrics_collector else False,
                "aws_clients": metrics_collector.cloudwatch_client is not None if metrics_collector else False
            }
        }
        
        return jsonify(status), 200
        
    except Exception as e:
        return jsonify({
            "service": "python-runner",
            "status": "unhealthy",
            "error": str(e),
            "timestamp": datetime.utcnow().isoformat()
        }), 500

if __name__ == '__main__':
    # Create logs directory if it doesn't exist
    os.makedirs('/app/logs', exist_ok=True)
    
    print("Starting Python Runner with Metrics Collection and GitHub Integration...")
    print("Available endpoints:")
    print("  POST /execute - Execute Python scripts (inline)")
    print("  POST /execute-github - Execute scripts from GitHub repositories")
    print("  POST /metrics/start - Start automated metrics collection")
    print("  POST /metrics/stop - Stop metrics collection")
    print("  GET /metrics/status - Get collection status")
    print("  POST /metrics/collect-now - Trigger immediate collection")
    print("  POST /metrics/configure - Configure collection parameters")
    print("  GET /health - Health check")
    
    if git:
        print("✅ GitHub integration enabled")
    else:
        print("⚠️  GitHub integration disabled (GitPython not installed)")
    
    app.run(host='0.0.0.0', port=5000, debug=False)
