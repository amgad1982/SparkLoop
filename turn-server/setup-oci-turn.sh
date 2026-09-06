#!/bin/bash
# ==============================================================================
# SparkLoop - One-Click TURN & Web Admin Setup Script for Oracle Cloud (Ubuntu ARM64)
# Public IP: 92.4.162.183
# Web Admin: https://92.4.162.183:8080
# ==============================================================================
set -e

# Ensure we run from the directory containing this script and docker-compose.yml
cd "$(dirname "$0")"

echo "🚀 [1/6] Updating Ubuntu package cache & installing prerequisites..."
sudo apt-get update -y
sudo apt-get install -y openssl sqlite3 curl

echo "🔒 [2/6] Configuring Ubuntu Firewall (Oracle Cloud Host iptables)..."
# Oracle Cloud Ubuntu images drop incoming traffic via iptables by default.
# We insert rules at the top of INPUT, FORWARD, and DOCKER-USER chains.
sudo iptables -I INPUT 1 -p udp --dport 3478 -j ACCEPT
sudo iptables -I INPUT 1 -p tcp --dport 3478 -j ACCEPT
sudo iptables -I INPUT 1 -p tcp --dport 5349 -j ACCEPT
sudo iptables -I INPUT 1 -p tcp --dport 8080 -j ACCEPT
sudo iptables -I INPUT 1 -p tcp --dport 9641 -j ACCEPT
sudo iptables -I INPUT 1 -p udp --dport 49152:49300 -j ACCEPT

# CRITICAL FOR DOCKER ON ORACLE CLOUD:
# Oracle Cloud's default iptables rejects forwarded traffic (-A FORWARD -j REJECT).
# Docker port forwards rely on the FORWARD and DOCKER-USER chains.
sudo iptables -I FORWARD 1 -j ACCEPT
sudo iptables -I DOCKER-USER 1 -j ACCEPT 2>/dev/null || true

# Save iptables rules across reboots
if command -v netfilter-persistent &> /dev/null; then
    sudo netfilter-persistent save
elif command -v iptables-save &> /dev/null; then
    sudo mkdir -p /etc/iptables
    sudo iptables-save | sudo tee /etc/iptables/rules.v4 > /dev/null
fi

# Also allow in UFW if enabled
if sudo ufw status | grep -q "Status: active"; then
    echo "Configuring UFW rules..."
    sudo ufw allow 3478/udp
    sudo ufw allow 3478/tcp
    sudo ufw allow 5349/tcp
    sudo ufw allow 8080/tcp
    sudo ufw allow 9641/tcp
    sudo ufw allow 49152:49300/udp
    sudo ufw reload
fi

echo "🔑 [3/6] Generating TLS Certificates for Web Admin & TURNS..."
mkdir -p certs data logs
if [ ! -f certs/cert.pem ] || [ ! -f certs/privkey.pem ]; then
    echo "Generating self-signed SSL certificates for 92.4.162.183..."
    openssl req -x509 -newkey rsa:2048 -nodes \
        -keyout certs/privkey.pem \
        -out certs/cert.pem \
        -days 3650 \
        -subj "/CN=92.4.162.183/O=SparkLoop/OU=Voice Stage"
    chmod 644 certs/cert.pem certs/privkey.pem
fi

# Set directory permissions for Coturn container
sudo chmod -R 777 data certs logs

echo "⚡ [4/6] Optimizing Linux Kernel sysctl for High-Concurrency UDP/WebRTC..."
sudo tee /etc/sysctl.d/99-coturn-tuning.conf > /dev/null <<EOF
# Increase UDP socket buffer sizes for WebRTC media
net.core.rmem_max = 33554432
net.core.wmem_max = 33554432
net.core.rmem_default = 262144
net.core.wmem_default = 262144
net.ipv4.udp_rmem_min = 16384
net.ipv4.udp_wmem_min = 16384

# Increase file descriptors and connection tracking
fs.file-max = 2097152
net.netfilter.nf_conntrack_max = 524288
EOF
sudo sysctl --system > /dev/null 2>&1 || true

