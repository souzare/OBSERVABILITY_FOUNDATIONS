# Observability Foundations — Laboratório

Material de apoio e demos do curso **Observability Foundations**.

| Módulo | Conteúdo | Onde está |
|--------|----------|-----------|
| 1 — Conceitos | Infográficos: ruído vs sinal, MELT, consumidores de observabilidade | `observability-lab/modulo-1/assets/` (abra os `.html` no navegador) |
| 2 — Pilares | Demo `checkout-api` com logs, métricas e traces, rodando na AWS | `observability-lab/modulo-2/` |

---

# Módulo 2: Pilares da Observabilidade na AWS

Uma API de pedidos (`checkout-api`) instrumentada com os 3 pilares: **logs** (Pino), **métricas** (Prometheus) e **traces** (OpenTelemetry + Jaeger).

## Arquitetura

Um template do CloudFormation cria tudo:

```
Seu navegador ──(somente o seu IP)──▶ Security Group ──▶ EC2 t3.small (Amazon Linux 2023)
                                                          └─ Docker Compose
                                                              ├─ app         :3000   checkout-api
                                                              ├─ jaeger      :16686  traces
                                                              ├─ prometheus  :9090   métricas
                                                              └─ grafana     :3001   dashboards
```

- **EC2**: ao iniciar, instala o Docker, clona este repositório e executa `start.sh`.
- **Security Group**: libera as portas 3000, 3001, 9090 e 16686 apenas para o IP informado. Não há SSH.
- **IAM Role**: permite abrir o terminal da instância pelo Session Manager (sem chave `.pem`).

Custo aproximado: US$ 0,03 por hora enquanto a stack existir. **Apague a stack ao final da aula** (passo 7).

## Pré-requisitos

- Conta AWS com permissão para criar EC2, Security Group e IAM Role
- VPC padrão (default VPC) na região escolhida
- AWS CLI v2 autenticado (`aws sts get-caller-identity` deve responder)
- Este repositório publicado no GitHub como **público** — a instância faz `git clone` dele

## 1. Publicar o código no GitHub

A instância baixa o código do GitHub, então tudo precisa estar no `main`:

```bash
git add -A
```

```bash
git commit -m "Demo do módulo 2"
```

```bash
git push origin main
```

## 2. Criar os recursos na AWS

Na raiz do repositório:

```bash
aws cloudformation deploy --stack-name obsf-modulo-2 --template-file observability-lab/modulo-2/aws/cloudformation.yaml --capabilities CAPABILITY_IAM --parameter-overrides AllowedCidr=$(curl -s https://checkip.amazonaws.com)/32
```

O comando usa a região padrão do seu AWS CLI (para outra, acrescente `--region sa-east-1`) e leva cerca de 2 minutos.
O `AllowedCidr` é preenchido com o seu IP público atual. Para liberar também os alunos, troque pelo bloco de IP da rede da sala.

Parâmetros opcionais (acrescente em `--parameter-overrides`):

| Parâmetro | Padrão | Para que serve |
|-----------|--------|----------------|
| `RepoUrl` | `https://github.com/souzare/OBSERVABILITY_FOUNDATIONS.git` | Outro fork do repositório |
| `RepoBranch` | `main` | Outra branch |
| `InstanceType` | `t3.small` | `t3.medium` ou `t3.large` |

Prefere o console? **CloudFormation → Create stack → Upload a template file**, envie `observability-lab/modulo-2/aws/cloudformation.yaml`, preencha `AllowedCidr` com `SEU_IP/32` e marque a caixa de confirmação de recursos IAM.

## 3. Pegar os endereços

```bash
aws cloudformation describe-stacks --stack-name obsf-modulo-2 --query "Stacks[0].Outputs[].[OutputKey,OutputValue]" --output table
```

| Output | O que é |
|--------|---------|
| `AppUrl` | A API (`/orders`, `/metrics`) |
| `JaegerUrl` | Jaeger UI |
| `PrometheusUrl` | Prometheus |
| `GrafanaUrl` | Grafana (admin/admin) |
| `TerminalUrl` | Terminal da instância no navegador |

Depois que a stack fica pronta, a instância ainda leva **de 3 a 4 minutos** para instalar o Docker, baixar as imagens e subir a demo. Está pronta quando `AppUrl` + `/metrics` responder no navegador.

## 4. Gerar tráfego

Abra o `TerminalUrl` no navegador (ou **EC2 → Instances → obsf-modulo-2 → Connect → Session Manager**) e rode:

```bash
cd /opt/obsf/observability-lab/modulo-2
```

```bash
sudo docker compose run --rm load
```

A cada 5 segundos são enviados 50 `POST /orders` e, para cada pedido criado, um `GET /orders/:id`.
Cerca de 5% dos POST retornam 400 (payload inválido) e 5% dos GET retornam 500 (falha intermitente). Pare com `Ctrl+C`.

Para criar um pedido na mão, do seu computador (troque `APP_URL` pelo output `AppUrl`):

```bash
curl -X POST APP_URL/orders -H "Content-Type: application/json" -d '{"customer_id":"CUST-1","amount":250}'
```

## 5. O que você vai ver

