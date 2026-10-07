#!/usr/bin/env bash
# Sobe todo o ambiente do Módulo 4 (checkout-api + payment-service + Jaeger + Prometheus + Grafana)
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
    echo "  Grafana:      http://localhost:3001 (admin/admin)"
    echo ""
    echo "Gere tráfego com:  node load.js   (ou: docker compose run --rm load)"
    exit 0
  fi
  sleep 2
done

echo "A app não respondeu em 2 minutos. Veja os logs: docker logs modulo-4-api-1"
exit 1
