#!/usr/bin/env bash
# Aplica na instância a última versão do código: baixa do GitHub e reconstrói os dois serviços.
# Uso (no terminal da EC2): sudo ./atualizar.sh
set -e
cd "$(dirname "$0")"

git pull
docker compose up -d --build --force-recreate api payment-service

echo "Aguardando a checkout-api responder..."
for i in $(seq 1 30); do
  if curl -s -o /dev/null http://localhost:3000/metrics; then
    echo "Pronto! Versão no ar: $(git log -1 --format='%h %s')"
    exit 0
  fi
  sleep 2
done
echo "A app não respondeu. Veja: docker logs modulo-7-api-1"
exit 1
