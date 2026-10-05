# PROMPTS PARA CLAUDE CODE - OBSERVABILITY LAB
## Aulas Incrementais (Módulos 1-8)

Instruções: Copie um prompt por vez e cole no Claude Code. Cada prompt gera código + README + docker-compose pronto para usar.

---

## 📌 MÓDULO 1: Explorando Observabilidade

**Duração da Aula:** 2h30min (sem demo técnica)  
**Entrega:** 3 Infografias HTML interativas  
**Uso:** Você exibe na tela durante aula teórica

### PROMPT PARA CLAUDE CODE:

```
Crie 3 infografias HTML/SVG interativas para aula de Observabilidade, 
salvas em pasta modulo-1/assets/. Cada uma deve ser HTML puro (sem React), 
aberto direto no navegador.

1. INFOGRÁFICO: "Ruído vs Sinal"
   - Layout lado a lado (50/50)
   - ESQUERDA (Ruído):
     * Cor de fundo: vermelho claro (#ffebee)
     * Mostra: 10.000 alertas por dia, 99% inúteis
     * Icon: alert bell com X vermelho
     * Mensagem: "Dashboard poluído. Impossível encontrar o real problema"
   - DIREITA (Sinal):
     * Cor de fundo: verde claro (#e8f5e9)
     * Mostra: 50 alertas por dia, todos relevantes
     * Icon: alert bell com check verde
     * Mensagem: "Insights claros. Ações rápidas baseadas em dados"
   - Dimensões: 1200x600px, responsivo
   - Font: Inter ou similar, titulo bold

2. INFOGRÁFICO: "MELT - Os 4 Pilares"
   - 4 quadrantes em grid 2x2
   - Cada quadrante:
     * Título: METRICS | EVENTS | LOGS | TRACES
     * Definição: 1 linha clara
     * Ícone SVG simples (barras, evento, texto, link)
     * Exemplo visual (fake data)
   - Dimensões: 1200x400px, cores diferentes por pilar
   - Abaixo: seta mostrando como se complementam

3. MODAL INTERATIVO: "Consumidores de Observabilidade"
   - Dropdown/botões selecionáveis com 4 perfis:
     a) DevOps Engineer - Precisa de: Infraestrutura, Performance, Alertas
     b) SRE - Precisa de: SLIs, SLOs, Error Budget, Confiabilidade
     c) Developer - Precisa de: Logs detalhados, Traces, Debugging
     d) Security Team - Precisa de: Eventos de segurança, Anomalias, Compliance
   - Ao clicar em cada perfil, mostra ícone + lista do que precisa
   - Dimensões: 800x500px
   - Interatividade: destaque com border/sombra

REQUISITOS:
- HTML puro (nada de build, frameworks ou imports)
- Salve cada infográfico em arquivo .html separado
- Pasta: observability-lab/modulo-1/assets/
- Nomes: infografico-ruido-sinal.html, infografico-melt.html, modal-consumidores.html
- Inclua CSS inline dentro do HTML
- Responsivo (funcione em mobile também)
- Cores: use palette profissional (azul, verde, vermelho, cinza)
```

---

## 📌 MÓDULO 2: Pilares da Observabilidade (Demo Técnica)

**Duração da Demo:** 15-20 min  
**O que você vai mostrar:**
- App subindo com Docker Compose
- Gerando tráfego (requests com load.js)
- **Logs estruturados** no console
- **Métricas** aparecendo no Prometheus
- **Traces básicos** no Jaeger

### PROMPT PARA CLAUDE CODE:

