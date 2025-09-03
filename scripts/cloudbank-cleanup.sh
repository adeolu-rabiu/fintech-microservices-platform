#!/bin/bash
echo "🧹 CloudBank Platform Cleanup"
echo "============================="

# Stop all services
echo "Stopping Docker services..."
cd ~/cloudbank-enterprise-platform 2>/dev/null && docker-compose down

# Clean Docker resources
echo "Cleaning Docker resources..."
docker system prune -f
docker volume prune -f

# Clean Kubernetes resources
echo "Cleaning Kubernetes resources..."
kubectl delete namespace cloudbank-platform 2>/dev/null || true

echo "✅ Cleanup completed!"
