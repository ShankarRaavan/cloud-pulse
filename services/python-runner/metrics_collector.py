"""
AWS Metrics Collection Automation
Collects metrics from AWS CloudWatch and stores them in the database
Runs as a background service with configurable intervals
"""

import boto3
import json
import logging
import time
import threading
import requests
from datetime import datetime, timedelta
from botocore.exceptions import ClientError, NoCredentialsError
import schedule
import sys
import os

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('/app/logs/metrics_collector.log'),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger('MetricsCollector')

class AWSMetricsCollector:
    def __init__(self):
        self.cloudwatch_client = None
        self.ec2_client = None
        self.rds_client = None
        self.lambda_client = None
        self.s3_client = None
        
        self.node_service_url = os.getenv('NODE_SERVICE_URL', 'http://node-service:3000')
        self.ai_service_url = os.getenv('AI_SERVICE_URL', 'http://ai-service:9000')
        
        self.collection_interval = int(os.getenv('COLLECTION_INTERVAL_MINUTES', 5))
        self.anomaly_check_interval = int(os.getenv('ANOMALY_CHECK_INTERVAL_MINUTES', 15))
        
        self.is_running = False
        self.last_collection_time = None
        self.collection_stats = {
            'total_collections': 0,
            'successful_collections': 0,
            'failed_collections': 0,
            'last_error': None
        }
        
    def initialize_aws_clients(self, aws_access_key_id, aws_secret_access_key, region='us-east-1'):
        """Initialize AWS clients with provided credentials"""
        try:
            session = boto3.Session(
                aws_access_key_id=aws_access_key_id,
                aws_secret_access_key=aws_secret_access_key,
                region_name=region
            )
            
            self.cloudwatch_client = session.client('cloudwatch')
            self.ec2_client = session.client('ec2')
            self.rds_client = session.client('rds')
            self.lambda_client = session.client('lambda')
            self.s3_client = session.client('s3')
            
            # Test connectivity
            self.cloudwatch_client.list_metrics(MaxRecords=1)
            logger.info(f"Successfully initialized AWS clients for region: {region}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to initialize AWS clients: {e}")
            return False
    
    def get_aws_credentials_from_node_service(self):
        """Retrieve AWS credentials from node-service"""
        try:
            response = requests.get(f"{self.node_service_url}/api/aws-credentials")
            if response.status_code == 200:
                creds = response.json()
                if creds:
                    return {
                        'aws_access_key_id': creds.get('aws_access_key_id'),
                        'aws_secret_access_key': creds.get('aws_secret_access_key'),
                        'region': creds.get('aws_default_region', 'us-east-1')
                    }
            return None
        except Exception as e:
            logger.error(f"Failed to get AWS credentials: {e}")
            return None

    def collect_ec2_metrics(self, start_time, end_time):
        """Collect EC2 metrics from CloudWatch"""
        metrics = []
        
        try:
            # Get EC2 instances
            ec2_response = self.ec2_client.describe_instances()
            instances = []
            
            for reservation in ec2_response['Reservations']:
                for instance in reservation['Instances']:
                    if instance['State']['Name'] == 'running':
                        instances.append({
                            'InstanceId': instance['InstanceId'],
                            'InstanceType': instance.get('InstanceType'),
                            'Tags': {tag['Key']: tag['Value'] for tag in instance.get('Tags', [])}
                        })
            
            # Collect CPU utilization for each instance
            for instance in instances:
                instance_id = instance['InstanceId']
                resource_name = instance['Tags'].get('Name', f"EC2-{instance_id}")
                
                try:
                    response = self.cloudwatch_client.get_metric_statistics(
                        Namespace='AWS/EC2',
                        MetricName='CPUUtilization',
                        Dimensions=[
                            {
                                'Name': 'InstanceId',
                                'Value': instance_id
                            }
                        ],
                        StartTime=start_time,
                        EndTime=end_time,
                        Period=300,  # 5 minutes
                        Statistics=['Average', 'Maximum']
                    )
                    
                    for datapoint in response['Datapoints']:
                        metrics.extend([
                            {
                                'source': 'aws',
                                'service': 'ec2',
                                'resourceId': instance_id,
                                'resourceName': resource_name,
                                'region': self.cloudwatch_client.meta.region_name,
                                'metricName': 'CPUUtilization',
                                'metricUnit': 'Percent',
                                'metricValue': datapoint['Average'],
                                'timestamp': datapoint['Timestamp'].isoformat(),
                                'period': 300,
                                'statistic': 'Average',
                                'dimensions': {'InstanceId': instance_id},
                                'tags': instance['Tags']
                            },
                            {
                                'source': 'aws',
                                'service': 'ec2',
                                'resourceId': instance_id,
                                'resourceName': resource_name,
                                'region': self.cloudwatch_client.meta.region_name,
                                'metricName': 'CPUUtilizationMax',
                                'metricUnit': 'Percent',
                                'metricValue': datapoint['Maximum'],
                                'timestamp': datapoint['Timestamp'].isoformat(),
                                'period': 300,
                                'statistic': 'Maximum',
                                'dimensions': {'InstanceId': instance_id},
                                'tags': instance['Tags']
                            }
                        ])
                        
                except ClientError as e:
                    logger.warning(f"Failed to get CPU metrics for instance {instance_id}: {e}")
                    
            logger.info(f"Collected {len(metrics)} EC2 metrics")
            
        except Exception as e:
            logger.error(f"Error collecting EC2 metrics: {e}")
            
        return metrics

    def collect_rds_metrics(self, start_time, end_time):
        """Collect RDS metrics from CloudWatch"""
        metrics = []
        
        try:
            # Get RDS instances
            rds_response = self.rds_client.describe_db_instances()
            
            for db_instance in rds_response['DBInstances']:
                if db_instance['DBInstanceStatus'] == 'available':
                    db_instance_id = db_instance['DBInstanceIdentifier']
                    
                    # Collect various RDS metrics
                    rds_metrics = [
                        ('CPUUtilization', 'Percent'),
                        ('DatabaseConnections', 'Count'),
                        ('ReadLatency', 'Seconds'),
                        ('WriteLatency', 'Seconds')
                    ]
                    
                    for metric_name, unit in rds_metrics:
                        try:
                            response = self.cloudwatch_client.get_metric_statistics(
                                Namespace='AWS/RDS',
                                MetricName=metric_name,
                                Dimensions=[
                                    {
                                        'Name': 'DBInstanceIdentifier',
                                        'Value': db_instance_id
                                    }
                                ],
                                StartTime=start_time,
                                EndTime=end_time,
                                Period=300,  # 5 minutes
                                Statistics=['Average']
                            )
                            
                            for datapoint in response['Datapoints']:
                                metrics.append({
                                    'source': 'aws',
                                    'service': 'rds',
                                    'resourceId': db_instance_id,
                                    'resourceName': db_instance_id,
                                    'region': self.cloudwatch_client.meta.region_name,
                                    'metricName': metric_name,
                                    'metricUnit': unit,
                                    'metricValue': datapoint['Average'],
                                    'timestamp': datapoint['Timestamp'].isoformat(),
                                    'period': 300,
                                    'statistic': 'Average',
                                    'dimensions': {'DBInstanceIdentifier': db_instance_id},
                                    'tags': {}
                                })
                                
                        except ClientError as e:
                            logger.warning(f"Failed to get {metric_name} for RDS {db_instance_id}: {e}")
            
            logger.info(f"Collected {len(metrics)} RDS metrics")
            
        except Exception as e:
            logger.error(f"Error collecting RDS metrics: {e}")
            
        return metrics

    def collect_lambda_metrics(self, start_time, end_time):
        """Collect Lambda metrics from CloudWatch"""
        metrics = []
        
        try:
            # Get Lambda functions
            lambda_response = self.lambda_client.list_functions()
            
            for function in lambda_response['Functions']:
                function_name = function['FunctionName']
                
                # Collect Lambda metrics
                lambda_metrics = [
                    ('Invocations', 'Count'),
                    ('Duration', 'Milliseconds'),
                    ('Errors', 'Count'),
                    ('Throttles', 'Count')
                ]
                
                for metric_name, unit in lambda_metrics:
                    try:
                        response = self.cloudwatch_client.get_metric_statistics(
                            Namespace='AWS/Lambda',
                            MetricName=metric_name,
                            Dimensions=[
                                {
                                    'Name': 'FunctionName',
                                    'Value': function_name
                                }
                            ],
                            StartTime=start_time,
                            EndTime=end_time,
                            Period=300,  # 5 minutes
                            Statistics=['Sum' if metric_name == 'Invocations' else 'Average']
                        )
                        
                        statistic = 'Sum' if metric_name == 'Invocations' else 'Average'
                        
                        for datapoint in response['Datapoints']:
                            value = datapoint[statistic]
                            metrics.append({
                                'source': 'aws',
                                'service': 'lambda',
                                'resourceId': function_name,
                                'resourceName': function_name,
                                'region': self.cloudwatch_client.meta.region_name,
                                'metricName': metric_name,
                                'metricUnit': unit,
                                'metricValue': value,
                                'timestamp': datapoint['Timestamp'].isoformat(),
                                'period': 300,
                                'statistic': statistic,
                                'dimensions': {'FunctionName': function_name},
                                'tags': {}
                            })
                            
                    except ClientError as e:
                        logger.warning(f"Failed to get {metric_name} for Lambda {function_name}: {e}")
            
            logger.info(f"Collected {len(metrics)} Lambda metrics")
            
        except Exception as e:
            logger.error(f"Error collecting Lambda metrics: {e}")
            
        return metrics

    def collect_s3_metrics(self, start_time, end_time):
        """Collect S3 metrics from CloudWatch"""
        metrics = []
        
        try:
            # Get S3 buckets
            s3_response = self.s3_client.list_buckets()
            
            for bucket in s3_response['Buckets']:
                bucket_name = bucket['Name']
                
                # S3 metrics are usually daily, so we collect different metrics
                s3_metrics = [
                    ('BucketSizeBytes', 'Bytes', 'StandardStorage'),
                    ('NumberOfObjects', 'Count', 'AllStorageTypes')
                ]
                
                for metric_name, unit, storage_type in s3_metrics:
                    try:
                        dimensions = [
                            {'Name': 'BucketName', 'Value': bucket_name}
                        ]
                        
                        if storage_type:
                            dimensions.append({'Name': 'StorageType', 'Value': storage_type})
                        
                        response = self.cloudwatch_client.get_metric_statistics(
                            Namespace='AWS/S3',
                            MetricName=metric_name,
                            Dimensions=dimensions,
                            StartTime=start_time,
                            EndTime=end_time,
                            Period=86400,  # Daily for S3
                            Statistics=['Average']
                        )
                        
                        for datapoint in response['Datapoints']:
                            metrics.append({
                                'source': 'aws',
                                'service': 's3',
                                'resourceId': bucket_name,
                                'resourceName': bucket_name,
                                'region': self.cloudwatch_client.meta.region_name,
                                'metricName': metric_name,
                                'metricUnit': unit,
                                'metricValue': datapoint['Average'],
                                'timestamp': datapoint['Timestamp'].isoformat(),
                                'period': 86400,
                                'statistic': 'Average',
                                'dimensions': {'BucketName': bucket_name, 'StorageType': storage_type},
                                'tags': {}
                            })
                            
                    except ClientError as e:
                        logger.warning(f"Failed to get {metric_name} for S3 bucket {bucket_name}: {e}")
            
            logger.info(f"Collected {len(metrics)} S3 metrics")
            
        except Exception as e:
            logger.error(f"Error collecting S3 metrics: {e}")
            
        return metrics

    def store_metrics_in_database(self, metrics):
        """Store collected metrics in the node-service database"""
        if not metrics:
            return True
            
        try:
            response = requests.post(
                f"{self.node_service_url}/api/metrics-history/store",
                json=metrics,
                headers={'Content-Type': 'application/json'},
                timeout=30
            )
            
            if response.status_code in [200, 201]:
                logger.info(f"Successfully stored {len(metrics)} metrics in database")
                return True
            else:
                logger.error(f"Failed to store metrics: {response.status_code} - {response.text}")
                return False
                
        except Exception as e:
            logger.error(f"Error storing metrics in database: {e}")
            return False

    def run_anomaly_detection(self, metrics):
        """Run anomaly detection on collected metrics"""
        if not metrics or len(metrics) < 10:
            logger.info("Insufficient metrics for anomaly detection")
            return
            
        try:
            # Group metrics by service and metric name
            grouped_metrics = {}
            for metric in metrics:
                key = f"{metric['service']}-{metric['metricName']}"
                if key not in grouped_metrics:
                    grouped_metrics[key] = []
                grouped_metrics[key].append(metric)
            
            # Run anomaly detection for each group
            for group_key, group_metrics in grouped_metrics.items():
                if len(group_metrics) >= 10:  # Minimum data points for anomaly detection
                    try:
                        response = requests.post(
                            f"{self.ai_service_url}/api/detect-anomalies",
                            json={
                                'metrics_data': group_metrics,
                                'method': 'isolation_forest'
                            },
                            headers={'Content-Type': 'application/json'},
                            timeout=60
                        )
                        
                        if response.status_code == 200:
                            result = response.json()
                            anomalies = result.get('results', {}).get('anomalies', [])
                            
                            if anomalies:
                                logger.warning(f"Found {len(anomalies)} anomalies in {group_key}")
                                # Here you could send alerts, update database flags, etc.
                                
                        else:
                            logger.error(f"Anomaly detection failed for {group_key}: {response.text}")
                            
                    except Exception as e:
                        logger.error(f"Error in anomaly detection for {group_key}: {e}")
            
        except Exception as e:
            logger.error(f"Error running anomaly detection: {e}")

    def collect_all_metrics(self):
        """Main method to collect all AWS metrics"""
        if not self.cloudwatch_client:
            logger.warning("AWS clients not initialized, attempting to get credentials...")
            creds = self.get_aws_credentials_from_node_service()
            if not creds or not self.initialize_aws_clients(**creds):
                logger.error("Failed to initialize AWS clients")
                return False
        
        logger.info("Starting metrics collection cycle...")
        self.collection_stats['total_collections'] += 1
        
        try:
            # Define time range (last 15 minutes)
            end_time = datetime.utcnow()
            start_time = end_time - timedelta(minutes=15)
            
            all_metrics = []
            
            # Collect metrics from all services
            all_metrics.extend(self.collect_ec2_metrics(start_time, end_time))
            all_metrics.extend(self.collect_rds_metrics(start_time, end_time))
            all_metrics.extend(self.collect_lambda_metrics(start_time, end_time))
            all_metrics.extend(self.collect_s3_metrics(start_time, end_time))
            
            logger.info(f"Total metrics collected: {len(all_metrics)}")
            
            if all_metrics:
                # Store metrics in database
                if self.store_metrics_in_database(all_metrics):
                    self.collection_stats['successful_collections'] += 1
                    
                    # Run anomaly detection
                    self.run_anomaly_detection(all_metrics)
                else:
                    self.collection_stats['failed_collections'] += 1
                    return False
            
            self.last_collection_time = datetime.utcnow()
            logger.info("Metrics collection cycle completed successfully")
            return True
            
        except Exception as e:
            self.collection_stats['failed_collections'] += 1
            self.collection_stats['last_error'] = str(e)
            logger.error(f"Metrics collection failed: {e}")
            return False

    def start_scheduled_collection(self):
        """Start the scheduled metrics collection"""
        logger.info(f"Starting scheduled metrics collection (interval: {self.collection_interval} minutes)")
        
        # Schedule regular collections
        schedule.every(self.collection_interval).minutes.do(self.collect_all_metrics)
        
        # Schedule anomaly checks
        schedule.every(self.anomaly_check_interval).minutes.do(self.run_anomaly_monitoring)
        
        self.is_running = True
        
        # Run an initial collection
        self.collect_all_metrics()
        
        # Keep the scheduler running
        while self.is_running:
            schedule.run_pending()
            time.sleep(60)  # Check every minute
            
    def run_anomaly_monitoring(self):
        """Run comprehensive anomaly monitoring across all services"""
        try:
            logger.info("Running scheduled anomaly monitoring...")
            
            response = requests.post(
                f"{self.ai_service_url}/api/monitor-anomalies",
                json={
                    'services': ['ec2', 'rds', 'lambda', 's3'],
                    'alertThreshold': 0.8
                },
                headers={'Content-Type': 'application/json'},
                timeout=120
            )
            
            if response.status_code == 200:
                result = response.json()
                alerts = result.get('alerts', [])
                
                if alerts:
                    logger.warning(f"Anomaly monitoring found {len(alerts)} high-severity alerts")
                    # Here you could send notifications, update dashboards, etc.
                else:
                    logger.info("No high-severity anomalies detected")
            else:
                logger.error(f"Anomaly monitoring failed: {response.text}")
                
        except Exception as e:
            logger.error(f"Error in anomaly monitoring: {e}")

    def stop_collection(self):
        """Stop the scheduled collection"""
        logger.info("Stopping metrics collection...")
        self.is_running = False
        
    def get_collection_status(self):
        """Get the current status of the metrics collector"""
        return {
            'is_running': self.is_running,
            'last_collection_time': self.last_collection_time.isoformat() if self.last_collection_time else None,
            'collection_interval_minutes': self.collection_interval,
            'anomaly_check_interval_minutes': self.anomaly_check_interval,
            'statistics': self.collection_stats,
            'aws_clients_initialized': self.cloudwatch_client is not None,
            'node_service_url': self.node_service_url,
            'ai_service_url': self.ai_service_url
        }

# Global metrics collector instance
metrics_collector = AWSMetricsCollector()

def start_collection_thread():
    """Start the metrics collection in a separate thread"""
    def run_collector():
        try:
            metrics_collector.start_scheduled_collection()
        except Exception as e:
            logger.error(f"Metrics collection thread failed: {e}")
    
    collection_thread = threading.Thread(target=run_collector, daemon=True)
    collection_thread.start()
    logger.info("Started metrics collection thread")
    return collection_thread

if __name__ == "__main__":
    # Create logs directory if it doesn't exist
    os.makedirs('/app/logs', exist_ok=True)
    
    logger.info("Starting AWS Metrics Collection Automation...")
    
    # Start the collection thread
    start_collection_thread()
    
    # Keep the main thread alive
    try:
        while True:
            time.sleep(60)
    except KeyboardInterrupt:
        logger.info("Shutting down metrics collector...")
        metrics_collector.stop_collection()