```
Crie uma aplicação Node.js instruída com OpenTelemetry (básico) que 
demonstre os 3 pilares: LOGS, METRICS, TRACES. Deve rodar local com 
Docker Compose. Foco: simplicidade e clareza visual para aula.

ESTRUTURA:
- Pasta: observability-lab/modulo-2/
- Arquivos:
  * app.js (aplicação Express)
  * package.json (dependências)
  * docker-compose.yml (orquestração)
  * .env (variáveis)
  * load.js (gera tráfego para demo)
  * README.md (instruções executivas)
  * start.sh (script que sobe tudo)

APLICAÇÃO (app.js):

1. EXPRESS SERVER:
   - Porta: 3000
   - 2 endpoints:
     * POST /orders (cria pedido)
       - Entrada: { customer_id, amount }
       - Processa: simula lógica (100-500ms latência aleatória)
       - Saída: { order_id, status, timestamp }
     * GET /orders/:id (busca pedido)
       - Simula busca em "db" (50ms latência)
       - 5% chance de erro (simula falha intermitente)

2. LOGS ESTRUTURADOS (Pino):
   - Format JSON estruturado
   - Campos obrigatórios: timestamp, level, endpoint, method, status, duration_ms, customer_id
   - Log cada request (entrada e saída)
   - Log erros com stack trace
   - Apareça no console (stdout) enquanto roda

3. MÉTRICAS (prom-client):
   - Contador http_requests_total:
     * Labels: method, endpoint, status
   - Histogram http_request_duration_seconds:
     * Buckets: [0.01, 0.05, 0.1, 0.5, 1, 2]
   - Gauge orders_pending:
     * Atualizado a cada POST /orders
   - Endpoint: GET /metrics (Prometheus scrape)

4. TRACES BÁSICOS (OpenTelemetry SDK):
   - Initialize TracerProvider com Jaeger Exporter
   - Resource attributes: service.name="checkout-api", service.version="1.0.0"
   - Cada request = 1 root span
   - Span attributes: customer_id, order_id, method, endpoint
   - Exporte para Jaeger via HTTP (localhost:6831)

DOCKER-COMPOSE (docker-compose.yml):
Serviços:
- app (Node.js): porta 3000, volume ./app.js
- jaeger (all-in-one): porta 16686 (UI), 6831 (UDP)
- prometheus: porta 9090, scrape /metrics a cada 5s
- grafana: porta 3000, datasource Prometheus preconfigurado

SCRIPT LOAD (load.js):
- Faz 50 requests POST /orders a cada 5 segundos
- Headers customizados: X-Correlation-ID (UUID)
- Payload: { customer_id: "CUST-" + random, amount: 100-1000 }
- Simula 5% de erro (400, 500)
- Roda indefinidamente até Ctrl+C
- Output: "[timestamp] POST /orders - Status 200"

README.md:
```bash
# Módulo 2: Pilares da Observabilidade

## Setup
cd observability-lab/modulo-2

## Iniciar aplicação
./start.sh

Isso sobe:
- App: http://localhost:3000
- Jaeger UI: http://localhost:16686
- Prometheus: http://localhost:9090
- Grafana: http://localhost:3000 (admin/admin)

## Gerar tráfego (em outro terminal)
node load.js

## O que você vai ver:

### LOGS (console)
tail docker logs de app:
docker logs -f modulo-2-app-1

Mensagens JSON estruturadas aparecem em tempo real.

### MÉTRICAS (Prometheus)
1. Acesse: http://localhost:9090
2. Query: http_requests_total
3. Query: http_request_duration_seconds
4. Atualizando a cada 5s

### TRACES (Jaeger)
1. Acesse: http://localhost:16686
2. Service: checkout-api
3. Operation: POST /orders
4. Clique para ver timeline dos spans

## Parar aplicação
docker-compose down

## Observações para aula:
- Logs mostram o QUÊ aconteceu (eventos)
- Métricas mostram agregados (quantos, quanto tempo)
- Traces mostram a HISTÓRIA completa (início ao fim)
```

REQUISITOS:
- Código simples, legível, sem abstrações
- Sem dependências pesadas (Express, Pino, @opentelemetry/sdk-node)
- Docker Compose roda local sem AWS
- README com commands copy-paste
- start.sh script que faz: docker-compose up -d && echo "Pronto!"
- Cada arquivos bem organizado
```

---

## 📌 MÓDULO 3: OpenTelemetry (Refatoração)

**Duração da Demo:** 15-20 min  
**O que você vai mostrar:**
- Mesma app do M2, mas refatorada com OTEL production-ready
- Traces muito mais detalhados (spans aninhados)
- Correlação entre logs e traces (trace_id, span_id em logs)
- Jaeger mostrando spans filhos detalhados

### PROMPT PARA CLAUDE CODE:

