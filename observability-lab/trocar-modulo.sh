#!/usr/bin/env bash
# Coloca no ar a demo de um módulo, derrubando antes a que estiver rodando.
# Os módulos 2, 3, 4, 6 e 7 usam as mesmas portas, então só um roda por vez.
#
# Uso:  ./trocar-modulo.sh 2|3|4|6|7    sobe a demo do módulo
#       ./trocar-modulo.sh parar     derruba qualquer demo que esteja no ar
# Na instância da AWS, rode com sudo.
set -e
cd "$(dirname "$0")"

MODULOS="modulo-2 modulo-3 modulo-4 modulo-6 modulo-7"

case "$1" in
  2|3|4|6|7) ALVO="modulo-$1" ;;
  parar) ALVO="" ;;
  *) echo "Uso: $0 2|3|4|6|7|parar"; exit 1 ;;
esac

for modulo in $MODULOS; do
  if [ "$modulo" != "$ALVO" ]; then
    (cd "$modulo" && docker compose down --remove-orphans > /dev/null 2>&1) || true
  fi
done

if [ -z "$ALVO" ]; then
  echo "Nenhuma demo no ar."
  exit 0
fi

echo "Subindo a demo do $ALVO..."
cd "$ALVO"
./start.sh
