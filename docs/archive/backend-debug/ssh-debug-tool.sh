#!/bin/sh
# SSH Debug and Fix Tool for Web Appliance Dashboard
# Run this in the backend container after a restore

echo "🔍 SSH Debug & Fix Tool"
echo "======================"
echo ""

# Function to run Node.js scripts
run_node_script() {
    script_path=$1
    script_name=$2
    
    if [ -f "$script_path" ]; then
        echo "Running $script_name..."
        node "$script_path"
        return $?
    else
        echo "❌ Script not found: $script_path"
        return 1
    fi
}

# Function to check SSH keys
check_ssh_keys() {
    echo "\n📁 Checking SSH keys in filesystem..."
    if [ -d /root/.ssh ]; then
        echo "SSH directory exists. Contents:"
        ls -la /root/.ssh/ | grep -E "id_rsa|config"
    else
        echo "❌ SSH directory not found!"
    fi
}

# Function to test database connection
test_database() {
    echo "\n📊 Testing database connection..."
    if mysql -h database -u dashboard_user -pdashboard_pass123 appliance_dashboard -e "SELECT COUNT(*) as hosts FROM ssh_hosts;" 2>/dev/null; then
        echo "✅ Database connection OK"
    else
        echo "❌ Database connection failed"
        return 1
    fi
}

# Main menu
while true; do
    echo "\n🔧 What would you like to do?"
    echo "1) Run full diagnostic (ssh-deep-debug.js)"
    echo "2) Run post-restore fix (ssh-post-restore-fix.js)"
    echo "3) Check SSH keys in filesystem"
    echo "4) Test database connection"
    echo "5) Regenerate SSH config"
    echo "6) Show recent logs"
    echo "7) Exit"
    echo ""
    printf "Select option (1-7): "
    read option

    case $option in
        1)
            run_node_script "/app/utils/ssh-deep-debug.js" "Deep Debug"
            ;;
        2)
            run_node_script "/app/utils/ssh-post-restore-fix.js" "Post-Restore Fix"
            ;;
        3)
            check_ssh_keys
            ;;
        4)
            test_database
            ;;
        5)
            if [ -f /app/regenerate-ssh-config.js ]; then
                echo "Regenerating SSH config..."
                node /app/regenerate-ssh-config.js
            else
                echo "Using API to regenerate config..."
                curl -X POST http://localhost:3001/api/ssh/regenerate-config
            fi
            ;;
        6)
            echo "\n📜 Recent backend logs:"
            tail -n 50 /proc/1/fd/1 2>/dev/null | grep -E "SSH|ssh|executeSSH|statusChecker" || echo "No relevant logs found"
            ;;
        7)
            echo "Goodbye!"
            exit 0
            ;;
        *)
            echo "Invalid option. Please select 1-7."
            ;;
    esac
    
    echo "\nPress Enter to continue..."
    read dummy
done
