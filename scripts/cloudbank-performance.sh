#!/bin/bash
echo "📊 CloudBank Performance Monitor"
echo "==============================="

# Service response times
echo "Service Response Times:"
for port in 3000 3001 3002 3003 3005; do
    if curl -s http://localhost:$port/health >/dev/null; then
        RESPONSE_TIME=$(curl -s -w "%{time_total}" -o /dev/null http://localhost:$port/health)
        echo "  Port $port: ${RESPONSE_TIME}s"
    fi
done

# Resource usage by containers
echo ""
echo "Container Resource Usage:"
docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}" 2>/dev/null

