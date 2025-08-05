#!/usr/bin/env python3
import socket
import sys

def test_vnc_connection(host, port=5900):
    """Test VNC connection and authentication"""
    try:
        # Connect to VNC server
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.settimeout(5)
        s.connect((host, port))
        
        # Read RFB protocol version
        version = s.recv(12)
        print(f"Server version: {version.decode('ascii').strip()}")
        
        # Send client version
        s.send(b"RFB 003.008\n")
        
        # Read security types
        num_types = s.recv(1)[0]
        print(f"Number of security types: {num_types}")
        
        if num_types == 0:
            # Connection failed
            reason_len = int.from_bytes(s.recv(4), 'big')
            reason = s.recv(reason_len)
            print(f"Connection failed: {reason.decode('utf-8')}")
            return False
            
        # Read security types
        sec_types = s.recv(num_types)
        print(f"Security types: {list(sec_types)}")
        
        s.close()
        return True
        
    except socket.timeout:
        print("Connection timed out")
        return False
    except Exception as e:
        print(f"Error: {e}")
        return False

if __name__ == "__main__":
    host = sys.argv[1] if len(sys.argv) > 1 else "192.168.178.70"
    print(f"Testing VNC connection to {host}:5900")
    test_vnc_connection(host)
