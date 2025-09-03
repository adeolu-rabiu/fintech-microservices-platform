#!/bin/bash

# Colors for better visibility
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║              🏦 CloudBank Enterprise Platform                 ║${NC}"
echo -e "${BLUE}║                 System Monitor Dashboard                      ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""

# System Resources
echo -e "${YELLOW}=== System Resources ===${NC}"
CPU_USAGE=$(top -bn1 | grep "Cpu(s)" | sed "s/.*, *\([0-9.]*\)%* id.*/\1/" | awk '{print 100 - $1"%"}')
MEMORY_INFO=$(free -h | awk 'NR==2{printf "%.1f/%.1fGB (%.0f%%)", $3/1024/1024, $2/1024/1024, $3*100/$2 }')
DISK_USAGE=$(df -h / | awk 'NR==2{print $3"/"$2" ("$5")"}')
UPTIME=$(uptime | awk -F'( |,|:)+' '{print $6,$7",",$8,"hours,",$9,"minutes"}')

echo -e "CPU Usage: ${GREEN}$CPU_USAGE${NC}"
echo -e "Memory: ${GREEN}$MEMORY_INFO${NC}"
echo -e "Disk: ${GREEN}$DISK_USAGE${NC}"
echo -e "Uptime: ${GREEN}$UPTIME${NC}"
echo ""

# Docker Status
echo -e "${YELLOW}=== Docker Environment ===${NC}"
if command -v docker &> /dev/null; then
    DOCKER_STATUS=$(systemctl is-active docker 2>/dev/null || echo "unknown")
    if [ "$DOCKER_STATUS" = "active" ]; then
        echo -e "Docker Status: ${GREEN}$DOCKER_STATUS${NC}"
        
        RUNNING_CONTAINERS=$(docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" 2>/dev/null | tail -n +2 | wc -l)
        echo -e "Running Containers: ${GREEN}$RUNNING_CONTAINERS${NC}"
        
        if [ $RUNNING_CONTAINERS -gt 0 ]; then
            echo -e "${BLUE}Container Details:${NC}"
            docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" 2>/dev/null | head -6
        fi
        
        echo -e "${BLUE}Storage Usage:${NC}"
        docker system df --format "table {{.Type}}\t{{.Size}}\t{{.Reclaimable}}" 2>/dev/null
    else
        echo -e "Docker Status: ${RED}$DOCKER_STATUS${NC}"
    fi
else
    echo -e "Docker: ${RED}Not installed${NC}"
fi
echo ""

# Kubernetes Status
echo -e "${YELLOW}=== Kubernetes Environment ===${NC}"
if command -v kubectl &> /dev/null; then
    # Check if CloudBank cluster exists
    if kind get clusters 2>/dev/null | grep -q cloudbank-dev; then
        echo -e "CloudBank Cluster: ${GREEN}Found${NC}"
        
        # Check cluster nodes
        NODE_STATUS=$(kubectl get nodes --no-headers 2>/dev/null | awk '{print $2}' | head -1)
        if [ "$NODE_STATUS" = "Ready" ]; then
            echo -e "Cluster Status: ${GREEN}Ready${NC}"
            
            # CloudBank namespace pods
            echo -e "${BLUE}CloudBank Pods Status:${NC}"
            if kubectl get namespace cloudbank-platform &>/dev/null; then
                kubectl get pods -n cloudbank-platform --no-headers 2>/dev/null | while read line; do
                    POD_NAME=$(echo $line | awk '{print $1}')
                    POD_STATUS=$(echo $line | awk '{print $3}')
                    if [ "$POD_STATUS" = "Running" ]; then
                        echo -e "  $POD_NAME: ${GREEN}$POD_STATUS${NC}"
                    else
                        echo -e "  $POD_NAME: ${YELLOW}$POD_STATUS${NC}"
                    fi
                done
            else
                echo -e "  ${YELLOW}CloudBank namespace not found${NC}"
            fi
        else
            echo -e "Cluster Status: ${RED}$NODE_STATUS${NC}"
        fi
    else
        echo -e "CloudBank Cluster: ${RED}Not found${NC}"
        echo -e "  ${BLUE}Run 'cbcreate' to create cluster${NC}"
    fi
else
    echo -e "kubectl: ${RED}Not installed${NC}"
fi
echo ""

# CloudBank Services Status
echo -e "${YELLOW}=== CloudBank Services Status ===${NC}"
if [ -f ~/cloudbank-enterprise-platform/docker-compose.yml ]; then
    cd ~/cloudbank-enterprise-platform
    
    # Check if services are running
    SERVICES_RUNNING=$(docker-compose ps --services --filter status=running 2>/dev/null | wc -l)
    TOTAL_SERVICES=$(docker-compose ps --services 2>/dev/null | wc -l)
    
    echo -e "Services Running: ${GREEN}$SERVICES_RUNNING${NC}/${TOTAL_SERVICES}"
    
    # Check individual service health
    echo -e "${BLUE}Service Health Checks:${NC}"
    
    # API Gateway
    if curl -s http://localhost:3000/health &>/dev/null; then
        echo -e "  API Gateway (3000): ${GREEN}Healthy${NC}"
    else
        echo -e "  API Gateway (3000): ${RED}Unhealthy${NC}"
    fi
    
    # Individual services
    for port in 3001 3002 3003 3005; do
        if curl -s http://localhost:$port/health &>/dev/null; then
            SERVICE_NAME=$(curl -s http://localhost:$port/health | jq -r '.service' 2>/dev/null || echo "Unknown")
            echo -e "  $SERVICE_NAME ($port): ${GREEN}Healthy${NC}"
        else
            echo -e "  Service ($port): ${RED}Unhealthy${NC}"
        fi
    done
    
else
    echo -e "CloudBank Project: ${RED}Not found${NC}"
    echo -e "  ${BLUE}Run 'cb' to navigate to project${NC}"
fi
echo ""

# Network Status
echo -e "${YELLOW}=== Network Status ===${NC}"
LISTENING_PORTS=$(netstat -tlnp 2>/dev/null | grep -E "(3000|3001|3002|3003|3005|3010)" | wc -l)
echo -e "CloudBank Ports Active: ${GREEN}$LISTENING_PORTS${NC}"

if [ $LISTENING_PORTS -gt 0 ]; then
    echo -e "${BLUE}Active Ports:${NC}"
    netstat -tlnp 2>/dev/null | grep -E "(3000|3001|3002|3003|3005|3010)" | while read line; do
        PORT=$(echo $line | awk '{print $4}' | sed 's/.*://')
        echo -e "  Port $PORT: ${GREEN}Active${NC}"
    done
fi
echo ""

# Quick Actions
echo -e "${YELLOW}=== Quick Actions ===${NC}"
echo -e "${BLUE}Available Commands:${NC}"
echo -e "  cbstart  - Start all services"
echo -e "  cbstop   - Stop all services"  
echo -e "  cbtest   - Run test suite"
echo -e "  cbstatus - Detailed status"
echo -e "  cbopen   - Show service URLs"

