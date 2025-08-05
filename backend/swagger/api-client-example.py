#!/usr/bin/env python3
"""
Web Appliance Dashboard API Client Example

This script demonstrates how to use the Web Appliance Dashboard API with Python.
It includes examples for all major endpoints with proper error handling.

Requirements:
    pip install requests

Usage:
    python api-client-example.py
"""

import requests
import json
import time
from datetime import datetime
from typing import Dict, List, Optional, Any


class WebApplianceAPIClient:
    """Client for interacting with the Web Appliance Dashboard API."""
    
    def __init__(self, base_url: str = "http://localhost:9080"):
        """
        Initialize the API client.
        
        Args:
            base_url: The base URL of the API server
        """
        self.base_url = base_url.rstrip('/')
        self.token: Optional[str] = None
        self.session = requests.Session()
        
    def _get_headers(self) -> Dict[str, str]:
        """Get headers with authentication token if available."""
        headers = {"Content-Type": "application/json"}
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"
        return headers
    
    def _handle_response(self, response: requests.Response) -> Dict[str, Any]:
        """Handle API response and raise exceptions for errors."""
        try:
            response.raise_for_status()
            return response.json() if response.content else {}
        except requests.exceptions.HTTPError as e:
            error_msg = f"HTTP Error {response.status_code}"
            try:
                error_data = response.json()
                error_msg = f"{error_msg}: {error_data.get('error', 'Unknown error')}"
            except json.JSONDecodeError:
                pass
            raise Exception(error_msg) from e
        except requests.exceptions.RequestException as e:
            raise Exception(f"Request failed: {str(e)}") from e
    
    # Authentication
    def login(self, username: str, password: str) -> Dict[str, Any]:
        """
        Login to the API and store the authentication token.
        
        Args:
            username: Username for authentication
            password: Password for authentication
            
        Returns:
            User information and token
        """
        response = self.session.post(
            f"{self.base_url}/api/auth/login",
            json={"username": username, "password": password}
        )
        data = self._handle_response(response)
        self.token = data.get("token")
        print(f"✓ Logged in as {data['user']['username']}")
        return data
    
    # Appliances
    def get_appliances(self) -> List[Dict[str, Any]]:
        """Get all appliances."""
        response = self.session.get(
            f"{self.base_url}/api/appliances",
            headers=self._get_headers()
        )
        return self._handle_response(response)
    
    def create_appliance(self, appliance_data: Dict[str, Any]) -> Dict[str, Any]:
        """Create a new appliance."""
        response = self.session.post(
            f"{self.base_url}/api/appliances",
            headers=self._get_headers(),
            json=appliance_data
        )
        return self._handle_response(response)
    
    def update_appliance(self, appliance_id: int, updates: Dict[str, Any]) -> Dict[str, Any]:
        """Update an existing appliance."""
        response = self.session.put(
            f"{self.base_url}/api/appliances/{appliance_id}",
            headers=self._get_headers(),
            json=updates
        )
        return self._handle_response(response)
    
    def delete_appliance(self, appliance_id: int) -> Dict[str, Any]:
        """Delete an appliance."""
        response = self.session.delete(
            f"{self.base_url}/api/appliances/{appliance_id}",
            headers=self._get_headers()
        )
        return self._handle_response(response)
    
    # Categories
    def get_categories(self) -> List[Dict[str, Any]]:
        """Get all categories with appliance counts."""
        response = self.session.get(
            f"{self.base_url}/api/categories",
            headers=self._get_headers()
        )
        return self._handle_response(response)
    
    # Services
    def get_services(self) -> List[Dict[str, Any]]:
        """Get all system services."""
        response = self.session.get(
            f"{self.base_url}/api/services",
            headers=self._get_headers()
        )
        return self._handle_response(response)
    
    def control_service(self, service_name: str, action: str) -> Dict[str, Any]:
        """
        Control a system service.
        
        Args:
            service_name: Name of the service
            action: Action to perform (start, stop, restart)
        """
        response = self.session.post(
            f"{self.base_url}/api/services/{service_name}/{action}",
            headers=self._get_headers()
        )
        return self._handle_response(response)
    
    # Settings
    def get_settings(self) -> List[Dict[str, Any]]:
        """Get all system settings."""
        response = self.session.get(
            f"{self.base_url}/api/settings",
            headers=self._get_headers()
        )
        return self._handle_response(response)
    
    def update_setting(self, key: str, value: str) -> Dict[str, Any]:
        """Update a system setting."""
        response = self.session.put(
            f"{self.base_url}/api/settings/{key}",
            headers=self._get_headers(),
            json={"value": value}
        )
        return self._handle_response(response)
    
    # SSH Keys
    def get_ssh_keys(self) -> List[Dict[str, Any]]:
        """Get all SSH keys."""
        response = self.session.get(
            f"{self.base_url}/api/ssh/keys",
            headers=self._get_headers()
        )
        return self._handle_response(response)
    
    def generate_ssh_key(self, name: str, passphrase: str = "") -> Dict[str, Any]:
        """Generate a new SSH key pair."""
        response = self.session.post(
            f"{self.base_url}/api/ssh/keys/generate",
            headers=self._get_headers(),
            json={"name": name, "passphrase": passphrase}
        )
        return self._handle_response(response)
    
    # Status Check
    def check_appliance_status(self, appliance_ids: List[int]) -> Dict[str, Any]:
        """Check status of multiple appliances."""
        response = self.session.post(
            f"{self.base_url}/api/statusCheck",
            headers=self._get_headers(),
            json={"applianceIds": appliance_ids}
        )
        return self._handle_response(response)
    
    # Audit Logs
    def get_audit_logs(self, limit: int = 100, offset: int = 0, 
                      action: Optional[str] = None, user_id: Optional[int] = None) -> Dict[str, Any]:
        """Get audit logs with optional filtering."""
        params = {"limit": limit, "offset": offset}
        if action:
            params["action"] = action
        if user_id:
            params["userId"] = user_id
            
        response = self.session.get(
            f"{self.base_url}/api/auditLogs",
            headers=self._get_headers(),
            params=params
        )
        return self._handle_response(response)
    
    # Backup
    def create_backup(self, output_file: str) -> None:
        """Create a system backup and save to file."""
        response = self.session.post(
            f"{self.base_url}/api/backup",
            headers=self._get_headers(),
            stream=True
        )
        response.raise_for_status()
        
        with open(output_file, 'wb') as f:
            for chunk in response.iter_content(chunk_size=8192):
                f.write(chunk)
        print(f"✓ Backup saved to {output_file}")
    
    # Monitoring
    def monitor_appliances(self, interval: int = 60, duration: Optional[int] = None):
        """
        Monitor appliance status continuously.
        
        Args:
            interval: Check interval in seconds
            duration: Total monitoring duration in seconds (None for infinite)
        """
        start_time = time.time()
        print(f"Starting appliance monitoring (interval: {interval}s)...")
        
        try:
            while True:
                # Get all appliances
                appliances = self.get_appliances()
                if not appliances:
                    print("No appliances configured")
                    break
                
                # Check status
                appliance_ids = [app['id'] for app in appliances]
                statuses = self.check_appliance_status(appliance_ids)
                
                # Display results
                print(f"\n[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}]")
                for app in appliances:
                    status_info = statuses.get(str(app['id']), {})
                    status = status_info.get('status', 'unknown')
                    response_time = status_info.get('responseTime', '-')
                    
                    status_icon = "🟢" if status == "online" else "🔴" if status == "offline" else "⚪"
                    print(f"{status_icon} {app['name']:<30} {status:<10} {response_time}ms")
                
                # Check if we should stop
                if duration and (time.time() - start_time) >= duration:
                    break
                
                # Wait for next check
                time.sleep(interval)
                
        except KeyboardInterrupt:
            print("\n\nMonitoring stopped by user")


