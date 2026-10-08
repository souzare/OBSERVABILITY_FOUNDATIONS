#!/usr/bin/env bash
# Sobe todo o ambiente do Módulo 6 (os dois serviços + Jaeger + Prometheus + Alertmanager + webhook + Grafana)
set -e
cd "$(dirname "$0")"

if ! docker info > /dev/null 2>&1; then
  echo "O Docker não está rodando. Abra o Docker Desktop e tente de novo."
  exit 1
fi

# --build: constrói as imagens dos dois serviços a partir dos Dockerfiles
docker compose up -d --build

echo "Aguardando a checkout-api responder..."
for i in $(seq 1 60); do
  if curl -s -o /dev/null http://localhost:3000/metrics; then
    echo ""
    echo "Pronto!"
    echo "  checkout-api: http://localhost:3000"
    echo "  Jaeger UI:    http://localhost:16686"
    echo "  Prometheus:   http://localhost:9090"
    echo "  Grafana:      http://localhost:3001 (dashboard aberto sem login)"
    echo "  Alertmanager: http://localhost:9093"
    echo ""
    echo "Gere tráfego com:  docker compose run --rm load --mode anomaly"
    echo "Veja os alertas:   docker logs -f modulo-6-webhook-1"
    exit 0
  fi
  sleep 2
done

echo "A app não respondeu em 2 minutos. Veja os logs: docker logs modulo-6-api-1"
exit 1