```
Refatore o código do Módulo 2 com OpenTelemetry SDK production-ready.
Foco: span hierarchy, baggage, span events, log correlation.

PASTA: observability-lab/modulo-3/

MUDANÇAS EM RELAÇÃO AO M2:

1. TRACING AVANÇADO (app.js):
   - Remova tracing manual do M2
   - Use @opentelemetry/auto (auto-instrumentation HTTP/Express)
   - Configure TracerProvider:
     * service.name="checkout-api"
     * service.version="1.0.0"
   
2. SPAN HIERARCHY (POST /orders):
   Root Span: "process_order"
   ├─ Child Span: "validate_order" (50ms)
   │  └─ Span Event: "validation.passed" ou "validation.failed"
   ├─ Child Span: "save_to_database" (200ms)
   │  └─ Span Attributes: { rows_affected: 1, db_latency_ms: 195 }
   └─ Child Span: "send_confirmation_email" (150ms simulated)
      └─ Span Event: "email.queued"

3. ATTRIBUTES + BAGGAGE:
   - Baggage (propaga entre spans):
     * customer_id
     * order_id
     * correlation_id (gerado por cada request)
   - Span Attributes:
     * payment_method (ex: "credit_card")
     * customer_tier (ex: "premium")
     * tentativas (counter de retries)

4. LOG CORRELATION:
   - Injete trace_id e span_id nos logs
   - Formato JSON: { trace_id, span_id, severity, message, ...}
   - Exemplo:
     {
       "timestamp": "2026-10-03T15:30:00Z",
       "trace_id": "4bf92f3577b34da6a3ce929d0e0e4736",
       "span_id": "00f067aa0ba902b7",
       "level": "INFO",
       "message": "Order validated successfully"
     }

5. SPAN EVENTS:
   - Adicione eventos aos spans:
     * "order.validation.started"
     * "order.validation.passed" / "order.validation.failed"
     * "database.insert.completed"
     * "email.send.queued"

6. ERROR HANDLING:
   - Quando erro ocorre: span.setStatus({code: SpanStatusCode.ERROR})
   - Adicione span.recordException(error)
   - Log com severity ERROR

DOCKER-COMPOSE:
- Mesma do M2
- Adicione variáveis: OTEL_EXPORTER_JAEGER_ENDPOINT=http://jaeger:6831

LOAD SCRIPT (load.js):
- Mesmo do M2, mas adicione cabeçalhos:
  * X-Correlation-ID: uuid()
  * X-Customer-Tier: "premium" ou "standard"

README:
```bash
cd observability-lab/modulo-3
./start.sh
node load.js

# Jaeger UI: http://localhost:16686

O que mudou:
- Traces agora mostram HIERARQUIA de spans
- Cada span tem atributos (metadata)
- Timeline visual mostra qual operação levou mais tempo
- Logs correlacionados com trace_id (clique em Log → vê trace)
```

REQUISITOS:
- Mantenha simplicidade
- Código legível (sem magic)
- Sem mudanças em Docker/Prometheus/Grafana (reutiliza M2)
- README explica o que são baggage, attributes, events
```

---

## 📌 MÓDULO 4: Service Maps e Topology

**Duração da Demo:** 15-20 min  
**O que você vai mostrar:**
- App com 2 serviços (API + Payment Service)
- Jaeger mostrando service map (visual das dependências)
- Traces distribuídos entre serviços
- W3C traceparent propagação

### PROMPT PARA CLAUDE CODE:

