#!/usr/bin/env bash
# Aplica na instância a última versão do código: baixa do GitHub e recria a app.
# Uso (no terminal da EC2): sudo ./atualizar.sh
set -e
cd "$(dirname "$0")"

git pull
docker compose up -d --force-recreate app

echo "Aguardando a app responder..."
for i in $(seq 1 30); do
  if curl -s -o /dev/null http://localhost:3000/metrics; then
    echo "Pronto! Versão no ar: $(git log -1 --format='%h %s')"
    docker logs modulo-3-app-1 2>&1 | grep '"trace_sample_rate"' | tail -1
    exit 0
  fi
  sleep 2
done
echo "A app não respondeu. Veja: docker logs modulo-3-app-1"
exit 1
