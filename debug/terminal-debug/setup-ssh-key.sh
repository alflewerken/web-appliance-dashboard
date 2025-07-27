#!/bin/bash
# Check and install SSH key for host

echo "🔐 SSH Key Authorization Check"
echo "=============================="

# Get the dashboard public key
echo "Dashboard Public Key:"
docker exec appliance_ttyd cat /root/.ssh/id_rsa_dashboard.pub

echo -e "\n=============================="
echo "Um den SSH-Key-Zugriff zu aktivieren:"
echo ""
echo "1. Kopiere den obigen Public Key"
echo "2. Melde dich auf dem Zielhost an: ssh alflewerken@192.168.178.70"
echo "3. Füge den Key zu ~/.ssh/authorized_keys hinzu:"
echo "   echo 'PASTE_KEY_HERE' >> ~/.ssh/authorized_keys"
echo ""
echo "Oder nutze ssh-copy-id vom Backend-Container:"
echo "docker exec -it appliance_backend ssh-copy-id -i /root/.ssh/id_rsa_dashboard alflewerken@192.168.178.70"
