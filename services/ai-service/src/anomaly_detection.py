"""
Anomaly Detection Module for Cloud Pulse 360
Uses Isolation Forest for detecting anomalies in time series metrics
"""

import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler
from datetime import datetime, timedelta
import json
import sys
import warnings

warnings.filterwarnings('ignore')

class MetricsAnomalyDetector:
    def __init__(self):
        self.scaler = StandardScaler()
        self.model = IsolationForest(
            contamination=0.1,  # Expected proportion of anomalies
            random_state=42,
            n_estimators=100
        )
        
    def prepare_features(self, metrics_data):
        """
        Prepare features for anomaly detection
        """
        df = pd.DataFrame(metrics_data)
        
        # Convert timestamp to datetime
        df['timestamp'] = pd.to_datetime(df['timestamp'])
        df = df.sort_values('timestamp')
        
        # Extract time-based features
        df['hour'] = df['timestamp'].dt.hour
        df['day_of_week'] = df['timestamp'].dt.dayofweek
        df['is_weekend'] = df['day_of_week'].isin([5, 6]).astype(int)
        
        # Calculate rolling statistics
        df['value_rolling_mean_12'] = df['metricValue'].rolling(window=12, min_periods=1).mean()
        df['value_rolling_std_12'] = df['metricValue'].rolling(window=12, min_periods=1).std()
        df['value_rolling_mean_24'] = df['metricValue'].rolling(window=24, min_periods=1).mean()
        
        # Calculate rate of change
        df['value_diff'] = df['metricValue'].diff()
        df['value_pct_change'] = df['metricValue'].pct_change()
        
        # Z-score from rolling mean
        df['z_score'] = (df['metricValue'] - df['value_rolling_mean_12']) / (df['value_rolling_std_12'] + 1e-6)
        
        # Fill NaN values
        df = df.fillna(0)
        
        # Select features for anomaly detection
        feature_columns = [
            'metricValue', 'hour', 'day_of_week', 'is_weekend',
            'value_rolling_mean_12', 'value_rolling_std_12', 'value_rolling_mean_24',
            'value_diff', 'value_pct_change', 'z_score'
        ]
        
        return df, feature_columns
    
    def detect_anomalies(self, metrics_data):
        """
        Detect anomalies in metrics data
        """
        try:
            if len(metrics_data) < 10:
                return {
                    'anomalies': [],
                    'anomaly_count': 0,
                    'total_points': len(metrics_data),
                    'anomaly_rate': 0.0,
                    'message': 'Insufficient data points for anomaly detection (minimum 10 required)'
                }
            
            df, feature_columns = self.prepare_features(metrics_data)
            
            # Prepare features
            X = df[feature_columns].values
            
            # Scale features
            X_scaled = self.scaler.fit_transform(X)
            
            # Fit and predict anomalies
            anomaly_labels = self.model.fit_predict(X_scaled)
            anomaly_scores = self.model.decision_function(X_scaled)
            
            # Convert to boolean (True for anomalies)
            is_anomaly = anomaly_labels == -1
            
            # Normalize scores to 0-1 range (higher = more anomalous)
            normalized_scores = (anomaly_scores - anomaly_scores.min()) / (anomaly_scores.max() - anomaly_scores.min())
            anomaly_scores_01 = 1 - normalized_scores  # Invert so higher = more anomalous
            
            # Create results
            anomalies = []
            for idx, (is_anom, score) in enumerate(zip(is_anomaly, anomaly_scores_01)):
                if is_anom:
                    anomalies.append({
                        'index': int(idx),
                        'timestamp': df.iloc[idx]['timestamp'].isoformat(),
                        'metric_value': float(df.iloc[idx]['metricValue']),
                        'anomaly_score': float(score),
                        'z_score': float(df.iloc[idx]['z_score']),
                        'rolling_mean': float(df.iloc[idx]['value_rolling_mean_12']),
                        'deviation_percent': float(abs(df.iloc[idx]['z_score']) * 100) if df.iloc[idx]['value_rolling_std_12'] > 0 else 0
                    })
            
            # Sort by anomaly score (highest first)
            anomalies.sort(key=lambda x: x['anomaly_score'], reverse=True)
            
            return {
                'anomalies': anomalies,
                'anomaly_count': len(anomalies),
                'total_points': len(metrics_data),
                'anomaly_rate': len(anomalies) / len(metrics_data),
                'model_params': {
                    'contamination': 0.1,
                    'n_estimators': 100
                },
                'feature_importance': {
                    'primary_features': ['metricValue', 'z_score', 'value_pct_change'],
                    'temporal_features': ['hour', 'day_of_week', 'is_weekend'],
                    'statistical_features': ['value_rolling_mean_12', 'value_rolling_std_12']
                }
            }
            
        except Exception as e:
            return {
                'error': f'Anomaly detection failed: {str(e)}',
                'anomalies': [],
                'anomaly_count': 0,
                'total_points': len(metrics_data) if metrics_data else 0,
                'anomaly_rate': 0.0
            }

def detect_threshold_anomalies(metrics_data, thresholds):
    """
    Simple threshold-based anomaly detection
    """
    anomalies = []
    
    for idx, point in enumerate(metrics_data):
        value = point['metricValue']
        metric_name = point.get('metricName', 'unknown')
        
        # Get thresholds for this metric
        threshold_config = thresholds.get(metric_name, {})
        min_threshold = threshold_config.get('min')
        max_threshold = threshold_config.get('max')
        
        is_anomaly = False
        threshold_type = None
        
        if min_threshold is not None and value < min_threshold:
            is_anomaly = True
            threshold_type = 'below_minimum'
        elif max_threshold is not None and value > max_threshold:
            is_anomaly = True
            threshold_type = 'above_maximum'
        
        if is_anomaly:
            anomalies.append({
                'index': idx,
                'timestamp': point['timestamp'],
                'metric_value': value,
                'metric_name': metric_name,
                'threshold_type': threshold_type,
                'threshold_value': min_threshold if threshold_type == 'below_minimum' else max_threshold,
                'anomaly_score': 1.0  # Maximum score for threshold violations
            })
    
    return {
        'anomalies': anomalies,
        'anomaly_count': len(anomalies),
        'total_points': len(metrics_data),
        'anomaly_rate': len(anomalies) / len(metrics_data) if metrics_data else 0,
        'detection_method': 'threshold_based'
    }

def main():
    try:
        # Read input from stdin
        input_data = json.loads(sys.stdin.read())
        
        method = input_data.get('method', 'isolation_forest')
        metrics_data = input_data.get('metrics_data', [])
        
        if method == 'isolation_forest':
            detector = MetricsAnomalyDetector()
            result = detector.detect_anomalies(metrics_data)
        elif method == 'threshold':
            thresholds = input_data.get('thresholds', {})
            result = detect_threshold_anomalies(metrics_data, thresholds)
        else:
            result = {
                'error': f'Unknown detection method: {method}',
                'anomalies': [],
                'anomaly_count': 0
            }
        
        # Output result as JSON
        print(json.dumps(result, default=str))
        
    except Exception as e:
        error_result = {
            'error': f'Anomaly detection script failed: {str(e)}',
            'anomalies': [],
            'anomaly_count': 0,
            'total_points': 0,
            'anomaly_rate': 0.0
        }
        print(json.dumps(error_result))

if __name__ == '__main__':
    main()