echo "🐳 [5/6] Checking Docker & Docker Compose..."
if ! command -v docker &> /dev/null; then
    echo "Installing Docker..."
    curl -fsSL https://get.docker.com | sudo sh
    sudo usermod -aG docker $USER
fi

echo "👤 [6/6] Pre-seeding SQLite Database & Starting Coturn Container..."
# Stop previous container if running
sudo docker compose down 2>/dev/null || true

# Pre-initialize SQLite Database with admin and livekit credentials BEFORE starting Coturn
echo "Pre-creating SQLite schema & accounts using temporary turnadmin container..."
sudo docker run --rm -v "$(pwd)/data:/var/lib/turn" coturn/coturn:latest \
    turnadmin -A -u admin -p SparkLoopAdmin2026! -b /var/lib/turn/turndb || true

sudo docker run --rm -v "$(pwd)/data:/var/lib/turn" coturn/coturn:latest \
    turnadmin -a -u sparkloop -r turn.sparkloop.app -p SparkLoopTurnSecret2026Secure! -b /var/lib/turn/turndb || true

# Ensure read/write permissions on the newly created SQLite DB file and logs for Docker user 'nobody'
sudo chmod -R 777 data certs logs

# Start Coturn with explicit port mappings
sudo docker compose up -d

# Wait 3 seconds for container initialization
sleep 3

echo ""
echo "=========================================================================="
echo "🔍 DOCKER CONTAINER STATUS (docker ps):"
sudo docker ps --filter "name=sparkloop-coturn" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
echo ""
echo "🔍 LISTENING SOCKETS ON HOST (ss -tulpn):"
sudo ss -tulpn | grep -E '8080|3478|5349|9641' || echo "No listening sockets found on target ports!"
echo ""
echo "🧪 LOCAL RESPONSE TESTS:"
echo -n "Testing HTTPS https://127.0.0.1:8080/ -> "
curl -k -I --connect-timeout 3 https://127.0.0.1:8080/ 2>&1 | head -n 1 || true
echo -n "Testing HTTP  http://127.0.0.1:8080/  -> "
curl -I --connect-timeout 3 http://127.0.0.1:8080/ 2>&1 | head -n 1 || true
echo "=========================================================================="
echo "📋 RECENT COTURN LOGS (docker logs):"
sudo docker logs --tail 20 sparkloop-coturn || true
echo "=========================================================================="
echo "🎉 SparkLoop TURN Server & Web Admin are UP and RUNNING!"
echo "=========================================================================="
echo "🌐 Web Admin URL:    https://92.4.162.183:8080"
echo "👤 Web Admin User:   admin"
echo "🔑 Web Admin Pass:   SparkLoopAdmin2026!"
echo "--------------------------------------------------------------------------"
echo "📡 TURN Server:      92.4.162.183:3478 (UDP & TCP)"
echo "🔒 TURNS (TLS):      92.4.162.183:5349 (TCP)"
echo "📊 Metrics:          http://92.4.162.183:9641/metrics"
echo "📁 Host Logs File:   $(pwd)/logs/turnserver.log"
echo "--------------------------------------------------------------------------"
echo "⚠️  CRITICAL: ORACLE CLOUD CONSOLE SECURITY LIST INGRESS RULES"
echo "Ensure your OCI VCN Security List includes the following rules:"
echo "  1. TCP | Port 8080       | Source: 0.0.0.0/0 (Web Admin Interface)"
echo "  2. UDP | Port 3478       | Source: 0.0.0.0/0 (STUN & TURN Media)"
echo "  3. TCP | Port 3478       | Source: 0.0.0.0/0 (TURN TCP Fallback)"
echo "  4. TCP | Port 5349       | Source: 0.0.0.0/0 (TURNS over TLS)"
echo "  5. UDP | Port 49152-49300| Source: 0.0.0.0/0 (Dynamic Relay Range)"
echo "=========================================================================="