```
Estenda a aplicação do Módulo 3 com um segundo serviço (Payment Service).
Foco: propagação de trace entre serviços, service map no Jaeger.

PASTA: observability-lab/modulo-4/

ESTRUTURA:
observability-lab/modulo-4/
├── api/
│   ├── app.js (refatorado M3)
│   └── package.json
├── payment-service/
│   ├── app.js (NOVO)
│   └── package.json
├── docker-compose.yml (2 serviços)
├── load.js (MESMO M3)
├── README.md
└── start.sh

NOVO SERVIÇO: Payment Service (payment-service/app.js)

1. EXPRESS SERVER:
   - Porta: 3001
   - 1 Endpoint: POST /process-payment
   - Entrada: { order_id, amount, customer_id }
   - Output: { success: true/false, transaction_id, timestamp }
   - Latência: 200-400ms (normal) | timeout 5% das vezes
   - OpenTelemetry tracing (sama do M3)

2. TRACE PROPAGATION:
   - Receba W3C traceparent header de API
   - Leia trace_id e span_id
   - Continue o MESMO trace (não cria novo)
   - Create child span: "process_payment"

3. SIMULA FALHA:
   - 5% das requisições: retorna { success: false, error: "timeout" }
   - Span.setStatus(ERROR)

INTEGRAÇÃO API → PAYMENT (api/app.js):

POST /orders now:
1. Valida pedido (span: "validate_order")
2. Salva em DB (span: "save_to_database")
3. **NOVO**: Chama Payment Service (span: "call_payment_service")
   - HTTP POST http://payment-service:3001/process-payment
   - Propaga trace context via W3C traceparent header
   - Se erro: retry 1x automaticamente
4. Log resposta
5. Retorna ao cliente

JAEGER MOSTRA:
- 1 trace global com spans de AMBOS os serviços
- Timeline visual:
  └─ checkout-api:process_order
     ├─ checkout-api:validate_order
     ├─ checkout-api:save_to_database
     └─ checkout-api:call_payment_service
        └─ payment-service:process_payment (RED se erro)

- Service Map (Jaeger UI):
  * Caixa 1: checkout-api
  * Caixa 2: payment-service
  * Seta: checkout-api → payment-service
  * Números: requisições/s, erro %, latência P95

DOCKER-COMPOSE:
```yaml
version: "3.8"
services:
  api:
    build: ./api
    ports:
      - "3000:3000"
    environment:
      - JAEGER_ENDPOINT=http://jaeger:6831
      - PAYMENT_SERVICE_URL=http://payment-service:3001
  
  payment-service:
    build: ./payment-service
    ports:
      - "3001:3001"
    environment:
      - JAEGER_ENDPOINT=http://jaeger:6831
  
  jaeger:
    image: jaegertracing/all-in-one:latest
    ports:
      - "16686:16686"
  
  prometheus:
    image: prom/prometheus
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
  
  grafana:
    image: grafana/grafana:latest
    ports:
      - "3000:3000"
```

LOAD SCRIPT (load.js):
- Mesmo do M3 (50 req/5s)
- Resultado: 5% falha no payment → traces com erro visível

README:
```bash
cd observability-lab/modulo-4
./start.sh
node load.js

# Jaeger: http://localhost:16686
# Prometheus: http://localhost:9090
# Grafana: http://localhost:3000

Clique em "Service Map" → veja 2 boxes com seta
Clique em uma trace vermelha → veja erro propagado entre serviços
```

REQUISITOS:
- 2 serviços independentes, ambos com OTEL
- Trace context propagação via W3C headers
- 5% erro rate no payment para demonstrar
- Dockerfile para cada serviço
```

---

## 📌 MÓDULO 5: DataOps e CIA Triad

**Duração da Demo:** 10-15 min  
**O que você vai mostrar:**
- Conceito CIA Triad (Confidentiality, Integrity, Availability)
- Dados de observabilidade sendo coletados
- Exemplo: data masking em logs sensíveis

### PROMPT PARA CLAUDE CODE:

```
Crie um infográfico interativo HTML (CIA Triad) + exemplo de código que 
mascara dados sensíveis ANTES de enviar para observabilidade.

PASTA: observability-lab/modulo-5/

ENTREGA 1: CIA Triad Interativo (assets/cia-triad.html)

- Layout: 3 círculos (Confidentiality, Integrity, Availability)
- Interativo: Ao clicar em cada círculo, mostra:

  CONFIDENTIALITY (azul):
  - Descrição: "Dados não expostos sem autorização"
  - Exemplo da app:
    * ❌ customer_email em logs: "john@example.com"
    * ✅ customer_email mascarado: "j***@*.com"
    * ❌ credit_card em traces: "4532-1234-5678-9999"
    * ✅ credit_card mascarado: "****-****-****-9999"

  INTEGRITY (verde):
  - Descrição: "Dados não podem ser alterados"
  - Exemplo da app:
    * trace_id sempre igual: "4bf92f3577b34da6a3ce929d0e0e4736"
    * timestamp imutável: "2026-10-03T15:30:00Z"
    * hash do payload: nunca muda se ordem não muda

  AVAILABILITY (laranja):
  - Descrição: "Dados sempre acessíveis"
  - Exemplo da app:
    * Prometheus backup: 2 instâncias
    * Jaeger com persistência (volumes)
    * Grafana dashboard sempre disponível

- Dimensões: 1000x600px
- Cores: azul, verde, laranja
- Font: sans-serif

ENTREGA 2: Data Masking Library (data-masking.js)

Funções que mascaram dados sensíveis:

```javascript
// Masking functions
maskEmail(email) → "j***@*.com"
maskCreditCard(cc) → "****-****-****-9999"
maskCustomerId(id) → "CUST-****"
maskPhone(phone) → "***-****-1234"
maskIPAddress(ip) → "192.168.***.**"