### LOGS (terminal da instância)

Abra uma segunda aba do `TerminalUrl`:

```bash
sudo docker logs -f modulo-2-app-1
```

Mensagens JSON estruturadas aparecem em tempo real, duas por requisição (entrada e saída):

```json
{"level":"info","timestamp":"2026-10-05T11:54:41.778Z","service":"checkout-api","trace_id":"aae6acab...","correlation_id":"d559e416-...","method":"GET","endpoint":"/orders/ORD-6d0bb578","status":200,"duration_ms":55,"customer_id":"CUST-295","order_id":"ORD-6d0bb578","message":"requisição finalizada"}
```

Só os erros (com stack trace):

```bash
sudo docker logs modulo-2-app-1 | grep '"level":"error"'
```

### MÉTRICAS (Prometheus)

1. Abra o `PrometheusUrl`
2. Query: `http_requests_total`
3. Query: `http_request_duration_seconds_bucket`
4. Query: `orders_pending` (aba **Graph**: sobe a cada lote e desce conforme os pedidos são confirmados)
5. Os valores atualizam a cada 5s

Queries prontas para a aula:

```promql
# Requisições por segundo, por endpoint e status
sum by (endpoint, status) (rate(http_requests_total[1m]))

# Taxa de erro (%)
100 * sum(rate(http_requests_total{status=~"5.."}[1m])) / sum(rate(http_requests_total[1m]))

# Latência p95 por endpoint
histogram_quantile(0.95, sum by (le, endpoint) (rate(http_request_duration_seconds_bucket[1m])))
```

As mesmas queries funcionam no Grafana (`GrafanaUrl` → **Explore**); o datasource Prometheus já vem configurado.

### TRACES (Jaeger)

1. Abra o `JaegerUrl`
2. Service: `checkout-api`
3. Operation: `POST /orders`
4. **Find Traces** e clique em um trace para ver a timeline dos spans
   (`POST /orders` → `processar-pedido`, ou `GET /orders/:id` → `db.buscar-pedido`)
5. Para ver só as falhas: campo **Tags** com `error=true`

### Ligando os pilares

Copie o `trace_id` de uma linha de log de erro e cole na busca do Jaeger (canto superior): você cai direto no trace daquela requisição.

```bash
sudo docker logs modulo-2-app-1 | grep '"level":"error"' | tail -1
```

## 6. Observações para aula

- **Logs** mostram o QUÊ aconteceu (eventos, um a um, com todo o contexto)
- **Métricas** mostram agregados (quantos, quanto tempo)
- **Traces** mostram a HISTÓRIA completa de uma requisição (início ao fim)
- Nos logs o `endpoint` é o caminho real (`/orders/ORD-123`); nas métricas é a rota (`/orders/:id`).
  É proposital: um label por pedido criaria milhares de séries no Prometheus (alta cardinalidade).

## 7. Apagar tudo

```bash
aws cloudformation delete-stack --stack-name obsf-modulo-2
```

Isso remove a instância, o Security Group e a Role. Nada fica cobrando depois.

## Problemas comuns

| Sintoma | O que fazer |
|---------|-------------|
| As URLs não abrem | Aguarde os 3 a 4 minutos iniciais. Se o seu IP mudou (outra rede, VPN), rode o passo 2 de novo: ele atualiza o `AllowedCidr`. |
| A demo não subiu | No terminal da instância: `sudo tail -50 /var/log/cloud-init-output.log`. O erro mais comum é o `git clone` falhar porque o repositório está privado ou o código não foi enviado. |
| Atualizei o código | No terminal da instância: `cd /opt/obsf && sudo git pull && cd observability-lab/modulo-2 && sudo docker compose up -d --force-recreate app` |
| `No default VPC` ao criar a stack | Crie uma com `aws ec2 create-default-vpc` ou use outra região. |

## Segurança

A demo usa HTTP sem criptografia, Grafana com `admin/admin` e Jaeger/Prometheus sem login. Por isso o acesso é restrito ao `AllowedCidr`: não use `0.0.0.0/0` e não deixe a stack ligada fora da aula.

## Arquivos do módulo 2

| Arquivo | Para que serve |
|---------|----------------|
| `aws/cloudformation.yaml` | Recursos da AWS (EC2, Security Group, IAM Role) |
| `app.js` | A aplicação Express e toda a instrumentação |
| `load.js` | Gerador de tráfego |
| `docker-compose.yml` | App, Jaeger, Prometheus e Grafana |
| `.env` | Variáveis (porta, nome do serviço, taxa de erro) |
| `prometheus.yml` | Configuração do scrape (a cada 5s) |
| `grafana/datasources.yml` | Datasource Prometheus pré-configurado |
| `start.sh` | Sobe os containers e avisa quando estiver pronto |

## Rodar local (opcional)

Com o Docker Desktop aberto, a mesma demo roda na sua máquina:

```bash
cd observability-lab/modulo-2 && ./start.sh
```

Endereços: app em http://localhost:3000, Jaeger em http://localhost:16686, Prometheus em http://localhost:9090 e Grafana em http://localhost:3001. Para parar: `docker compose down`.
