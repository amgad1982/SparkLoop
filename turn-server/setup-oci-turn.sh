#!/bin/bash
# ==============================================================================
# SparkLoop - One-Click Turn Server Setup Script for Oracle Cloud (Ubuntu ARM64)
# Public IP: 92.4.162.183
# ==============================================================================
set -e

echo "🚀 [1/5] Updating Ubuntu package cache..."
sudo apt-get update -y

echo "🔒 [2/5] Configuring Ubuntu Firewall (Oracle Cloud Host iptables)..."
# Oracle Cloud Ubuntu images drop incoming traffic via iptables by default.
# We insert rules at the top of the INPUT chain to ensure WebRTC & TURN packets pass.
sudo iptables -I INPUT 1 -p udp --dport 3478 -j ACCEPT
sudo iptables -I INPUT 1 -p tcp --dport 3478 -j ACCEPT
sudo iptables -I INPUT 1 -p tcp --dport 5349 -j ACCEPT
sudo iptables -I INPUT 1 -p udp --dport 49152:65535 -j ACCEPT

# If iptables-persistent is installed, save the rules across reboots
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
    sudo ufw allow 49152:65535/udp
    sudo ufw reload
fi

echo "⚡ [3/5] Optimizing Linux Kernel sysctl for High-Concurrency UDP/WebRTC..."
sudo tee -a /etc/sysctl.d/99-coturn-tuning.conf > /dev/null <<EOF
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

echo "🐳 [4/5] Checking Docker & Docker Compose..."
if ! command -v docker &> /dev/null; then
    echo "Installing Docker..."
    curl -fsSL https://get.docker.com | sudo sh
    sudo usermod -aG docker $USER
fi

echo "🚀 [5/5] Starting Coturn Server via Docker Compose..."
sudo docker compose up -d

echo ""
echo "=========================================================================="
echo "✅ SparkLoop TURN Server is running successfully on 92.4.162.183:3478!"
echo "=========================================================================="
echo "⚠️  CRITICAL REMINDER FOR ORACLE CLOUD CONSOLE:"
echo "Make sure to add the following INGRESS RULES to your OCI VCN Security List:"
echo "  1. IP Protocol: UDP | Source: 0.0.0.0/0 | Destination Port: 3478"
echo "  2. IP Protocol: TCP | Source: 0.0.0.0/0 | Destination Port: 3478"
echo "  3. IP Protocol: TCP | Source: 0.0.0.0/0 | Destination Port: 5349"
echo "  4. IP Protocol: UDP | Source: 0.0.0.0/0 | Destination Port: 49152-65535"
echo "=========================================================================="

