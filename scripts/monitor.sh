#!/bin/bash
echo "=== System Resources ==="
echo "CPU Usage: $(top -bn1 | grep "Cpu(s)" | sed "s/.*, *\([0-9.]*\)%* id.*/\1/" | awk '{print 100 - $1"%"}')"
echo "Memory: $(free -h | awk 'NR==2{printf "%.1f/%.1fGB (%.0f%%)\n", $3/1024/1024, $2/1024/1024, $3*100/$2 }')"
echo "Disk: $(df -h / | awk 'NR==2{print $3"/"$2" ("$5")"}')"
echo "Docker: $(docker system df --format "table {{.Type}}\t{{.Size}}\t{{.Reclaimable}}")"
echo "Kubernetes: $(kubectl get nodes -o wide 2>/dev/null || echo "Kind cluster not running")"