def main():
    """Main function demonstrating API usage."""
    # Initialize client
    client = WebApplianceAPIClient()
    
    try:
        # 1. Login
        print("=== Authentication ===")
        client.login("admin", "password123")
        
        # 2. Get and display appliances
        print("\n=== Current Appliances ===")
        appliances = client.get_appliances()
        for app in appliances:
            print(f"- {app['name']} ({app['url']})")
        
        # 3. Create a new appliance
        print("\n=== Creating New Appliance ===")
        new_appliance = client.create_appliance({
            "name": "Example Application",
            "url": "http://example.local:8080",
            "description": "Example application for testing",
            "icon": "Globe",
            "color": "#FF5733",
            "category": "development"
        })
        print(f"✓ Created appliance: {new_appliance['name']} (ID: {new_appliance['id']})")
        
        # 4. Update the appliance
        print("\n=== Updating Appliance ===")
        updated = client.update_appliance(new_appliance['id'], {
            "description": "Updated description for example app"
        })
        print(f"✓ Updated appliance description")
        
        # 5. Check appliance status
        print("\n=== Checking Status ===")
        statuses = client.check_appliance_status([new_appliance['id']])
        status_info = statuses.get(str(new_appliance['id']), {})
        print(f"Status: {status_info.get('status', 'unknown')}")
        
        # 6. Get categories
        print("\n=== Categories ===")
        categories = client.get_categories()
        for cat in categories:
            print(f"- {cat['display_name']}: {cat['applianceCount']} appliances")
        
        # 7. Get settings
        print("\n=== Settings ===")
        settings = client.get_settings()
        settings_dict = {s['key']: s['value'] for s in settings}
        print(f"SSH Enabled: {settings_dict.get('ssh_enabled', 'N/A')}")
        print(f"Terminal Enabled: {settings_dict.get('terminal_enabled', 'N/A')}")
        
        # 8. Get audit logs
        print("\n=== Recent Audit Logs ===")
        logs = client.get_audit_logs(limit=5)
        for log in logs['logs'][:5]:
            print(f"- [{log['timestamp']}] {log['username']}: {log['action']}")
        
        # 9. Monitor appliances for 30 seconds
        print("\n=== Monitoring Appliances ===")
        client.monitor_appliances(interval=10, duration=30)
        
        # 10. Clean up - delete the test appliance
        print("\n=== Cleanup ===")
        client.delete_appliance(new_appliance['id'])
        print(f"✓ Deleted test appliance")
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        return 1
    
    return 0


if __name__ == "__main__":
    exit(main())