// Usar nos logs antes de exporter:
log({
  ...eventData,
  customer_email: maskEmail(eventData.customer_email),
  credit_card: maskCreditCard(eventData.credit_card),
})
```

ENTREGA 3: README (modulo-5/README.md)

```bash
# Módulo 5: DataOps e CIA Triad

## CIA Triad na Observabilidade

Confidentiality (Confidencialidade):
- Mask dados sensíveis em logs/traces
- Exemplo: email → j***@example.com

Integrity (Integridade):
- trace_id nunca muda durante requisição
- timestamp é imutável
- hash do payload não deve variar

Availability (Disponibilidade):
- Dados sempre acessíveis quando necessário
- Backup de métricas (Prometheus HA)
- Persistência de traces (Jaeger storage)

## Data Masking na Prática

Use a função maskEmail() nos logs:
- ANTES: customer_email: "john.doe@company.com"
- DEPOIS: customer_email: "j***@*.com"

Implementado em: ../modulo-4/api/app.js (usar no M6)
```

REQUISITOS:
- CIA Triad: HTML puro, interativo, visual atraente
- Data masking: funções reutilizáveis
- README com exemplos práticos
- Foco pedagógico (mostra PORQUÊ mascarar)
```

---

## 📌 MÓDULO 6: AIOps e Anomaly Detection

**Duração da Demo:** 15-20 min  
**O que você vai mostrar:**
- Anomalias sendo injetadas na app
- Grafana mostrando spike de latência
- Alertmanager gerando alertas inteligentes
- Redução de ruído (correlação vs threshold fixo)

### PROMPT PARA CLAUDE CODE:

```
Estenda a aplicação do M4 com simulação de anomalias e alerting inteligente.

PASTA: observability-lab/modulo-6/

MUDANÇAS:

1. ANOMALY INJECTION (load.js):
   - Modo normal (padrão): 50 req/5s, 5% erro
   - Modo anomaly (flag --mode anomaly):
     * 0-2min: normal
     * 2min: payment-service fica lento (2000ms latência)
     * 4min: volta ao normal
   - Resultado: spike visível no Grafana

2. ALERTING (docker-compose.yml + prometheus.yml):
   - Adicione Alertmanager (porta 9093)
   - Configure regras em prometheus.yml:
     * Alert 1: http_request_duration_seconds > 1s (5 ocorrências)
     * Alert 2: payment_service_error_rate > 10%
     * Alert 3: orders_pending > 100
   - Alertmanager rota para: webhook dummy (localhost:5001)

3. ALERTMANAGER CONFIG (alertmanager.yml):
   - Routes:
     * Group by: alertname, severity
     * Group wait: 10s
     * Group interval: 10s
   - Receivers:
     * webhook (POST http://webhook-dummy:5001/alerts)

4. WEBHOOK DUMMY (webhook.js):
   - Express server na porta 5001
   - Endpoint: POST /alerts
   - Log recebido: console.log("Alert received:", body)
   - Você vai ver alertas em tempo real

5. GRAFANA DASHBOARDS:
   - Card 1: Taxa de requisições (linha com spike)
   - Card 2: Latência P95 (mostra spike 2s)
   - Card 3: Error rate (5% baseline)
   - Card 4: Alertas (lista de alertas ativos)

6. README EXPLAIN:
   - Diferença: threshold burro (latência > 1s sempre alerta) 
     vs inteligente (baseline + desvio padrão)
   - Como ML detectaria anomalia automaticamente
   - Burn rate e error budget (preview do M8)

DOCKER-COMPOSE:
```yaml
# Adicione services:
  alertmanager:
    image: prom/alertmanager:latest
    ports:
      - "9093:9093"
    volumes:
      - ./alertmanager.yml:/etc/alertmanager/alertmanager.yml
  
  webhook:
    build: ./webhook
    ports:
      - "5001:5001"
