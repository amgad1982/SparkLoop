#!/bin/bash
# ==============================================================================
# SparkLoop - One-Click TURN & Web Admin Setup Script for Oracle Cloud (Ubuntu ARM64)
# Public IP: 92.4.162.183
# Web Admin: https://92.4.162.183:8080
# ==============================================================================
set -e

echo "🚀 [1/6] Updating Ubuntu package cache & installing prerequisites..."
sudo apt-get update -y
sudo apt-get install -y openssl sqlite3 curl

echo "🔒 [2/6] Configuring Ubuntu Firewall (Oracle Cloud Host iptables)..."
# Oracle Cloud Ubuntu images drop incoming traffic via iptables by default.
# We insert rules at the top of the INPUT chain to ensure WebRTC & Web Admin packets pass.
sudo iptables -I INPUT 1 -p udp --dport 3478 -j ACCEPT
sudo iptables -I INPUT 1 -p tcp --dport 3478 -j ACCEPT
sudo iptables -I INPUT 1 -p tcp --dport 5349 -j ACCEPT
sudo iptables -I INPUT 1 -p tcp --dport 8080 -j ACCEPT
sudo iptables -I INPUT 1 -p tcp --dport 9641 -j ACCEPT
sudo iptables -I INPUT 1 -p udp --dport 49152:65535 -j ACCEPT

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
    sudo ufw allow 49152:65535/udp
    sudo ufw reload
fi

echo "🔑 [3/6] Generating TLS Certificates for Web Admin & TURNS..."
mkdir -p certs data
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
sudo chown -R 65534:65534 data certs 2>/dev/null || sudo chmod -R 777 data certs

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

echo "👤 [6/6] Initializing SQLite User Database & Provisioning Accounts..."
# Launch Coturn container
sudo docker compose up -d

# Wait 2 seconds for container initialization
sleep 2

# Provision Web Admin Account and LiveKit Service Account in Coturn SQLite Database
echo "Adding admin account for Web Admin..."
sudo docker compose exec coturn turnadmin -A -u admin -r turn.sparkloop.app -p SparkLoopAdmin2026! -b /var/lib/turn/turndb || true

echo "Adding service account for LiveKit SFU..."
sudo docker compose exec coturn turnadmin -a -u sparkloop -r turn.sparkloop.app -p SparkLoopTurnSecret2026Secure! -b /var/lib/turn/turndb || true

echo ""
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
echo "--------------------------------------------------------------------------"
echo "⚠️  CRITICAL: ORACLE CLOUD CONSOLE SECURITY LIST INGRESS RULES"
echo "Ensure your OCI VCN Security List includes the following rules:"
echo "  1. TCP | Port 8080        | Source: 0.0.0.0/0 (Web Admin Interface)"
echo "  2. UDP | Port 3478        | Source: 0.0.0.0/0 (STUN & TURN Media)"
echo "  3. TCP | Port 3478        | Source: 0.0.0.0/0 (TURN TCP Fallback)"
echo "  4. TCP | Port 5349        | Source: 0.0.0.0/0 (TURNS over TLS)"
echo "  5. UDP | Port 49152-65535 | Source: 0.0.0.0/0 (Dynamic Relay Range)"
echo "=========================================================================="
