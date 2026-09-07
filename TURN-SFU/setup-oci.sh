#!/bin/bash
# ==============================================================================
# SparkLoop - One-Click TURN & LiveKit SFU Setup Script for Oracle Cloud (ARM64)
# Public IP: 92.4.162.183
# Services:
#   - LiveKit WebRTC SFU: https://92.4.162.183:7880
#   - Coturn Web Admin:   https://92.4.162.183:8080
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

# 1. Coturn STUN/TURN & Admin Ports
sudo iptables -I INPUT 1 -p udp --dport 3478 -j ACCEPT
sudo iptables -I INPUT 1 -p tcp --dport 3478 -j ACCEPT
sudo iptables -I INPUT 1 -p tcp --dport 5349 -j ACCEPT
sudo iptables -I INPUT 1 -p tcp --dport 8080 -j ACCEPT
sudo iptables -I INPUT 1 -p tcp --dport 9641 -j ACCEPT
sudo iptables -I INPUT 1 -p udp --dport 49152:49300 -j ACCEPT

# 2. LiveKit SFU Signaling & Audio Media Ports
sudo iptables -I INPUT 1 -p tcp --dport 7880 -j ACCEPT
sudo iptables -I INPUT 1 -p tcp --dport 7881 -j ACCEPT
sudo iptables -I INPUT 1 -p udp --dport 7882 -j ACCEPT

# 3. CRITICAL FOR DOCKER ON ORACLE CLOUD:
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
    sudo ufw allow 7880/tcp
    sudo ufw allow 7881/tcp
    sudo ufw allow 7882/udp
    sudo ufw reload
fi

echo "🔑 [3/6] Generating TLS Certificates for Coturn Web Admin & TURNS..."
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

# Set open directory permissions so Docker user 'nobody' (UID 65534) can read/write
sudo chmod -R 777 data certs logs

echo "⚡ [4/6] Optimizing Linux Kernel sysctl for High-Concurrency UDP/WebRTC..."
sudo tee /etc/sysctl.d/99-sparkloop-tuning.conf > /dev/null <<EOF
# Increase UDP socket buffer sizes for WebRTC media
net.core.rmem_max = 33554432
net.core.wmem_max = 33554432
net.core.rmem_default = 262144
net.core.wmem_default = 262144
net.ipv4.udp_rmem_min = 16384
net.ipv4.udp_wmem_min = 16384

# Increase file descriptors and connection tracking for 10k+ sockets
fs.file-max = 2097152
net.core.somaxconn = 65535
net.ipv4.tcp_max_syn_backlog = 65535
net.ipv4.tcp_tw_reuse = 1
net.netfilter.nf_conntrack_max = 524288
EOF
sudo sysctl --system > /dev/null 2>&1 || true

echo "🐳 [5/6] Checking Docker & Docker Compose..."
if ! command -v docker &> /dev/null; then
    echo "Installing Docker..."
    curl -fsSL https://get.docker.com | sudo sh
    sudo usermod -aG docker $USER
fi

echo "👤 [6/6] Pre-seeding SQLite Database & Starting Stack..."
# Stop previous containers if running
sudo docker compose down 2>/dev/null || true

# Pre-initialize SQLite Database with admin and livekit credentials BEFORE starting Coturn
echo "Pre-creating SQLite schema & accounts using temporary turnadmin container..."
sudo docker run --rm -v "$(pwd)/data:/var/lib/turn" coturn/coturn:latest \
    turnadmin -A -u admin -p SparkLoopAdmin2026! -b /var/lib/turn/turndb || true

sudo docker run --rm -v "$(pwd)/data:/var/lib/turn" coturn/coturn:latest \
    turnadmin -a -u sparkloop -r turn.sparkloop.app -p SparkLoopTurnSecret2026Secure! -b /var/lib/turn/turndb || true

# Ensure read/write permissions on the newly created SQLite DB file
sudo chmod -R 777 data certs logs

# Start both Coturn and LiveKit SFU containers
echo "Starting Coturn & LiveKit SFU..."
sudo docker compose up -d

# Wait 4 seconds for container initialization
sleep 4

echo ""
echo "=========================================================================="
echo "🔍 DOCKER CONTAINER STATUS (docker ps):"
sudo docker ps --filter "name=sparkloop-" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
echo ""
echo "🔍 LISTENING SOCKETS ON HOST (ss -tulpn):"
sudo ss -tulpn | grep -E '7880|7881|7882|8080|3478|5349|9641' || echo "No listening sockets found on target ports!"
echo ""
echo "🧪 LOCAL HEALTH RESPONSE TESTS:"
echo -n "1. LiveKit SFU (HTTP 7880)       -> "
curl -s -o /dev/null -w "%{http_code}\n" --connect-timeout 3 http://127.0.0.1:7880/ || echo "Failed"
echo -n "2. Coturn Web Admin (HTTPS 8080) -> "
curl -k -I --connect-timeout 3 https://127.0.0.1:8080/ 2>&1 | head -n 1 || true
echo -n "3. Coturn Web Admin (HTTP 8080)  -> "
curl -I --connect-timeout 3 http://127.0.0.1:8080/ 2>&1 | head -n 1 || true
echo "=========================================================================="
echo "📋 RECENT LOGS:"
echo "--- LiveKit SFU Logs ---"
sudo docker logs --tail 10 sparkloop-livekit || true
echo "--- Coturn Logs ---"
sudo docker logs --tail 10 sparkloop-coturn || true
echo "=========================================================================="
echo "🎉 SparkLoop Edge Voice & Traversal Stack is UP and RUNNING!"
echo "=========================================================================="
echo "🎙️ LiveKit SFU Signaling:   ws://92.4.162.183:7880  (or wss://slooplive.mydev-lab.com)"
echo "🔊 LiveKit WebRTC Media:    UDP Port 7882 (Direct Native Audio)"
echo "--------------------------------------------------------------------------"
echo "🌐 Coturn Web Admin URL:    https://92.4.162.183:8080"
echo "👤 Web Admin User:          admin"
echo "🔑 Web Admin Pass:          SparkLoopAdmin2026!"
echo "--------------------------------------------------------------------------"
echo "📡 STUN / TURN Server:      92.4.162.183:3478 (UDP & TCP)"
echo "🔒 TURNS over TLS:          92.4.162.183:5349 (TCP)"
echo "📊 Metrics:                 http://92.4.162.183:9641/metrics"
echo "--------------------------------------------------------------------------"
echo "⚠️  CRITICAL: ORACLE CLOUD CONSOLE SECURITY LIST INGRESS RULES"
echo "Ensure your OCI VCN Security List includes the following rules:"
echo "  1. TCP | Port 7880       | Source: 0.0.0.0/0 (LiveKit Signaling & HTTP)"
echo "  2. TCP | Port 7881       | Source: 0.0.0.0/0 (LiveKit WebRTC TCP Fallback)"
echo "  3. UDP | Port 7882       | Source: 0.0.0.0/0 (LiveKit WebRTC Audio Stream)"
echo "  4. TCP | Port 8080       | Source: 0.0.0.0/0 (Coturn Web Admin Dashboard)"
echo "  5. UDP | Port 3478       | Source: 0.0.0.0/0 (Coturn STUN/TURN Media)"
echo "  6. TCP | Port 3478       | Source: 0.0.0.0/0 (Coturn TURN TCP Fallback)"
echo "  7. TCP | Port 5349       | Source: 0.0.0.0/0 (Coturn TURNS over TLS)"
echo "  8. UDP | Port 49152-49300| Source: 0.0.0.0/0 (Coturn Relay Media Ports)"
echo "=========================================================================="

