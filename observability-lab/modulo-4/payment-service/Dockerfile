FROM node:22-alpine
WORKDIR /app

# Primeiro as dependências (esta camada fica em cache enquanto o package.json não mudar)
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund

COPY . .
CMD ["node", "app.js"]
