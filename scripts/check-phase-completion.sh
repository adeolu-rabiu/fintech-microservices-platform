#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Counters
TOTAL_CHECKS=0
PASSED_CHECKS=0

check_item() {
    local description="$1"
    local command="$2"
    local type="${3:-file}" # file, command, service, or custom
    
    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
    printf "%-50s " "$description"
    
    case $type in
        "file")
            if [ -f "$command" ] || [ -d "$command" ]; then
                echo -e "${GREEN}✓ PASS${NC}"
                PASSED_CHECKS=$((PASSED_CHECKS + 1))
                return 0
            else
                echo -e "${RED}✗ FAIL${NC}"
                return 1
            fi
            ;;
        "command")
            if command -v $command &> /dev/null; then
                echo -e "${GREEN}✓ PASS${NC}"
                PASSED_CHECKS=$((PASSED_CHECKS + 1))
                return 0
            else
                echo -e "${RED}✗ FAIL${NC}"
                return 1
            fi
            ;;
        "service")
            if eval $command &> /dev/null; then
                echo -e "${GREEN}✓ PASS${NC}"
                PASSED_CHECKS=$((PASSED_CHECKS + 1))
                return 0
            else
                echo -e "${RED}✗ FAIL${NC}"
                return 1
            fi
            ;;
        "custom")
            if eval $command; then
                echo -e "${GREEN}✓ PASS${NC}"
                PASSED_CHECKS=$((PASSED_CHECKS + 1))
                return 0
            else
                echo -e "${RED}✗ FAIL${NC}"
                return 1
            fi
            ;;
    esac
}

echo -e "${BLUE}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║           CloudBank Enterprise Platform Phase Checker        ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Phase 0: Development Environment Setup
echo -e "${YELLOW}=== Phase 0: Development Environment ===${NC}"
check_item "Docker installed" "docker" "command"
check_item "Docker service running" "systemctl is-active docker" "service"
check_item "kubectl installed" "kubectl" "command" 
check_item "Kind installed" "kind" "command"
check_item "Node.js installed" "node" "command"
check_item "npm installed" "npm" "command"
check_item "Git configured" "git config user.name" "service"
echo ""

# Phase 1: Project Structure & Basic Setup
echo -e "${YELLOW}=== Phase 1: Project Structure & Foundation ===${NC}"
check_item "Project README exists" "README.md" "file"
check_item "Git repository initialized" ".git" "file"
check_item "Gitignore file exists" ".gitignore" "file"
check_item "Docker Compose file exists" "docker-compose.yml" "file"
check_item "Services directory structure" "services" "file"
check_item "Auth service directory" "services/auth-service" "file"
check_item "Account service directory" "services/account-service" "file"
check_item "Scripts directory exists" "scripts" "file"
check_item "Infrastructure directory exists" "infrastructure" "file"
check_item "Web dashboard directory exists" "web-dashboard" "file"
echo ""

# Phase 1: Service Implementation Files
echo -e "${YELLOW}=== Phase 1: Service Implementation ===${NC}"
check_item "Auth service package.json" "services/auth-service/package.json" "file"
check_item "Auth service main file" "services/auth-service/server.js" "file"
check_item "Auth service Dockerfile" "services/auth-service/Dockerfile" "file"
check_item "Account service package.json" "services/account-service/package.json" "file"
check_item "Account service main file" "services/account-service/server.js" "file"
check_item "Account service Dockerfile" "services/account-service/Dockerfile" "file"
echo ""

# Phase 2: Advanced Services & Features
echo -e "${YELLOW}=== Phase 2: Advanced Services & Features ===${NC}"
check_item "Transaction service directory" "services/transaction-service" "file"
check_item "API Gateway directory" "services/api-gateway" "file"
check_item "Audit service directory" "services/audit-service" "file"
check_item "Transaction service implementation" "services/transaction-service/server.js" "file"
check_item "API Gateway implementation" "services/api-gateway/server.js" "file"
check_item "Audit service implementation" "services/audit-service/server.js" "file"
check_item "Kubernetes configurations" "infrastructure/kubernetes" "file"
check_item "Enhanced Docker Compose" "[ -s docker-compose.yml ]" "custom"
echo ""

# Phase 3: Cloud Infrastructure & Production Setup
echo -e "${YELLOW}=== Phase 3: Cloud Infrastructure ===${NC}"
check_item "Terraform modules directory" "infrastructure/terraform/modules" "file"
check_item "VPC Terraform module" "infrastructure/terraform/modules/vpc" "file"
check_item "EKS Terraform module" "infrastructure/terraform/modules/eks" "file"
check_item "Database Terraform module" "infrastructure/terraform/modules/database" "file"
check_item "Monitoring Terraform module" "infrastructure/terraform/modules/monitoring" "file"
check_item "KEDA Terraform module" "infrastructure/terraform/modules/keda" "file"
check_item "Environment configurations" "infrastructure/terraform/environments" "file"
check_item "Web dashboard source" "web-dashboard/src" "file"
check_item "Terraform installed" "terraform" "command"
echo ""