```

LOAD SCRIPT (load.js):
```bash
node load.js --mode anomaly

# Timeline:
# 0-2min: normal requests
# 2min: Payment service latency spike
# 4min: volta ao normal
# 
# Resultado: Alertas acionam no Alertmanager
```

README:
```bash
cd observability-lab/modulo-6
./start.sh
node load.js --mode anomaly

# Grafana: http://localhost:3000
# Alertmanager: http://localhost:9093

Watch terminal do webhook para ver alerts chegando:
docker logs -f modulo-6-webhook-1

Após 2min: verá spike no Grafana + alertas no Alertmanager
```

REQUISITOS:
- Anomaly injection simples (delay controlado)
- Alertmanager funcionando
- Webhook dummy recebendo alertas
- Grafana dashboard mostrando tudo
```

---

## 📌 MÓDULO 7: Security + Network Observability

**Duração da Demo:** 15-20 min  
**O que você vai mostrar:**
- eBPF simulado capturando network calls
- Golden Signals de networking (latência, throughput, packet loss)
- Container security scan
- Network topology no Grafana

### PROMPT PARA CLAUDE CODE:

```
Adicione segurança + networking observability ao M6.

PASTA: observability-lab/modulo-7/

MUDANÇAS:

1. EBPF SIMULADO (network-monitor.js):
   - Script que "monitora" conexões via Prometheus
   - Métrica: network_connections_total
     * Labels: source_service, destination_service, protocol
   - Métrica: network_bytes_transferred
     * Labels: direction (inbound/outbound)
   - Simula captura: api → payment-svc, api → jaeger, etc
   - Exporta para Prometheus

2. GOLDEN SIGNALS NETWORKING (prometheus.yml):
   - Latency: http_request_duration_seconds (JÁ TEMOS)
   - Throughput: http_requests_total (JÁ TEMOS)
   - Packet Loss: custom metric (2% loss aleatória)
     * network_packet_loss_percent
   - Uptime: health_check_status
     * GET /health em ambos serviços

3. CONTAINER SECURITY:
   - Dockerfile (api + payment-svc):
     * Base: node:18-alpine (seguro)
     * Non-root user: RUN useradd -m appuser
     * No sudo, sem ferramentas desnecessárias
   - README com Trivy scan:
     ```bash
     trivy image observability-lab:modulo-7
     ```

4. NETWORK TOPOLOGY (Grafana):
   - Nova dashboard "Network Topology"
   - Visual: nodes (api, payment-svc, jaeger, prometheus)
   - Edges (conexões) com cores:
     * Verde: latência < 100ms
     * Amarelo: 100-500ms
     * Vermelho: > 500ms
   - Números em cada edge: req/s, error %

5. README:
   - Explique eBPF (simulado aqui, real seria via BCC/LLVM)
   - Como Datadog usaria eBPF em produção
   - Golden Signals de networking
   - Container security best practices

DOCKER-COMPOSE:
- Adicione network-monitor service (Node.js)
- Expõe métricas em /metrics

README:
```bash
cd observability-lab/modulo-7
./start.sh
node load.js --mode anomaly

# Grafana: Network Topology dashboard
# Prometheus: metrics de rede

# Scan container:
trivy image observability-lab/api:modulo-7
```

REQUISITOS:
- eBPF simulado (sem kernel programming real)
- Golden Signals implementados
- Dockerfile seguro
- Trivy scan funciona
```

---

## 📌 MÓDULO 8: SLOs + Chaos Engineering

**Duração da Demo:** 20-25 min  
**O que você vai mostrar:**
- SLI/SLO definido para a app
- Dashboard SLO no Grafana (burn rate, error budget)
- Teste de Chaos (mata payment service)
- App se recupera, monitora impacto no SLO

### PROMPT PARA CLAUDE CODE:

