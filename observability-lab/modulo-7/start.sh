#!/usr/bin/env bash
# Sobe o Módulo 7: os dois serviços + Datadog Agent
set -e
cd "$(dirname "$0")"

if ! docker info > /dev/null 2>&1; then
  echo "O Docker não está rodando."
  exit 1
fi

# As chaves ficam em segredos.env, que não vai para o GitHub
if [ ! -f segredos.env ] || ! grep -q '^DD_API_KEY=.\+' segredos.env; then
  echo "Falta a chave do Datadog."
  echo "  1. cp segredos.env.exemplo segredos.env"
  echo "  2. Edite segredos.env e preencha DD_API_KEY e DD_SITE"
  exit 1
fi

docker compose up -d --build

echo "Aguardando a checkout-api responder..."
for i in $(seq 1 60); do
  if curl -s -o /dev/null http://localhost:3000/metrics; then
    echo ""
    echo "Pronto!"
    echo "  checkout-api: http://localhost:3000"
    echo "  Datadog:      abra a sua conta e filtre por env:obsf-lab"
    echo ""
    echo "Confira o Agent:  docker exec modulo-7-datadog-agent-1 agent status"
    echo "Gere tráfego:     docker compose run --rm load"
    exit 0
  fi
  sleep 2
done

echo "A app não respondeu em 2 minutos. Veja os logs: docker logs modulo-7-api-1"
exit 1
