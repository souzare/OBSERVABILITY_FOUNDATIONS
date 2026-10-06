#!/usr/bin/env bash
# Sobe todo o ambiente do Módulo 3 (app + Jaeger + Prometheus + Grafana)
set -e
cd "$(dirname "$0")"

if ! docker info > /dev/null 2>&1; then
  echo "O Docker não está rodando. Abra o Docker Desktop e tente de novo."
  exit 1
fi

docker compose up -d

# Na primeira vez a app instala as dependências (npm install), então pode demorar
echo "Aguardando a app responder..."
for i in $(seq 1 60); do
  if curl -s -o /dev/null http://localhost:3000/metrics; then
    echo ""
    echo "Pronto!"
    echo "  App:        http://localhost:3000"
    echo "  Jaeger UI:  http://localhost:16686"
    echo "  Prometheus: http://localhost:9090"
    echo "  Grafana:    http://localhost:3001 (admin/admin)"
    echo ""
    echo "Gere tráfego com:  node load.js   (ou: docker compose run --rm load)"
    exit 0
  fi
  sleep 2
done

echo "A app não respondeu em 2 minutos. Veja os logs: docker logs modulo-3-app-1"
exit 1