```
Integre SLOs + Chaos Engineering na aplicação M7.

PASTA: observability-lab/modulo-8/

ESTRUTURA:
observability-lab/modulo-8/
├── api/ (do M7)
├── payment-service/ (do M7)
├── docker-compose.yml
├── prometheus-slo.yml (NOVO)
├── slo-definition.yml (NOVO)
├── chaos-test.sh (NOVO)
├── load.js (M7)
├── README.md (atualizado)
└── start.sh

1. SLI/SLO DEFINITION (slo-definition.yml):

Service Level Indicator (SLI):
- Checkout API:
  * Requisições que completam em < 1000ms com status 200
  * SLI = (sucesso_count / total_count) * 100
  
- Payment Service:
  * Requisições que completam em < 500ms com status 200
  * SLI = (sucesso_count / total_count) * 100

Service Level Objective (SLO):
- Checkout: 99.5% de requisições atendem SLI em 30 dias
- Payment: 99.9% de requisições atendem SLI em 30 dias

Service Level Agreement (SLA):
- Se SLO quebra: -5% do valor mensal (contratual)

2. SLO CALCULATION (prometheus-slo.yml):

Rules:
```yaml
- name: slo_rules
  rules:
    - record: slo:success_rate:5m
      expr: (sum(rate(http_requests_total{status="200"}[5m])) / sum(rate(http_requests_total[5m]))) * 100
    
    - record: slo:error_budget_percent:5m
      expr: ((100 - 99.5) / 100) * 100
    
    - alert: SLOErrorBudgetExhausted
      expr: slo:success_rate:5m < 99.5
      for: 5m
```

3. GRAFANA DASHBOARD (SLO):
   - Row 1: SLO Status
     * Gauge: "SLO Atual" (99.5%)
     * Gauge: "Meta" (99.5%)
     * Status: 🟢 OK / 🔴 BREACHED
   
   - Row 2: Error Budget
     * Card: "Erro Budget Restante" (X%)
     * Timeline: histórico últimas 4 semanas
     * Burn Rate (%)
   
   - Row 3: Detalhes
     * Tabela: requestsOK, requestsFailed, successRate%, burnRate%

4. CHAOS TEST SCRIPT (chaos-test.sh):

```bash
#!/bin/bash

echo "=== CHAOS ENGINEERING TEST ==="
echo "Fase 1: Observar SLO normal (10s)"
sleep 10

echo "Fase 2: Injetar falha (payment-service pausa por 30s)"
docker-compose pause payment-service
sleep 30
docker-compose unpause payment-service

echo "Fase 3: Observar recuperação (30s)"
sleep 30

echo "=== TESTE COMPLETO ==="
echo "SLO antes: 99.5%"
echo "SLO durante chaos: ~95% (consumiu X% de error budget)"
echo "SLO depois: começou a recuperar"
```

5. LOAD SCRIPT (load.js):
   - Mesmo do M7
   - Roda continuamente durante chaos test
   - Output: requisições/s, erro%, latência

README:
```bash
cd observability-lab/modulo-8
./start.sh

# Terminal 1: monitorar logs
docker logs -f modulo-8-api-1

# Terminal 2: Grafana dashboard (SLO)
# http://localhost:3000 → SLO Dashboard

# Terminal 3: gerar tráfego
node load.js

# Terminal 4: rodar chaos test
bash chaos-test.sh

# Observe:
# - SLO cai durante chaos
# - Alertas disparam
# - Error budget é consumido
# - App se recupera
```

REQUISITOS:
- SLI/SLO bem definidos
- Prometheus rules calculando corretamente
- Grafana dashboard bonito
- Chaos test automatizado
- README explica SLI vs SLO vs SLA
```

---

## 🎯 CHECKLIST DE ENTREGA

Após completar todos os 8 prompts:

- [ ] M1: 3 infografias HTML funcionando
- [ ] M2: App + Docker Compose + Jaeger rodando
- [ ] M3: Refactor com OTEL SDK, traces detalhados
- [ ] M4: 2 serviços, service map no Jaeger
- [ ] M5: CIA Triad + data masking
- [ ] M6: Anomaly injection + Alertmanager
- [ ] M7: Network monitoring + security
- [ ] M8: SLOs + chaos test automático

**Próximo passo:** Testar cada módulo localmente → depois deploy em EC2 AWS (t2.micro)

---

## 📝 NOTAS IMPORTANTES

1. **Cada prompt é independente** - você pode começar por qualquer módulo
2. **Reutilização:** M3 refatora M2, M4 estende M3, etc
3. **Tempo por demo:** 15-20min máximo (respeita slot de 2h30min)
4. **Simplicidade:** sem abstrações desnecessárias, código didático
5. **README executável:** commands copy-paste, sem mysteries