# Configuration Files
echo -e "${YELLOW}=== Configuration Files ===${NC}"
check_item "Kind cluster config" "configs/kind-config.yaml" "file"
check_item "Utility scripts available" "scripts/cloudbank-monitor.sh" "file"
check_item "Status check script" "scripts/cloudbank-status.sh" "file"
check_item "Cleanup script" "scripts/cloudbank-cleanup.sh" "file"
echo ""

# Kubernetes Setup
echo -e "${YELLOW}=== Kubernetes Infrastructure ===${NC}"
check_item "Kubernetes namespaces config" "infrastructure/kubernetes/namespaces" "file"
check_item "Kubernetes deployments config" "infrastructure/kubernetes/deployments" "file"
check_item "Kubernetes services config" "infrastructure/kubernetes/services" "file"
check_item "Kubernetes configmaps" "infrastructure/kubernetes/configmaps" "file"
check_item "Kubernetes secrets template" "infrastructure/kubernetes/secrets" "file"
check_item "Kind cluster exists" "kind get clusters | grep -q cloudbank" "custom"
echo ""

# Runtime Checks
echo -e "${YELLOW}=== Runtime Environment Checks ===${NC}"
check_item "Docker daemon accessible" "docker info" "service"
check_item "Can create containers" "docker run --rm hello-world" "service"
if kubectl cluster-info &>/dev/null; then
    check_item "Kubernetes cluster accessible" "kubectl cluster-info" "service"
    check_item "Can list Kubernetes nodes" "kubectl get nodes" "service"
else
    check_item "Kubernetes cluster accessible" "false" "custom"
    check_item "Can list Kubernetes nodes" "false" "custom"
fi
echo ""

# Service Health Checks (if running)
echo -e "${YELLOW}=== Service Health Checks ===${NC}"
if docker-compose ps --services --filter status=running | grep -q .; then
    for port in 3000 3001 3002 3003 3005; do
        service_name="Service on port $port"
        check_item "$service_name responding" "curl -s http://localhost:$port/health" "service"
    done
else
    echo -e "${YELLOW}No services currently running. Use 'cbstart' to start services.${NC}"
fi
echo ""

# Generate Summary Report
echo -e "${BLUE}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                        SUMMARY REPORT                        ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════════════╝${NC}"

COMPLETION_RATE=$((PASSED_CHECKS * 100 / TOTAL_CHECKS))
echo -e "Total Checks: ${BLUE}$TOTAL_CHECKS${NC}"
echo -e "Passed: ${GREEN}$PASSED_CHECKS${NC}"
echo -e "Failed: ${RED}$((TOTAL_CHECKS - PASSED_CHECKS))${NC}"
echo -e "Completion Rate: ${BLUE}$COMPLETION_RATE%${NC}"
echo ""

# Phase Assessment
if [ $COMPLETION_RATE -ge 90 ]; then
    echo -e "${GREEN}🎉 EXCELLENT! Your CloudBank Enterprise Platform is production-ready!${NC}"
    echo -e "${GREEN}✅ Ready for interviews and demonstrations${NC}"
elif [ $COMPLETION_RATE -ge 75 ]; then
    echo -e "${YELLOW}⚡ GOOD! Most components are ready. A few items need attention.${NC}"
    echo -e "${YELLOW}🔧 Address remaining issues for full completion${NC}"
elif [ $COMPLETION_RATE -ge 50 ]; then
    echo -e "${YELLOW}📝 IN PROGRESS: Core structure is good, continue implementation.${NC}"
    echo -e "${YELLOW}🚀 Focus on service implementation and testing${NC}"
else
    echo -e "${RED}🔨 NEEDS WORK: Basic setup incomplete.${NC}"
    echo -e "${RED}📋 Follow phase-by-phase implementation guide${NC}"
fi

echo ""
echo -e "${BLUE}💡 Next Steps:${NC}"
if [ $COMPLETION_RATE -lt 50 ]; then
    echo "1. Complete basic project structure and service implementation"
    echo "2. Set up Docker Compose for local development"
    echo "3. Implement core banking services (Auth, Account)"
elif [ $COMPLETION_RATE -lt 75 ]; then
    echo "1. Complete advanced services (Transaction, API Gateway, Audit)"
    echo "2. Set up Kubernetes local cluster"
    echo "3. Test all services with comprehensive test suite"
elif [ $COMPLETION_RATE -lt 90 ]; then
    echo "1. Complete Terraform infrastructure modules"
    echo "2. Set up production monitoring stack"
    echo "3. Finalize web dashboard implementation"
else
    echo "1. Deploy to AWS for production testing"
    echo "2. Run performance benchmarks"
    echo "3. Prepare demonstration scenarios for interviews"
fi

echo ""
echo -e "${BLUE}🛠️  Useful Commands:${NC}"
echo "  cbstart  - Start all services"
echo "  cbtest   - Run comprehensive tests"
echo "  cbstatus - Quick status overview"
echo "  cbmonitor - Detailed system monitoring"

