# Observability Foundations — Laboratório

Material de apoio e demos do curso **Observability Foundations**. Todas as demos usam a mesma aplicação, a `checkout-api`, que evolui a cada módulo.

| Módulo | O que tem | Como usar |
|--------|-----------|-----------|
| 1 — Conceitos | Infográficos: ruído vs sinal, MELT, consumidores | Abrir os `.html` no navegador |
| 2 — Pilares | `checkout-api` com logs, métricas e traces; demo de sampling | Demo na AWS |
| 3 — OpenTelemetry | Auto-instrumentação, hierarquia de spans, baggage, eventos | Demo na AWS |
| 4 — Service mapping | Dois serviços em um único trace; mapa de serviços | Demo na AWS |
| 5 — DataOps e CIA Triad | Infográfico da tríade CIA e mascaramento de dados | Abrir o `.html` e rodar um script |
| 6 — Anomalias e alertas | Injeção de anomalia, regras de alerta, Alertmanager e dashboard no Grafana | Demo na AWS |
| 7 — Datadog e Gremlin | A mesma aplicação enviando logs, métricas e traces ao Datadog; SLOs, anomalias e testes de resiliência | Demo na AWS + contas de avaliação |

---

# Passo a passo: visão única

Um único ambiente na AWS serve os módulos 2, 3, 4, 6 e 7. Você o cria uma vez, troca de módulo com um comando e apaga tudo no final.

| # | Passo | Quando | Onde | Comando ou ação |
|---|-------|--------|------|-----------------|
| 1 | [Publicar o código](#1-publicar-o-código-no-github) | Uma vez, e a cada mudança | Seu computador | `git add -A`, `git commit`, `git push origin main` |
| 2 | [Criar o ambiente](#2-criar-o-ambiente-na-aws) | Uma vez | Seu computador | `aws cloudformation deploy ...` |
| 3 | [Pegar os endereços](#3-pegar-os-endereços) | Uma vez | Seu computador | `aws cloudformation describe-stacks ...` |
| 4 | [Módulo 1](#4-módulo-1-conceitos) | Na aula | Navegador | Abrir os infográficos |
| 5 | [Módulo 2](#5-módulo-2-pilares-da-observabilidade) | Na aula | Terminal da instância | `trocar-modulo.sh 2`, gerar tráfego, mostrar |
| 6 | [Módulo 3](#6-módulo-3-opentelemetry) | Na aula | Terminal da instância | `trocar-modulo.sh 3`, gerar tráfego, mostrar |
| 7 | [Módulo 4](#7-módulo-4-service-mapping) | Na aula | Terminal da instância | `trocar-modulo.sh 4`, gerar tráfego, mostrar |
| 8 | [Módulo 5](#8-módulo-5-dataops-e-cia-triad) | Na aula | Navegador e seu computador | Abrir o infográfico, `node exemplo.js` |
| 9 | [Módulo 6](#9-módulo-6-anomalias-e-alertas) | Na aula | Terminal da instância | `trocar-modulo.sh 6`, gerar tráfego com anomalia, mostrar |
| 10 | [Módulo 7](#10-módulo-7-datadog-e-gremlin) | Configurar antes; demonstrar na aula | Datadog, Gremlin e terminal da instância | Chaves em `segredos.env`, `trocar-modulo.sh 7`, monitores, SLOs, experimento |
| 11 | [Apagar tudo](#11-apagar-tudo) | Ao final | Seu computador | `aws cloudformation delete-stack ...` |

Os passos 5, 6, 7, 9 e 10 seguem sempre a mesma [rotina de demo](#rotina-de-cada-demo): colocar o módulo no ar, gerar tráfego e abrir as ferramentas.

---

# Preparação (uma vez)

## Pré-requisitos

- Conta AWS com permissão para criar EC2, Security Group e IAM Role
- VPC padrão (default VPC) na região escolhida
- AWS CLI v2 autenticado (`aws sts get-caller-identity` deve responder)
- Este repositório publicado no GitHub como **público**: a instância faz `git clone` dele

## 1. Publicar o código no GitHub

A instância baixa o código do GitHub, então tudo precisa estar no `main`. Repita sempre que alterar algo:

```bash
git add -A
```

```bash
git commit -m "Atualiza o laboratório"
```

```bash
git push origin main
```

## 2. Criar o ambiente na AWS

Na raiz do repositório:

```bash
aws cloudformation deploy --stack-name obsf-modulo-2 --template-file observability-lab/modulo-2/aws/cloudformation.yaml --capabilities CAPABILITY_IAM --parameter-overrides AllowedCidr=0.0.0.0/0
```

Leva cerca de 2 minutos e usa a região padrão do seu AWS CLI (para outra, acrescente `--region sa-east-1`). A stack se chama `obsf-modulo-2` por ter nascido nesse módulo, mas atende os módulos 2, 3, 4, 6 e 7.

O que é criado:

```
Navegador ──(AllowedCidr)──▶ Security Group ──▶ EC2 t3.small (Amazon Linux 2023)
                                                  └─ Docker Compose
                                                      ├─ checkout-api   :3000
                                                      ├─ jaeger         :16686  traces
                                                      ├─ prometheus     :9090   métricas
                                                      └─ grafana        :3001   dashboards
```

- **EC2:** ao iniciar, instala o Docker, clona este repositório em `/opt/obsf` e sobe a demo do Módulo 2.
- **Security Group:** libera as portas 3000, 3001, 9090, 9093 e 16686 para a faixa do parâmetro `AllowedCidr`. Não há SSH.
- **IAM Role:** permite abrir o terminal da instância pelo Session Manager, sem chave `.pem`.

Com `AllowedCidr=0.0.0.0/0` qualquer pessoa com o endereço acessa a demo, o que facilita o uso com os alunos. Para restringir ao seu IP, use `AllowedCidr=$(curl -s https://checkip.amazonaws.com)/32`. Rodar o comando de novo com outro valor atualiza a regra sem recriar a instância.

Parâmetros opcionais (acrescente em `--parameter-overrides`):

| Parâmetro | Padrão | Para que serve |
|-----------|--------|----------------|
| `RepoUrl` | `https://github.com/souzare/OBSERVABILITY_FOUNDATIONS.git` | Outro fork do repositório |
| `RepoBranch` | `main` | Outra branch |
| `InstanceType` | `t3.small` | `t3.medium` ou `t3.large` |

Custo aproximado: US$ 0,03 por hora enquanto a stack existir.

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
| `AlertmanagerUrl` | Alertmanager (só responde com o Módulo 6 no ar) |
| `TerminalUrl` | Terminal da instância no navegador |

Os endereços são os mesmos para os módulos 2, 3, 4 e 6 (o Módulo 7 usa só o `AppUrl`; o resto se vê no Datadog). Depois que a stack fica pronta, a instância ainda leva **de 3 a 4 minutos** para instalar o Docker e subir a demo. Está pronta quando `AppUrl` + `/metrics` responder no navegador.

---

# Rotina de cada demo

Tudo aqui é feito no terminal da instância: abra o `TerminalUrl` no navegador (ou **EC2 → Instances → obsf-modulo-2 → Connect → Session Manager**).

## A. Colocar o módulo no ar

Troque o número no final pelo módulo desejado (`2`, `3`, `4`, `6` ou `7`):

```bash
cd /opt/obsf && sudo git pull && sudo observability-lab/trocar-modulo.sh 3
```

O comando baixa a última versão do código, derruba a demo que estiver rodando e sobe a do módulo escolhido. Os módulos usam as mesmas portas, então só um roda por vez. Os Módulos 4 e 6 constroem imagens na primeira vez e levam de 1 a 2 minutos.

## B. Gerar tráfego

Troque `modulo-3` pelo módulo que está no ar:

```bash
cd /opt/obsf/observability-lab/modulo-3 && sudo docker compose run --rm load
```

A cada 5 segundos são enviados 50 `POST /orders` e, para cada pedido criado, um `GET /orders/:id`. Cerca de 5% dos POST vão com payload inválido e retornam 400. Pare com `Ctrl+C`.

Para criar um pedido na mão, do seu computador (troque `APP_URL` pelo output `AppUrl`):

```bash
curl -X POST APP_URL/orders -H "Content-Type: application/json" -d '{"customer_id":"CUST-1","amount":250}'
```

## C. Ver os logs

Em uma segunda aba do terminal, troque o nome do container conforme o módulo:

| Módulo | Container |
|--------|-----------|
| 2 | `modulo-2-app-1` |
| 3 | `modulo-3-app-1` |
| 4 | `modulo-4-api-1` e `modulo-4-payment-service-1` |
| 6 | `modulo-6-api-1`, `modulo-6-payment-service-1` e `modulo-6-webhook-1` |
| 7 | `modulo-7-api-1`, `modulo-7-payment-service-1` e `modulo-7-datadog-agent-1` |

```bash
sudo docker logs -f modulo-3-app-1
```

## D. Aplicar uma mudança de código ou de `.env`

Depois do `git push` (passo 1), dentro da pasta do módulo que está no ar:

```bash
sudo ./atualizar.sh
```

O script faz `git pull` e recria só a aplicação. Jaeger e Prometheus não reiniciam, então o histórico é preservado.

---

# O que mostrar em cada módulo

## 4. Módulo 1: Conceitos

Abra no navegador, direto do seu computador, os arquivos de `observability-lab/modulo-1/assets/`:

| Arquivo | Conteúdo |
|---------|----------|
| `infografico-ruido-sinal.html` | Ruído vs sinal; o botão destaca os poucos alertas que importam |
| `infografico-melt.html` | Os quatro tipos de telemetria e como se complementam em um incidente |
| `modal-consumidores.html` | O que cada perfil (DevOps, SRE, Developer, Security) precisa da observabilidade |

## 5. Módulo 2: Pilares da Observabilidade

Uma API de pedidos instrumentada com os 3 pilares: **logs** (Pino), **métricas** (Prometheus) e **traces** (OpenTelemetry + Jaeger).

Coloque no ar com `trocar-modulo.sh 2` e gere tráfego ([rotina](#rotina-de-cada-demo)). Neste módulo, 5% dos `GET /orders/:id` retornam 500 (falha intermitente).

Material para projetar, em `observability-lab/modulo-2/assets/`: `diagrama-arquitetura.html` (liga e desliga cada pilar), `codigo-para-sinal.html` (o código que gera cada sinal) e `sampling.html` (com e sem sampling).

### Logs (terminal da instância)

```bash
sudo docker logs -f modulo-2-app-1
```

Mensagens JSON estruturadas aparecem em tempo real, duas por requisição (entrada e saída):

```json
{"level":"info","timestamp":"2026-10-05T11:54:41.778Z","service":"checkout-api","trace_id":"aae6acab...","sampled":true,"correlation_id":"d559e416-...","method":"GET","endpoint":"/orders/ORD-6d0bb578","status":200,"duration_ms":55,"customer_id":"CUST-295","order_id":"ORD-6d0bb578","message":"requisição finalizada"}
```

Só os erros, com stack trace:

```bash
sudo docker logs modulo-2-app-1 | grep '"level":"error"'
```

### Métricas (Prometheus)

1. Abra o `PrometheusUrl`.
2. Query: `http_requests_total`
3. Query: `http_request_duration_seconds_bucket`
4. Query: `orders_pending` (aba **Graph**: sobe a cada lote e desce conforme os pedidos são confirmados)

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

### Traces (Jaeger)

1. Abra o `JaegerUrl`.
2. Service: `checkout-api`, Operation: `POST /orders`, **Find Traces**.
3. Clique em um trace para ver a timeline (`POST /orders` → `processar-pedido`, ou `GET /orders/:id` → `db.buscar-pedido`).
4. Para ver só as falhas: campo **Tags** com `error=true`.

### Ligando os pilares

Copie o `trace_id` de uma linha de log de erro e cole na busca do Jaeger (canto superior): você cai direto no trace daquela requisição.

```bash
sudo docker logs modulo-2-app-1 | grep '"level":"error"' | tail -1
```

### Sampling: com e sem amostragem

O sampler está no bloco `sampler:` do `NodeSDK`, em `app.js`. A taxa vem de `TRACE_SAMPLE_RATE` em `observability-lab/modulo-2/.env`: `1.0` envia 100% dos traces (sem sampling) e `0.1` envia 10%. Confira o valor atual do arquivo antes da aula.

**Antes (taxa 1.0).** Com tráfego rodando, no Prometheus (aba **Graph**):

```promql
# Requisições por segundo
sum(rate(http_requests_total[1m]))
```

```promql
# Traces por segundo enviados ao Jaeger
sum(rate(traces_total{sampled="true"}[1m]))
```

As duas linhas ficam iguais: toda requisição gera um trace.

**Aplicar.** No seu computador, edite o `.env` para `TRACE_SAMPLE_RATE=0.1`, faça commit e push (passo 1). No terminal da instância:

```bash
cd /opt/obsf/observability-lab/modulo-2 && sudo ./atualizar.sh
```

O script mostra a taxa que entrou em vigor (`"trace_sample_rate":0.1`).

**Depois (taxa 0.1).** Em cerca de um minuto:

- No Prometheus, a linha de traces cai para cerca de 10% da linha de requisições. A fração exata:

```promql
sum(rate(traces_total{sampled="true"}[1m])) / sum(rate(traces_total[1m]))
```

- Nos logs, todo registro continua tendo `trace_id`, mas a maioria vem com `"sampled":false`:

```bash
sudo docker logs --since 1m modulo-2-app-1 | grep -c '"sampled":false'
```

- No Jaeger aparecem bem menos traces. Copie o `trace_id` de um log com `"sampled":false` e cole na busca: o Jaeger não encontra.
- Os erros também são amostrados: a maioria dos 500 fica sem trace. É a limitação do head sampling.

### Observações para a aula

- **Logs** mostram o QUÊ aconteceu (eventos, um a um, com todo o contexto).
- **Métricas** mostram agregados (quantos, quanto tempo).
- **Traces** mostram a HISTÓRIA completa de uma requisição (início ao fim).
- Nos logs o `endpoint` é o caminho real (`/orders/ORD-123`); nas métricas é a rota (`/orders/:id`). É proposital: um label por pedido criaria milhares de séries no Prometheus (alta cardinalidade).

## 6. Módulo 3: OpenTelemetry

A mesma `checkout-api`, refeita com o SDK do OpenTelemetry. Prometheus, Grafana e Jaeger são os mesmos; muda a instrumentação de traces e logs.

A demo segue 8 mudanças, uma por vez. Para cada uma: **mostre o código** (abra `observability-lab/modulo-2/app.js` e `observability-lab/modulo-3/app.js` lado a lado no editor) e depois **prove na demo**.

| Passo | Mudança | Arquivo | Onde provar |
|-------|---------|---------|-------------|
| 6.0 | Colocar o Módulo 3 no ar | — | `AppUrl/metrics` responde |
| 6.1 | A configuração sai do `app.js` | `tracing.js` | Log de início da aplicação |
| 6.2 | Auto-instrumentação cria o span da requisição | `tracing.js`, `app.js` | Jaeger: span `POST /orders` com tags `http.*` |
| 6.3 | Hierarquia de spans | `app.js` | Jaeger: 5 spans em árvore |
| 6.4 | Atributos de negócio | `app.js` | Jaeger: busca por tag |
| 6.5 | Baggage | `app.js`, `tracing.js` | Jaeger: mesmas tags em todos os spans filhos |
| 6.6 | Eventos de span | `app.js` | Jaeger: seção **Logs** do span |
| 6.7 | Logs correlacionados | `app.js` | Terminal: `trace_id` e `span_id` em toda linha |
| 6.8 | Tratamento de erros | `app.js` | Jaeger: trace vermelho de ponta a ponta |

Material para projetar: `observability-lab/modulo-3/assets/arquitetura-m2-m3.html` (as duas arquiteturas e o que mudou). Os números de linha abaixo são do código atual; se você editar os arquivos, eles se deslocam.

### 6.0 Colocar o Módulo 3 no ar

No terminal da instância:

```bash
cd /opt/obsf && sudo git pull && sudo observability-lab/trocar-modulo.sh 3
```

Em uma segunda aba, gere tráfego e deixe rodando durante toda a demo:

```bash
cd /opt/obsf/observability-lab/modulo-3 && sudo docker compose run --rm load
```

O gerador é o do Módulo 2 com dois acréscimos: o cabeçalho `X-Customer-Tier` (`premium` ou `standard`) e o campo `payment_method` (`credit_card`, `pix` ou `boleto`).

### 6.1 A configuração sai do `app.js`

**O que dizer:** no Módulo 2, o SDK era configurado no meio do `app.js`. Agora ele tem um arquivo próprio, que precisa ser carregado antes de todo o resto.

**No código:**

- `modulo-3/app.js`, linha 12: `const config = require('./tracing');` é a primeira linha executável, antes do `require('express')`.
- `modulo-3/tracing.js`, linhas 38 a 70: o `NodeSDK` com recurso (quem somos), sampler, processadores e instrumentações.

```javascript
// PRECISA ser a primeira linha: liga o OpenTelemetry antes de carregar o Express
const config = require('./tracing');
```

**Na demo:** a ordem importa porque a auto-instrumentação (próximo passo) precisa "envolver" os módulos `http` e `express` no momento em que são carregados. Mostre o log de início, que confirma a configuração:

```bash
sudo docker logs modulo-3-app-1 | grep '"checkout-api no ar"'
```

### 6.2 Auto-instrumentação cria o span da requisição

**O que dizer:** no Módulo 2 nós abríamos e fechávamos o span de cada requisição na mão. Agora uma biblioteca faz isso sozinha para todo tráfego HTTP.

**No código, antes** (`modulo-2/app.js`, dentro do middleware):

```javascript
const span = tracer.startSpan(`${req.method} ${req.path}`, { kind: SpanKind.SERVER });
// ... dezenas de linhas depois ...
span.end();
```

**Depois** (`modulo-3/tracing.js`, linhas 57 a 67):

```javascript
instrumentations: [
  new HttpInstrumentation({
    ignoreIncomingRequestHook: (req) => req.url === '/metrics',
  }),
  new ExpressInstrumentation({
    ignoreLayersType: ['middleware', 'router', 'request_handler'],
  }),
],
```

No `modulo-3/app.js`, o middleware (linha 102) não tem mais `startSpan` nem `span.end()`: ficou só com métricas e log.

**Na demo:**

1. Jaeger → Service `checkout-api`, Operation `GET /orders/:id`, **Find Traces**.
2. Abra um trace e clique no span `GET /orders/:id`. Nas **Tags** há atributos que ninguém escreveu: `http.request.method`, `http.route`, `http.response.status_code`, `url.path`.
3. Procure a operação `GET /metrics` na lista de operações: ela não existe. O `ignoreIncomingRequestHook` impede que o scrape do Prometheus gere um trace a cada 5 segundos.

### 6.3 Hierarquia de spans

**O que dizer:** a auto-instrumentação conhece o HTTP, mas não o nosso negócio. As etapas do pedido somos nós que marcamos, e cada etapa vira um span filho.

**No código** (`modulo-3/app.js`):

- Linha 86, função `emSpan`: cria um span filho do span ativo, roda a função dentro dele e sempre o encerra.
- Linhas 174 a 185: `process_order` chama as três etapas em sequência.
- Linhas 196, 215 e 251: `validarPedido`, `salvarNoBanco` e `enviarEmailDeConfirmacao`, cada uma dentro do seu `emSpan`.

```javascript
emSpan('process_order', async (span) => {
  await validarPedido(order);            // span validate_order
  await salvarNoBanco(order);            // span save_to_database
  await enviarEmailDeConfirmacao(order); // span send_confirmation_email
})
```

**Na demo:**

1. Jaeger → Operation `POST /orders`, **Find Traces**, abra um trace.
2. São 5 spans em árvore (no Módulo 2 eram 2):

```
POST /orders                    auto-instrumentação HTTP
└─ process_order                span de negócio
   ├─ validate_order            ~50 ms
   ├─ save_to_database          ~200 ms por tentativa
   └─ send_confirmation_email   ~150 ms
```

3. Pergunte à turma qual etapa é a mais lenta. A timeline responde sem ninguém ler código: `save_to_database`.

### 6.4 Atributos de negócio

**O que dizer:** um atributo é um par chave/valor que descreve **um span**. Ele vira filtro na busca.

**No código** (`modulo-3/app.js`, linhas 176 a 179):

```javascript
span.setAttributes({
  payment_method,
  customer_tier: req.get('x-customer-tier') || 'standard',
});
```

Em `salvarNoBanco` (linha 244): `tentativas`, `rows_affected` e `db_latency_ms`.

**Na demo:** no campo **Tags** da busca do Jaeger:

| Busca | O que encontra |
|-------|----------------|
| `customer_tier=premium` | Pedidos de clientes premium |
| `payment_method=pix` | Pedidos pagos com pix |
| `tentativas=2` | Gravações que precisaram de uma segunda tentativa |

Abra um resultado e clique em `process_order` → **Tags** para ver os valores.

### 6.5 Baggage

**O que dizer:** o atributo pertence a um span. A baggage **viaja com a requisição**: o que é colocado nela fica disponível para todas as etapas seguintes. Sozinha ela não aparece em lugar nenhum; alguém precisa ler e usar.

**No código:**

- `modulo-3/app.js`, linhas 165 a 170: a baggage é criada com `customer_id`, `order_id` e `correlation_id` e anexada ao contexto.
- `modulo-3/tracing.js`, linha 25, classe `BaggageParaAtributos`: copia cada item da baggage para todo span que nasce.

```javascript
const bagagem = propagation.createBaggage({
  customer_id: { value: String(customer_id ?? 'desconhecido') },
  order_id: { value: order.order_id },
  correlation_id: { value: res.locals.correlation_id },
});
const contextoComBagagem = propagation.setBaggage(context.active(), bagagem);
```

**Na demo:**

1. No mesmo trace, clique em `validate_order`, depois em `save_to_database`, depois em `send_confirmation_email`.
2. Os três têm `customer_id`, `order_id` e `correlation_id` nas **Tags**, embora nenhuma dessas funções faça `setAttribute` com esses campos.
3. Clique no span raiz `POST /orders`: ele **não** tem esses campos, porque nasceu antes de a baggage ser criada. É a diferença entre atributo (de um span) e baggage (da requisição, dali em diante).

### 6.6 Eventos de span

**O que dizer:** um evento é um **momento** dentro de um span, com horário exato. É como um log preso ao span.

**No código** (`modulo-3/app.js`):

| Linha | Evento |
|-------|--------|
| 199 | `order.validation.started` |
| 203 / 209 | `order.validation.failed` / `order.validation.passed` |
| 226 | `database.insert.retry` |
| 245 | `database.insert.completed` |
| 254 | `email.send.queued` |

```javascript
span.addEvent('order.validation.started');
await esperar(50);
// ...
span.addEvent('order.validation.passed');
```

**Na demo:**

1. No trace, clique em `validate_order` e abra a seção **Logs**: aparecem os dois eventos, cada um com o instante em que ocorreu dentro do span.
2. Busque `tentativas=2`, abra um trace e clique em `save_to_database`: o evento `database.insert.retry` marca o momento exato da falha, e a barra do span tem cerca de 400 ms em vez de 200.

### 6.7 Logs correlacionados

**O que dizer:** toda linha de log passa a carregar o `trace_id` e o `span_id` do span ativo, mais os itens da baggage. Ninguém precisa lembrar de incluir esses campos em cada `logger.info`.

**No código** (`modulo-3/app.js`, linhas 35 a 44, dentro da configuração do Pino):

```javascript
mixin() {
  const span = trace.getActiveSpan();
  if (!span) return {};
  const campos = { trace_id: span.spanContext().traceId, span_id: span.spanContext().spanId };
  const bagagem = propagation.getActiveBaggage();
  if (bagagem) {
    for (const [chave, item] of bagagem.getAllEntries()) campos[chave] = item.value;
  }
  return campos;
},
```

Compare com a chamada na linha 210, que não passa nenhum campo: `logger.info('pedido validado');`

**Na demo:**

```bash
sudo docker logs --since 30s modulo-3-app-1 | grep '"pedido validado"' | tail -1
```

```json
{"level":"INFO","timestamp":"2026-10-06T20:40:01.351Z","service":"checkout-api","trace_id":"b2d9f3f1172fe36f2a47271fe41007b2","span_id":"fd7964e987e9ccfd","customer_id":"CUST-293","order_id":"ORD-6d000d1b","correlation_id":"462ab034-59e6-4d81-b2e2-6e28905df7c3","message":"pedido validado"}
```

Copie o `trace_id` e cole na busca do Jaeger: abre o trace daquela requisição. O `span_id` indica em qual span o log foi escrito (neste caso, `validate_order`).

O Jaeger não exibe os logs da aplicação, então o caminho é sempre log → `trace_id` → Jaeger. Os "Logs" que aparecem dentro de um span no Jaeger são os **eventos** do passo 6.6.

### 6.8 Tratamento de erros

**O que dizer:** quando uma etapa falha, o span dela registra a exceção e fica marcado com erro, e o erro sobe pela hierarquia.

**No código** (`modulo-3/app.js`, linhas 90 a 93, dentro de `emSpan`):

```javascript
} catch (erro) {
  span.recordException(erro);
  span.setStatus({ code: SpanStatusCode.ERROR, message: erro.message });
  throw erro;
}
```

Em `salvarNoBanco` (linha 215), cada tentativa de gravação falha 30% das vezes (`DB_ERROR_RATE` no `.env`); depois de 3 tentativas, a função lança erro.

**Na demo:**

1. Jaeger → Operation `POST /orders`, **Tags** `http.response.status_code=500`, **Find Traces**.
2. Abra um trace: `save_to_database` está em vermelho, com três eventos `database.insert.retry` e um evento `exception` com a mensagem e a stack trace.
3. `process_order` e `POST /orders` também ficam marcados: o erro subiu até a raiz.
4. Feche o ciclo pelo log:

```bash
sudo docker logs modulo-3-app-1 | grep '"level":"ERROR"' | tail -1
```

O `trace_id` dessa linha leva ao mesmo tipo de trace no Jaeger.

### Resumo para fechar o módulo

| | Módulo 2 | Módulo 3 |
|---|----------|----------|
| Span da requisição | Criado na mão, em um middleware | Criado pela **auto-instrumentação** HTTP/Express |
| Configuração | Dentro do `app.js` | Em `tracing.js`, carregado na primeira linha do `app.js` |
| Trace do `POST /orders` | 2 spans | 5 spans em **hierarquia** |
| Contexto do pedido | Atributos só no span raiz | **Baggage** levada a todos os spans e logs |
| Momentos dentro do span | Não havia | **Eventos** (validação, gravação, e-mail, retries) |
| Logs | `trace_id` | `trace_id` + `span_id` + itens da baggage |
| Erros | 5% aleatório no GET | Retries na gravação: até 3 tentativas, depois erro 500 |

Regra prática: **atributo** responde "como era esta operação?", **evento** responde "o que aconteceu durante ela, e quando?", **baggage** responde "que contexto as próximas etapas precisam conhecer?".

Métricas e sampling continuam como no Módulo 2: mesmas queries e mesmo `TRACE_SAMPLE_RATE`, agora no `.env` da pasta `modulo-3`.

## 7. Módulo 4: Service mapping

A `checkout-api` passa a chamar um segundo serviço, o `payment-service`, para cobrar o pedido. O foco é a **propagação de contexto**: os dois serviços escrevem spans no mesmo trace, e o Jaeger monta o mapa de serviços a partir disso.

A demo segue 9 mudanças, uma por vez. Para cada uma: **mostre o código** (abra `observability-lab/modulo-3/app.js` e `observability-lab/modulo-4/api/app.js` lado a lado, e o `payment-service/app.js` em uma terceira aba) e depois **prove na demo**.

| Passo | Mudança | Arquivo | Onde provar |
|-------|---------|---------|-------------|
| 7.0 | Colocar o Módulo 4 no ar | — | `AppUrl/metrics` responde |
| 7.1 | Um segundo serviço, independente | `payment-service/`, `docker-compose.yml` | `docker ps` e lista de serviços do Jaeger |
| 7.2 | A `checkout-api` chama o pagamento | `api/app.js` | Jaeger: span `call_payment_service` |
| 7.3 | O contexto do trace vai na chamada HTTP | `api/app.js` | Log `pagamento recebido` com o `traceparent` |
| 7.4 | O `payment-service` continua o mesmo trace | `payment-service/app.js` | Jaeger: 7 spans, duas cores |
| 7.5 | A baggage atravessa a rede | os dois | Tags e logs do `payment-service` |
| 7.6 | Mapa de serviços | — | Jaeger: **System Architecture** |
| 7.7 | Falha no pagamento e nova tentativa | os dois | Jaeger: span com erro seguido de outro bem-sucedido |
| 7.8 | Métricas por serviço | `prometheus.yml` | Prometheus: queries por `job` |
| 7.9 | O mesmo trace nos logs dos dois serviços | — | Terminal: mesmo `trace_id` nos dois containers |

Material para projetar, em `observability-lab/modulo-4/assets/`: `infografico-opentelemetry.html` (OpenTelemetry em uma página) e `infografico-open-source.html` (panorama de ferramentas, com o que usamos na demo e as de IA). Os números de linha abaixo são do código atual; se você editar os arquivos, eles se deslocam.

### 7.0 Colocar o Módulo 4 no ar

No terminal da instância:

```bash
cd /opt/obsf && sudo git pull && sudo observability-lab/trocar-modulo.sh 4
```

Na primeira vez as imagens dos dois serviços são construídas, o que leva de 1 a 2 minutos. Em uma segunda aba, gere tráfego e deixe rodando durante toda a demo:

```bash
cd /opt/obsf/observability-lab/modulo-4 && sudo docker compose run --rm load
```

É o mesmo gerador do Módulo 3: ele só conhece a `checkout-api`.

### 7.1 Um segundo serviço, independente

**O que dizer:** até aqui havia um único serviço. Agora há dois, cada um com seu código, suas dependências e sua imagem. O OpenTelemetry é configurado em cada um, do mesmo jeito.

**No código:**

- `modulo-4/api/` e `modulo-4/payment-service/`: cada pasta tem `app.js`, `tracing.js`, `package.json` e `Dockerfile`.
- Os dois `tracing.js` são iguais. O que distingue os serviços é a variável `SERVICE_NAME`, definida em `modulo-4/docker-compose.yml` (linhas 10 e 25).

```yaml
api:
  build: ./api
  environment:
    SERVICE_NAME: checkout-api
    PORT: 3000

payment-service:
  build: ./payment-service
  environment:
    SERVICE_NAME: payment-service
    PORT: 3001
```

**Na demo:**

```bash
sudo docker ps --format '{{.Names}}'
```

Aparecem `modulo-4-api-1` e `modulo-4-payment-service-1`. No Jaeger, o campo **Service** da busca agora lista `checkout-api` e `payment-service`.

O `payment-service` não publica porta para fora: só a `checkout-api` fala com ele, pela rede interna do Docker Compose.

### 7.2 A `checkout-api` chama o pagamento

**O que dizer:** a terceira etapa do pedido deixou de ser o e-mail e passou a ser uma chamada HTTP a outro serviço. Para a `checkout-api`, é mais um span filho.

**No código** (`modulo-4/api/app.js`):

- Linha 184: `await chamarPagamento(order);` no lugar de `enviarEmailDeConfirmacao`.
- Linha 252, função `chamarPagamento`: abre o span `call_payment_service` e faz o `fetch` (linha 271).

```javascript
function chamarPagamento(order) {
  return emSpan('call_payment_service', async (span) => {
    span.setAttribute('peer.service', 'payment-service');
    // ...
    const resposta = await fetch(`${PAYMENT_SERVICE_URL}/process-payment`, { method: 'POST', headers, body: ... });
```

**Na demo:** Jaeger → Service `checkout-api`, Operation `POST /orders`, abra um trace. Onde antes havia `send_confirmation_email`, agora há `call_payment_service`, com a tag `peer.service=payment-service`.

### 7.3 O contexto do trace vai na chamada HTTP

**O que dizer:** esta é a linha mais importante do módulo. Antes de chamar o outro serviço, gravamos o contexto atual nos cabeçalhos HTTP. Sem ela, o `payment-service` não teria como saber que faz parte de um trace já em andamento.

**No código** (`modulo-4/api/app.js`, linhas 266 e 267):

```javascript
const headers = { 'Content-Type': 'application/json' };
propagation.inject(context.active(), headers);
```

O `inject` acrescenta dois cabeçalhos padrão W3C:

```
traceparent: 00-5739583a86180ffa37c64bcd03135b65-04514c4893c80e37-01
             versão - trace_id - span_id de quem chamou - amostrado
baggage:     customer_id=CUST-387,order_id=ORD-34b2424d,correlation_id=6aa000d0-...
```

**Na demo:** o `payment-service` registra em log exatamente o que recebeu:

```bash
sudo docker logs --since 30s modulo-4-payment-service-1 | grep '"pagamento recebido"' | tail -1
```

Na linha de log, compare o campo `traceparent` com o campo `trace_id`: o `trace_id` é o trecho do meio do `traceparent`. O serviço não inventou um identificador; ele recebeu.

### 7.4 O `payment-service` continua o mesmo trace

**O que dizer:** do outro lado, ninguém escreveu código para ler o cabeçalho. A auto-instrumentação HTTP faz isso e cria o span da requisição como **filho** do span que chamou, em vez de começar um trace novo.

**No código** (`modulo-4/payment-service/app.js`):

- Linha 10: `const config = require('./tracing');`, a mesma primeira linha da `checkout-api`.
- Linha 87: o span de negócio `process_payment`, criado dentro da requisição.

```javascript
await tracer.startActiveSpan('process_payment', async (span) => {
  span.setAttributes({ amount, payment_gateway: 'simulado' });
```

**Na demo:**

1. No mesmo trace do passo 7.2, são 7 spans, com uma cor para cada serviço:

```
checkout-api     POST /orders
checkout-api     └─ process_order
checkout-api        ├─ validate_order
checkout-api        ├─ save_to_database
checkout-api        └─ call_payment_service        injeta traceparent + baggage
payment-service        └─ POST /process-payment    lê o traceparent e continua o trace
payment-service           └─ process_payment
```

2. Clique em `call_payment_service` e em `POST /process-payment`: a diferença de duração entre os dois é o tempo gasto na rede.
3. Pergunte à turma o que aconteceria sem o passo 7.3: haveria dois traces separados, um por serviço, e nenhuma forma de ligar um ao outro.

### 7.5 A baggage atravessa a rede

**O que dizer:** no Módulo 3 a baggage ia de um span para o outro dentro do mesmo processo. Agora ela viaja no cabeçalho `baggage` e chega ao outro serviço.

**No código:**

- `modulo-4/api/app.js`: a baggage é criada como no Módulo 3; o `propagation.inject` do passo 7.3 a coloca no cabeçalho.
- `modulo-4/payment-service/tracing.js`, classe `BaggageParaAtributos`: a mesma do Módulo 3, copia a baggage recebida para os spans.
- `modulo-4/payment-service/app.js`, linha 31: o mesmo `mixin()` do Pino, que inclui a baggage nos logs.

Nenhuma linha do `payment-service` faz `setAttribute('customer_id', ...)`: os campos chegam aos spans e aos logs pela baggage.

**Na demo:**

1. No trace, clique em `process_payment` → **Tags**: `customer_id`, `order_id` e `correlation_id` estão lá.
2. No log do passo 7.3, os mesmos três campos aparecem na linha do `payment-service`.

Vale o alerta: como a baggage sai do processo em um cabeçalho HTTP, não coloque nela nada sensível. O Módulo 5 volta a esse ponto.

### 7.6 Mapa de serviços

**O que dizer:** ninguém desenhou este mapa. Ele é calculado a partir dos traces, olhando qual serviço é pai de qual.

**Na demo:**

1. No Jaeger, abra **System Architecture** (em versões mais antigas da interface, **Dependencies**).
2. Aparecem duas caixas, `checkout-api` e `payment-service`, ligadas por uma seta com o número de chamadas.
3. Deixe o tráfego rodar e atualize a página: o número cresce.

O mapa do Jaeger mostra apenas a contagem de chamadas. Taxa de requisições, erro e latência por serviço vêm do Prometheus (passo 7.8).

### 7.7 Falha no pagamento e nova tentativa

**O que dizer:** 5% dos pagamentos dão timeout. A `checkout-api` tenta mais uma vez antes de desistir. O trace mostra as duas tentativas e de quem foi a falha.

**No código:**

`modulo-4/payment-service/app.js`, linhas 92 a 96 (a falha simulada) e 108 a 112 (o span marcado com erro):

```javascript
if (Math.random() < PAYMENT_ERROR_RATE) {
  await esperar(1000);
  span.addEvent('payment.gateway.timeout');
  throw new Error('timeout');
}
// ...
span.recordException(erro);
span.setStatus({ code: SpanStatusCode.ERROR, message: erro.message });
res.status(504).json({ success: false, error: erro.message, ... });
```

`modulo-4/api/app.js`, linhas 292 a 298 (a nova tentativa):

```javascript
span.addEvent('payment.failed', { tentativa: tentativas, erro: resultado.error });
if (tentativas === 2) {
  const erro = new Error(`Pagamento falhou após 2 tentativas: ${resultado.error}`);
  erro.status = 502;
  throw erro;
}
```

**Na demo:**

1. Jaeger → Service `payment-service`, **Tags** `error=true`, **Find Traces**.
2. Abra um trace: o primeiro `process_payment` está em vermelho, com o evento `payment.gateway.timeout`, e dura cerca de 1 segundo.
3. Logo abaixo há um segundo `POST /process-payment`, bem-sucedido: é a nova tentativa. O span `call_payment_service` mostra `tentativas=2` e os eventos `payment.failed` e `payment.approved`.
4. O cliente recebeu 201, mas esperou 1 segundo a mais. Sem o trace, isso seria só "uma requisição lenta".

Para ver um pedido que falhou de vez (as duas tentativas com timeout), busque Service `checkout-api` com **Tags** `http.response.status_code=502`. Isso acontece em cerca de 1 a cada 400 pedidos. Para ficar mais frequente, aumente `PAYMENT_ERROR_RATE` em `observability-lab/modulo-4/.env` (por exemplo `0.3`), publique e rode `sudo ./atualizar.sh` na pasta `modulo-4`.

### 7.8 Métricas por serviço

**O que dizer:** os dois serviços expõem `/metrics` com os mesmos nomes de métrica. O Prometheus coleta os dois e acrescenta o rótulo `job`, que diz de qual serviço veio cada número.

**No código** (`modulo-4/prometheus.yml`, linhas 5 a 12):

```yaml
scrape_configs:
  - job_name: checkout-api
    static_configs:
      - targets: ["api:3000"]

  - job_name: payment-service
    static_configs:
      - targets: ["payment-service:3001"]
```

**Na demo**, no Prometheus (aba **Graph**):

```promql
# Requisições por segundo, por serviço
sum by (job) (rate(http_requests_total[1m]))
```

```promql
# Taxa de erro (%) por serviço
100 * sum by (job) (rate(http_requests_total{status=~"5.."}[1m])) / sum by (job) (rate(http_requests_total[1m]))
```

```promql
# Latência p95 por serviço
histogram_quantile(0.95, sum by (le, job) (rate(http_request_duration_seconds_bucket[1m])))
```

O `payment-service` mostra cerca de 5% de erro; a `checkout-api` mostra quase zero, porque a nova tentativa esconde a falha do cliente. A latência p95 da `checkout-api` é que denuncia o problema. É um bom gancho para discutir por que olhar só a taxa de erro do serviço de entrada engana.

### 7.9 O mesmo trace nos logs dos dois serviços

**O que dizer:** com o `trace_id` propagado, uma única busca reúne os logs de todos os serviços que participaram da requisição.

**Na demo:** pegue o `trace_id` de um pagamento com falha:

```bash
sudo docker logs modulo-4-payment-service-1 | grep '"level":"ERROR"' | tail -1
```

Procure o mesmo `trace_id` nos logs da `checkout-api` (troque `TRACE_ID`):

```bash
sudo docker logs modulo-4-api-1 | grep TRACE_ID
```

As linhas dos dois serviços têm o mesmo `trace_id` e o mesmo `correlation_id`. Colando o `trace_id` no Jaeger, abre o trace do passo 7.7.

### Resumo para fechar o módulo

| | Módulo 3 | Módulo 4 |
|---|----------|----------|
| Serviços | 1 (`checkout-api`) | 2 (`checkout-api` e `payment-service`), cada um em sua pasta, com seu `Dockerfile` |
| Etapas do pedido | validar, gravar, enviar e-mail | validar, gravar, **chamar o pagamento** |
| Trace | 5 spans de um serviço | 7 spans de dois serviços |
| Baggage | Entre spans do mesmo processo | Atravessa a rede no cabeçalho `baggage` |
| Falhas | Retries na gravação | Timeout em 5% dos pagamentos, com 1 nova tentativa |
| Prometheus | 1 alvo | 2 alvos; o rótulo `job` separa os serviços |

Três ideias para os alunos levarem: o trace só atravessa serviços se o **contexto for propagado** (passo 7.3); o **mapa de serviços** é consequência dos traces, não um desenho; e uma **nova tentativa** pode esconder uma falha da taxa de erro, mas não do trace nem da latência.

## 8. Módulo 5: DataOps e CIA Triad

Telemetria também é dado. Este módulo aplica a tríade CIA aos logs, métricas e traces da `checkout-api`. Não usa a AWS: é um infográfico e um exemplo que roda no seu computador.

### CIA Triad na observabilidade

| Pilar | O que significa | Na observabilidade |
|-------|-----------------|--------------------|
| **Confidentiality** (Confidencialidade) | Dados não expostos sem autorização | Mascarar dados sensíveis antes de irem para logs e traces. Exemplo: e-mail vira `j***@*.com` |
| **Integrity** (Integridade) | Dados não podem ser alterados | O `trace_id` é o mesmo do início ao fim da requisição, o `timestamp` é gravado na origem e não muda, e o hash do payload denuncia qualquer alteração |
| **Availability** (Disponibilidade) | Dados sempre acessíveis quando necessário | Backup de métricas (Prometheus em alta disponibilidade) e persistência de traces (Jaeger com armazenamento em disco) |

Infográfico para projetar: abra `observability-lab/modulo-5/assets/cia-triad.html` e clique em cada círculo.

Sobre disponibilidade, a demo dos módulos anteriores é um bom contraexemplo: há um único Prometheus e o Jaeger guarda os traces em memória, então reiniciar o container apaga tudo.

### Data masking na prática

A biblioteca `observability-lab/modulo-5/data-masking.js` não tem dependências:

| Função | Antes | Depois |
|--------|-------|--------|
| `maskEmail` | `john.doe@company.com` | `j***@*.com` |
| `maskCreditCard` | `4532-1234-5678-9999` | `****-****-****-9999` |
| `maskCustomerId` | `CUST-295` | `CUST-****` |
| `maskPhone` | `+55 (11) 98765-1234` | `***-****-1234` |
| `maskIPAddress` | `192.168.10.25` | `192.168.***.***` |
| `pseudonymize` | `CUST-295` | `pseudo-165c596bcce9` (código estável por cliente) |
| `maskSensitiveFields` | um objeto inteiro | cópia com todos os campos sensíveis conhecidos mascarados |

Rodar o exemplo, no seu computador:

```bash
cd observability-lab/modulo-5
```

Com Node instalado:

```bash
node exemplo.js
```

Sem Node, pelo Docker:

```bash
docker run --rm -v "$PWD":/app -w /app node:22-alpine node exemplo.js
```

O exemplo mostra cada função isolada, o mesmo log antes e depois do mascaramento, a diferença entre mascarar e pseudonimizar, e o hash do payload (integridade).

Uso nos logs, campo a campo:

```javascript
const { maskEmail, maskCreditCard } = require('./data-masking');

logger.info({
  ...eventData,
  customer_email: maskEmail(eventData.customer_email),
  credit_card: maskCreditCard(eventData.credit_card),
}, 'pedido recebido');
```

Ou de uma vez, sem depender de lembrar de cada campo:

```javascript
const { maskSensitiveFields } = require('./data-masking');

logger.info(maskSensitiveFields(eventData), 'pedido recebido');
```

O mesmo vale para traces: mascare o valor antes de `span.setAttribute(...)` e antes de colocá-lo na baggage, que viaja em um cabeçalho HTTP para os outros serviços.

### Pontos para discutir em aula

- **Mascarar na origem.** Depois que o dado chega ao Jaeger ou ao agregador de logs, ele já foi copiado, indexado e talvez replicado.
- **Mascarar ou pseudonimizar?** `maskCustomerId` transforma todos os clientes em `CUST-****`, e a correlação por cliente dos Módulos 3 e 4 deixa de funcionar. `pseudonymize` troca o valor por um código estável: ainda dá para seguir o mesmo cliente, sem saber quem ele é. O segredo usado precisa ficar fora do código.
- **O melhor dado sensível é o que não foi coletado.** Antes de mascarar, vale perguntar se o campo precisa mesmo estar no log.

## 9. Módulo 6: Anomalias e alertas

Os dois serviços do Módulo 4, agora com uma anomalia provocada de propósito e uma cadeia de alertas completa: Prometheus avalia as regras, o Alertmanager agrupa e entrega, e um webhook recebe.

A demo segue 7 passos. Para cada um: **mostre o código** e depois **prove na demo**.

| Passo | O que acontece | Arquivo | Onde provar |
|-------|----------------|---------|-------------|
| 9.0 | Atualizar o ambiente e colocar o Módulo 6 no ar | — | `AlertmanagerUrl` responde |
| 9.1 | O dashboard mostra o comportamento normal | `grafana/dashboards/modulo-6.json` | Grafana |
| 9.2 | Uma anomalia é injetada no pagamento | `load.js`, `payment-service/app.js` | Grafana: pico de latência |
| 9.3 | Uma regra de alerta dispara | `alert-rules.yml` | Prometheus: aba **Alerts** |
| 9.4 | O Alertmanager agrupa e entrega | `alertmanager.yml`, `webhook/webhook.js` | Alertmanager e log do webhook |
| 9.5 | Limite fixo vs limite pelo comportamento | `alert-rules.yml` | Os dois alertas de latência lado a lado |
| 9.6 | Do alerta à causa | — | Jaeger: trace lento |
| 9.7 | Outras anomalias (opcional) | `load.js` | Alertas de erro e de fila |

### 9.0 Atualizar o ambiente e colocar o Módulo 6 no ar

O Alertmanager usa a porta 9093, que o Security Group ainda não libera se a stack foi criada antes deste módulo. No seu computador, rode de novo o comando do passo 2: ele só acrescenta a regra e o output `AlertmanagerUrl`, sem recriar a instância.

```bash
aws cloudformation deploy --stack-name obsf-modulo-2 --template-file observability-lab/modulo-2/aws/cloudformation.yaml --capabilities CAPABILITY_IAM --parameter-overrides AllowedCidr=0.0.0.0/0
```

No terminal da instância:

```bash
cd /opt/obsf && sudo git pull && sudo observability-lab/trocar-modulo.sh 6
```

Agora são 7 containers: os dois serviços, Jaeger, Prometheus, Grafana, Alertmanager e o webhook.

### 9.1 O dashboard mostra o comportamento normal

**O que dizer:** antes de falar de anomalia, precisamos saber o que é normal. Este dashboard já vem pronto com o ambiente.

**No código:** `modulo-6/grafana/dashboards/modulo-6.json`, carregado automaticamente pelo Grafana ao subir.

**Na demo:**

1. Em uma aba do terminal, comece o tráfego no modo `anomaly` (os 2 primeiros minutos são normais):

```bash
cd /opt/obsf/observability-lab/modulo-6 && sudo docker compose run --rm load --mode anomaly
```

2. Abra o `GrafanaUrl`: o dashboard "Módulo 6 — Anomalias e alertas" é a página inicial e não pede login.

| Painel | O normal |
|--------|----------|
| Taxa de requisições | Cerca de 20 por segundo na `checkout-api` e 10 no `payment-service` |
| Latência p95 | Cerca de 0,7 s na `checkout-api` e 0,5 s no `payment-service` |
| Taxa de erro (5xx) | 5% no `payment-service`, quase zero na `checkout-api` |
| Alertas ativos | Vazio |
| Pedidos pendentes | Oscila em ondas, sempre abaixo de 100 |

As linhas tracejadas vermelhas são os limites dos alertas.

### 9.2 Uma anomalia é injetada no pagamento

**O que dizer:** aos 2 minutos, o gerador de tráfego manda o `payment-service` ficar 2 segundos mais lento; aos 4 minutos, manda voltar ao normal. É um atraso controlado, para sabermos exatamente o que deveria aparecer.

**No código:**

`modulo-6/load.js`, a tabela de modos e a chamada que liga a anomalia:

```javascript
anomaly: { descricao: 'payment-service 2000 ms mais lento', chaos: { latency_ms: 2000 }, lote: 50 },
```

`modulo-6/payment-service/app.js`, o endpoint `/chaos` e o ponto onde o atraso é aplicado:

```javascript
// Caminho normal: 200 a 400 ms, mais a lentidão injetada pelo /chaos
await esperar(aleatorio(200, 400) + chaos.latency_ms);
```

**Na demo:**

1. No terminal do gerador aparece `>>>>>>>>>> ANOMALIA INICIADA: payment-service 2000 ms mais lento <<<<<<<<<<`.
2. No Grafana, em cerca de 30 segundos, o painel **Latência p95** sobe para perto de 3 s nos dois serviços e cruza a linha tracejada.
3. A **Taxa de erro** não muda: o serviço está lento, não quebrado. Só quem olha latência percebe.

### 9.3 Uma regra de alerta dispara

**O que dizer:** ninguém fica olhando o gráfico o dia todo. Uma regra descreve a condição, e o Prometheus a avalia a cada 5 segundos.

**No código** (`modulo-6/alert-rules.yml`):

```yaml
- alert: LatenciaAlta
  expr: job:latencia_p95:1m{job="checkout-api"} > 1
  for: 25s
  labels:
    severity: warning
```

O `for: 25s` exige que a condição se mantenha por 5 avaliações seguidas: um pico isolado não acorda ninguém.

| Alerta | Condição | Severidade |
|--------|----------|------------|
| `LatenciaAlta` | p95 da `checkout-api` acima de 1 s por 25 s | warning |
| `PagamentoComErros` | mais de 10% de erros no `payment-service` por 20 s | critical |
| `PedidosPendentesAcumulando` | mais de 100 pedidos pendentes por 10 s | warning |
| `LatenciaForaDoPadrao` | p95 acima da média recente + 3 desvios padrão | info |

**Na demo:**

1. Abra o `PrometheusUrl`, aba **Alerts**.
2. Acompanhe `LatenciaAlta` mudar de estado: **Inactive** (verde) → **Pending** (amarelo, condição verdadeira mas ainda dentro do `for`) → **Firing** (vermelho).
3. No Grafana, o alerta aparece no painel **Alertas ativos**. Leva cerca de 1 minuto do início da anomalia até o disparo.

### 9.4 O Alertmanager agrupa e entrega

**O que dizer:** o Prometheus decide **se** há um alerta. O Alertmanager decide **o que fazer com ele**: agrupar, silenciar, repetir, e para quem mandar.

**No código** (`modulo-6/alertmanager.yml`):

```yaml
route:
  receiver: webhook
  group_by: [alertname, severity]   # alertas iguais viram uma notificação só
  group_wait: 10s
  group_interval: 10s
  repeat_interval: 1m

receivers:
  - name: webhook
    webhook_configs:
      - url: http://webhook:5001/alerts
        send_resolved: true
```

O destino é `modulo-6/webhook/webhook.js`, um servidor de mentira que só imprime o que recebe. Em produção, esse lugar seria do Slack, PagerDuty ou e-mail.

**Na demo:**

1. Em outra aba do terminal:

```bash
sudo docker logs -f modulo-6-webhook-1
```

```
[2026-10-08T12:14:37.034Z] Alerta recebido (1)
  DISPAROU  LatenciaAlta [warning] Latência p95 da checkout-api acima de 1 s
            p95 em 2.842s (limite: 1 s)
```

2. Abra o `AlertmanagerUrl`: o mesmo alerta aparece na interface, com os rótulos e a opção de silenciar.
3. Aos 4 minutos a anomalia termina. Cerca de 1 minuto depois, o webhook recebe `RESOLVIDO LatenciaAlta`.

### 9.5 Limite fixo vs limite pelo comportamento

**O que dizer:** `LatenciaAlta` usa um número fixo (1 s). Funciona aqui, mas alguém teve que escolher esse número, e ele vale igual de madrugada e no pico. `LatenciaForaDoPadrao` não tem número: compara a latência atual com o que foi normal nos minutos anteriores.

**No código** (`modulo-6/alert-rules.yml`):

```yaml
- alert: LatenciaForaDoPadrao
  expr: |
    job:latencia_p95:1m{job="checkout-api"}
      > avg_over_time(job:latencia_p95:1m{job="checkout-api"}[5m] offset 2m)
        + 3 * stddev_over_time(job:latencia_p95:1m{job="checkout-api"}[5m] offset 2m)
```

**Na demo:** os dois alertas disparam na mesma anomalia. No Prometheus, rode a query do limite calculado e compare com o 1 s fixo:

```promql
avg_over_time(job:latencia_p95:1m{job="checkout-api"}[5m] offset 2m) + 3 * stddev_over_time(job:latencia_p95:1m{job="checkout-api"}[5m] offset 2m)
```

| | Limite fixo ("threshold burro") | Baseline + desvio padrão |
|---|---|---|
| Regra | `latência > 1 s` | `latência > média recente + 3 desvios` |
| Quem define o número | Uma pessoa, uma vez | Os próprios dados, continuamente |
| Serviço que normalmente responde em 50 ms e passa a 600 ms | Não alerta (abaixo de 1 s), embora esteja 12 vezes mais lento | Alerta |
| Serviço que normalmente leva 1,2 s | Alerta o tempo todo | Não alerta |
| Ponto fraco | Falsos positivos e falsos negativos; precisa de ajuste manual por serviço | Se a anomalia durar, ela vira o "novo normal" e o alerta se cala |

O ponto fraco da segunda coluna aparece na própria demo: o `offset 2m` existe para que os minutos de anomalia não contaminem a média usada na comparação.

**Como o ML entra nisso.** A regra acima é a forma mais simples de detecção de anomalia: uma média e um desvio. Ferramentas de AIOps levam a mesma ideia adiante:

- **Sazonalidade:** aprendem que segunda às 10h é diferente de domingo às 3h, e comparam com o mesmo horário de semanas anteriores.
- **Tendência:** distinguem um crescimento gradual esperado de um salto.
- **Várias métricas juntas:** percebem que latência subindo com tráfego estável é estranho, mas latência subindo junto com o tráfego talvez não.
- **Sem regra escrita:** o modelo é treinado com o histórico e aplicado a milhares de séries; ninguém escreve um limite por serviço.

Por isso a qualidade dos dados importa: um modelo treinado com telemetria incompleta, sem rótulos consistentes ou com buracos aprende um "normal" errado.

**Burn rate e error budget (prévia do Módulo 8).** Outra forma de alertar melhor é partir de um objetivo, e não de um limite técnico. Se o objetivo (SLO) é 99% de sucesso, o orçamento de erro é 1%. O burn rate diz a que velocidade esse orçamento está sendo gasto:

```promql
# Burn rate do payment-service para um SLO de 99%: 1 = gastando no ritmo previsto
job:taxa_de_erro:1m{job="payment-service"} / 0.01
```

Com os 5% de erro normais da demo, o resultado é 5: o orçamento do mês acabaria em 6 dias. O alerta deixa de ser "passou de X%" e vira "nesse ritmo, o objetivo não será cumprido".

### 9.6 Do alerta à causa

**O que dizer:** o alerta diz que a `checkout-api` está lenta. Ele não diz por quê. É aqui que os módulos anteriores se encontram.

**Na demo**, durante a anomalia (ou logo depois):

1. Jaeger → Service `checkout-api`, Operation `POST /orders`, **Min Duration** `2s`, **Find Traces**.
2. Abra um trace: quase todo o tempo está no span `process_payment`, do `payment-service`.
3. Clique em `process_payment` → **Tags**: `chaos.latency_ms=2000`.

O alerta veio de uma **métrica** da `checkout-api`; a causa estava em outro serviço e foi encontrada pelo **trace**.

### 9.7 Outras anomalias (opcional)

O mesmo gerador tem mais dois modos, com a mesma linha do tempo (normal até 2 min, anomalia até 4 min):

| Modo | O que provoca | Alerta que dispara |
|------|---------------|--------------------|
| `--mode anomaly` | `payment-service` 2 s mais lento | `LatenciaAlta` e `LatenciaForaDoPadrao` |
| `--mode erros` | 30% dos pagamentos falham | `PagamentoComErros` |
| `--mode pico` | Volume de pedidos triplica | `PedidosPendentesAcumulando` |

```bash
sudo docker compose run --rm load --mode erros
```

Ao parar o gerador com `Ctrl+C`, a anomalia é desfeita. Para conferir ou desfazer na mão:

```bash
curl -s -X POST localhost:3002/chaos -H "Content-Type: application/json" -d '{}'
```

### Resumo para fechar o módulo

| | Módulo 4 | Módulo 6 |
|---|----------|----------|
| Containers | 5 | 7 (mais Alertmanager e webhook) |
| Falhas | 5% de erro no pagamento, fixo | Anomalias ligadas e desligadas pelo `/chaos` |
| Quem percebe um problema | Quem estiver olhando | Regras de alerta, avaliadas a cada 5 s |
| Grafana | Só o datasource | Dashboard pronto, aberto sem login |
| Histograma de latência | 6 faixas | 10 faixas, para o p95 mostrar o pico |

Três ideias para os alunos levarem: um alerta é uma **regra avaliada sobre métricas**, não mágica; **limite fixo é fácil de escrever e difícil de acertar**; e o alerta diz **que** há um problema, enquanto traces e logs dizem **onde** e **por quê**.

## 10. Módulo 7: Datadog e Gremlin

A mesma aplicação do Módulo 6, agora enviando tudo para o Datadog. Jaeger, Prometheus, Grafana e Alertmanager saem; no lugar entra um único container, o Datadog Agent. Por fim, o Gremlin provoca falhas de verdade e usa um monitor do Datadog como freio de segurança.

| O que você quer mostrar | Onde no Datadog | Passo da demo |
|-------------------------|-----------------|---------------|
| Traces | APM → Traces | B.1 |
| Logs | Logs → Explorer | B.2 |
| Métricas | Metrics → Explorer | B.3 |
| Service mapping | APM → Service Map | B.4 |
| SLIs e SLOs | Service Mgmt → SLOs | B.5 |
| Alertas e anomalias (AIOps) | Monitors e Watchdog | B.6 |
| Teste de resiliência | Gremlin, com Health Check no monitor do Datadog | B.7 |

> **Estado deste módulo:** os arquivos foram escritos e o Docker Compose foi validado, mas o módulo **não foi executado** contra uma conta do Datadog nem do Gremlin. Os nomes de métricas e os caminhos de menu abaixo seguem a documentação; o passo A.5 mostra como conferir os nomes reais antes de criar monitores. Faça um ensaio completo antes da aula.

### Custos: como manter perto de zero

| Item | Quanto custa | Como economizar |
|------|--------------|-----------------|
| EC2 | A mesma `t3.small` dos outros módulos (cerca de US$ 0,03/h). Ela não é elegível ao free tier; a `t3.micro`, que é, tem 1 GB de memória e não comporta o Agent mais os builds. | Apague a stack ao final (passo 11). |
| Datadog | Avaliação gratuita de 14 dias, com todos os recursos. O plano gratuito permanente não cobre o que esta demo usa (APM, logs e métricas customizadas), então a demo depende do período de avaliação. | Crie a conta poucos dias antes da aula, direto no site e sem cadastrar cartão. |
| Gremlin | Avaliação gratuita (confira o prazo atual no site; fontes indicam 30 dias, sem cartão). | Mesma ideia: crie perto da data. |

O `docker-compose.yml` já vem ajustado para gastar pouco:

- **Um host só.** APM e infraestrutura são cobrados por host.
- **Logs só dos dois serviços.** `DD_LOGS_CONFIG_CONTAINER_COLLECT_ALL` está em `false`; log é cobrado por volume.
- **Só as métricas usadas.** A etiqueta `ad.checks` lista `http_request.*`, `orders_pending` e `traces.*`; cada métrica customizada conta.
- **Nada de recursos pagos à parte.** A demo usa Watchdog e monitores de anomalia, incluídos nos produtos básicos; não usa Bits AI nem outros complementos.

Dois cuidados que dependem de você: **gere tráfego só quando precisar** (o gerador produz cerca de 60 linhas de log por segundo) e, ao terminar, **derrube o módulo e revogue a API key** (passo B.8), para nada continuar enviando dados depois da avaliação.

## Parte A: Configuração (antes da aula)

Reserve cerca de 1 hora, de preferência na véspera, para dar tempo de acumular histórico (passo A.9).

### A.1 Criar a conta no Datadog

1. Crie uma conta de avaliação em datadoghq.com. Na criação você escolhe a região; anote o **site** que aparece no endereço depois do login (`app.datadoghq.com` → `datadoghq.com`; `us5.datadoghq.com` → `us5.datadoghq.com`; `app.datadoghq.eu` → `datadoghq.eu`).
2. O assistente inicial oferece instalar um Agent: pode pular, o Agent vem no nosso Docker Compose.

### A.2 Criar as chaves

No Datadog, em **Organization Settings**:

| Chave | Onde | Para quê |
|-------|------|----------|
| **API key** | API Keys → New Key | O Agent usa para enviar dados |
| **Application key** | Application Keys → New Key | Só o Gremlin usa, para ler o estado dos monitores (passo A.8) |

### A.3 Colocar as chaves na instância

As chaves ficam em um arquivo que **não vai para o GitHub** (o repositório é público). Publique o código (passo 1) e, no terminal da instância:

```bash
cd /opt/obsf && sudo git pull && cd observability-lab/modulo-7 && sudo cp segredos.env.exemplo segredos.env
```

```bash
sudo nano segredos.env
```

Preencha `DD_API_KEY` e `DD_SITE`. Deixe as linhas do Gremlin vazias por enquanto. Salve com `Ctrl+O`, `Enter`, `Ctrl+X`.

### A.4 Subir o Módulo 7

```bash
cd /opt/obsf && sudo observability-lab/trocar-modulo.sh 7
```

Confira se o Agent está saudável e falando com o Datadog:

```bash
sudo docker exec modulo-7-datadog-agent-1 agent status | grep -A3 "API Keys status"
```

Deve aparecer `API Key ending with ...: API Key valid`. Se aparecer inválida, revise `DD_API_KEY` e `DD_SITE` e rode o `trocar-modulo.sh 7` de novo.

### A.5 Gerar tráfego e conferir a chegada dos dados

```bash
cd /opt/obsf/observability-lab/modulo-7 && sudo docker compose run --rm load
```

Em 2 a 3 minutos, no Datadog (filtre sempre por `env:obsf-lab`):

| Sinal | Onde olhar | O que deve aparecer |
|-------|-----------|---------------------|
| Traces | **APM → Services** | `checkout-api` e `payment-service` |
| Logs | **Logs → Explorer**, busca `env:obsf-lab` | Linhas JSON dos dois serviços |
| Métricas | **Metrics → Summary**, busca `obsf.` | As métricas da aplicação |

**Anote os nomes exatos das métricas.** Os passos seguintes assumem estes, que são os esperados pela conversão do formato Prometheus:

| No Prometheus | No Datadog (esperado) |
|---------------|------------------------|
| `http_requests_total` | `obsf.http_requests.count` |
| `http_request_duration_seconds_sum` | `obsf.http_request_duration_seconds.sum` |
| `http_request_duration_seconds_count` | `obsf.http_request_duration_seconds.count` |
| `orders_pending` | `obsf.orders_pending` |

Se algum nome for diferente no **Metrics Summary**, use o que aparecer lá. Para ver direto no Agent:

```bash
sudo docker exec modulo-7-datadog-agent-1 agent check openmetrics | grep -o '"metric": "[^"]*"' | sort -u
```

Se algo não chegar:

| Falta | Verifique |
|-------|-----------|
| Traces | `sudo docker exec modulo-7-datadog-agent-1 agent status` → seções **OTLP** e **APM Agent** |
| Logs | Mesma saída, seção **Logs Agent** |
| Métricas | Mesma saída, seção **openmetrics** em **Running Checks** |

### A.6 Criar os monitores

Em **Monitors → New Monitor → Metric**. Crie os três; inclua a tag `env:obsf-lab` em cada um.

**Monitor 1: latência alta (limite fixo)**

| Campo | Valor |
|-------|-------|
| Detection method | Threshold Alert |
| Query `a` | `sum:obsf.http_request_duration_seconds.sum{service:checkout-api}.as_count()` |
| Query `b` | `sum:obsf.http_request_duration_seconds.count{service:checkout-api}.as_count()` |
| Formula | `a / b` (latência média em segundos) |
| Evaluate | sobre os últimos 2 minutos |
| Alert threshold | acima de `1` |
| Nome | `[obsf] Latência da checkout-api alta` |

**Monitor 2: latência fora do padrão (anomalia)**

| Campo | Valor |
|-------|-------|
| Detection method | Anomaly Detection |
| Queries e fórmula | As mesmas do Monitor 1 |
| Algoritmo | **Basic** (o único que funciona com pouco histórico) |
| Desvios (bounds) | `3` |
| Direção | acima dos limites (`above`) |
| Nome | `[obsf] Latência da checkout-api fora do padrão` |

**Monitor 3: erros no pagamento**

| Campo | Valor |
|-------|-------|
| Detection method | Threshold Alert |
| Query `a` | `sum:obsf.http_requests.count{service:payment-service,status:503}.as_count()` |
| Query `b` | `sum:obsf.http_requests.count{service:payment-service}.as_count()` |
| Formula | `a / b * 100` |
| Alert threshold | acima de `10` |
| Nome | `[obsf] Erros no payment-service` |

São os mesmos três alertas do Módulo 6, agora no Datadog. Copie o endereço do Monitor 1 no navegador: o Gremlin vai precisar dele (passo A.8).

### A.7 Criar os SLOs

Em **Service Mgmt → SLOs → New SLO**.

**SLO 1: disponibilidade da `checkout-api` (por métrica)**

| Campo | Valor |
|-------|-------|
| Tipo | Metric Based |
| Good events (numerador) | `sum:obsf.http_requests.count{service:checkout-api,!status:500,!status:502}.as_count()` |
| Total events (denominador) | `sum:obsf.http_requests.count{service:checkout-api}.as_count()` |
| Target | `99%` em 7 dias |
| Nome | `[obsf] Disponibilidade da checkout-api` |

O **SLI** é a fração de requisições sem erro do servidor; o **SLO** é a meta de 99%; o **error budget** é o 1% restante. Respostas 400 contam como boas: são erro do cliente, não do serviço.

**SLO 2: latência da `checkout-api` (por monitor)**

| Campo | Valor |
|-------|-------|
| Tipo | Monitor Based |
| Monitor | `[obsf] Latência da checkout-api alta` |
| Target | `99%` em 7 dias |
| Nome | `[obsf] Latência da checkout-api` |

Aqui o SLI é a fração do tempo em que o monitor ficou fora de alerta.

Opcional: no SLO 1, em **Set up Alerts**, crie um alerta de **Burn Rate**. É o conceito apresentado no passo 9.5.

### A.8 Configurar o Gremlin

1. Crie uma conta de avaliação em gremlin.com.
2. Em **Team Settings → Configuration**, copie o **Team ID** e o **Secret Key** (se o segredo não estiver visível, use **Reset**).
3. Na instância, acrescente os dois valores ao `segredos.env`:

```bash
cd /opt/obsf/observability-lab/modulo-7 && sudo nano segredos.env
```

4. Suba o agente do Gremlin:

```bash
sudo docker compose --profile gremlin up -d gremlin
```

5. No Gremlin, em **Agents** (ou **Hosts**), o host `obsf-demo` deve aparecer como ativo, e os containers da demo devem estar listados como alvos.
6. Crie o Health Check: **Health Checks → + Health Check → Datadog**. Escolha o site da sua conta, informe a **API key** e a **Application key** (passo A.2), salve a autenticação e selecione o monitor `[obsf] Latência da checkout-api alta` (pelo nome ou colando o endereço do monitor).
7. Crie o cenário: **Scenarios → New Scenario**.

| Campo | Valor |
|-------|-------|
| Nome | `Lentidão no pagamento` |
| Health Check | o do item 6 |
| Alvo | Containers → o container do `payment-service` (rótulo `com.docker.compose.service=payment-service`) |
| Experimento | Network → **Latency**, `2000` ms, duração `300` s |

O agente do Gremlin roda com permissões amplas sobre o host e o Docker, porque precisa mexer em rede e processos de outros containers. Use-o só nesta instância de demo.

Se o agente não aparecer no Gremlin, veja `sudo docker logs modulo-7-gremlin-1` e compare as opções do serviço `gremlin` no `docker-compose.yml` com o comando `docker run` da documentação atual do Gremlin.

### A.9 Deixar o ambiente "aquecer"

Detecção de anomalia precisa de passado para comparar:

| Recurso | Histórico necessário |
|---------|----------------------|
| Monitor de anomalia com algoritmo Basic | Alguns minutos a poucas horas de tráfego normal |
| Algoritmos Agile e Robust | Cerca de 3 vezes o ciclo sazonal (3 horas para ciclo de 1 hora; semanas para ciclo semanal) |
| Watchdog | Dias a semanas; em conta nova pode não mostrar nada |

Deixe o gerador rodando em modo normal por pelo menos 1 hora antes de ensaiar o passo B.6, e de novo antes da aula. Trate o Watchdog como bônus: se houver achados, mostre; se não, explique por quê.

### A.10 Ensaio

Rode a Parte B inteira uma vez. Depois, pare o tráfego e derrube o módulo até a aula:

```bash
cd /opt/obsf && sudo observability-lab/trocar-modulo.sh parar
```

## Parte B: Demonstração (na aula)

### B.0 Preparar (15 minutos antes)

```bash
cd /opt/obsf && sudo observability-lab/trocar-modulo.sh 7
```

```bash
cd /opt/obsf/observability-lab/modulo-7 && sudo docker compose --profile gremlin up -d gremlin
```

```bash
sudo docker compose run --rm load
```

Deixe o tráfego normal rodando. Abra o Datadog com o filtro `env:obsf-lab`.

### B.1 Traces: o código não mudou

**O que dizer:** no Módulo 4 falamos que, com OpenTelemetry, o destino vira configuração. Aqui está a prova: os traces saíram do Jaeger e foram para o Datadog sem tocar em `tracing.js`.

**No código:** `modulo-7/.env`, uma linha:

```
OTEL_EXPORTER_OTLP_ENDPOINT=http://datadog-agent:4318
```

E, em `modulo-7/docker-compose.yml`, o Agent aceitando o mesmo protocolo:

```yaml
DD_OTLP_CONFIG_RECEIVER_PROTOCOLS_HTTP_ENDPOINT: 0.0.0.0:4318
```

**Na demo:**

1. **APM → Traces**, filtro `service:checkout-api`.
2. Abra um trace de `POST /orders`: a mesma hierarquia dos Módulos 3 e 4, com os spans do `payment-service` no mesmo trace.
3. Clique em `process_order`: `payment_method`, `customer_tier` e os itens da baggage aparecem como tags do span.

### B.2 Logs ligados ao trace

**O que dizer:** os logs continuam saindo no stdout. O Agent lê o stdout dos containers e envia. Para o Datadog ligar o log ao trace, precisamos de quatro linhas a mais no logger.

**No código:** `modulo-7/api/app.js`, dentro do `mixin()` do Pino (a única mudança de código do módulo):

```javascript
dd: {
  trace_id: BigInt(`0x${traceId.slice(16)}`).toString(),
  span_id: BigInt(`0x${spanId}`).toString(),
},
```

E as etiquetas no `docker-compose.yml` que dizem ao Agent de quem é cada log:

```yaml
com.datadoghq.tags.service: checkout-api
com.datadoghq.ad.logs: '[{"source": "nodejs", "service": "checkout-api"}]'
```

**Na demo:**

1. **Logs → Explorer**, busca `env:obsf-lab service:checkout-api`.
2. Abra uma linha: os campos do JSON (`customer_id`, `order_id`, `correlation_id`) viraram atributos pesquisáveis.
3. No painel do log, abra a aba **Trace**: o Datadog mostra o trace daquela requisição. No sentido inverso, dentro de um trace no APM, a aba **Logs** lista as linhas daquele trace.
4. Compare com os módulos anteriores, em que o caminho era copiar o `trace_id` do terminal e colar no Jaeger.

### B.3 Métricas

**O que dizer:** a aplicação continua expondo `/metrics` no formato Prometheus. O Agent faz o papel do Prometheus e coleta.

**No código** (`modulo-7/docker-compose.yml`, etiqueta de cada serviço):

```yaml
com.datadoghq.ad.checks: '{"openmetrics": {"instances": [{"openmetrics_endpoint": "http://%%host%%:3000/metrics", "namespace": "obsf", "metrics": ["http_request.*", "orders_pending", "traces.*"]}]}}'
```

**Na demo:**

1. **Metrics → Explorer**, métrica `obsf.http_requests.count`, agrupada por `service` e `status`.
2. Os rótulos do Prometheus (`method`, `endpoint`, `status`) viraram tags.
3. Mostre `obsf.orders_pending`: é o mesmo gauge do Módulo 2.

### B.4 Service Map (se houver tempo)

**APM → Service Map**, filtro `env:obsf-lab`: `checkout-api` → `payment-service`, com taxa de requisições, erros e latência em cada nó. No Módulo 4 esses números vinham de uma ferramenta separada; aqui estão no próprio mapa.

### B.5 SLIs e SLOs

**O que dizer:** até aqui medimos o sistema. O SLO mede a promessa feita ao usuário e diz quanto ainda podemos errar.

**Na demo:**

1. **Service Mgmt → SLOs**, abra `[obsf] Disponibilidade da checkout-api`.
2. Mostre os três números: o **SLI** atual, a **meta** de 99% e o **error budget** restante.
3. Abra `[obsf] Latência da checkout-api` e mostre que um SLO também pode ser construído a partir de um monitor.
4. Pergunta para a turma: o `payment-service` falha 5% das vezes. Por que o SLO da `checkout-api` está saudável? (A nova tentativa esconde a falha; o SLO mede o que o usuário vê.)

### B.6 Alertas e anomalias

**O que dizer:** vamos repetir a anomalia do Módulo 6 e ver dois monitores reagirem: um com limite fixo, outro que aprendeu o que é normal.

**Na demo:**

1. Pare o gerador (`Ctrl+C`) e reinicie no modo anomalia:

```bash
sudo docker compose run --rm load --mode anomaly
```

2. Enquanto os 2 minutos normais passam, abra o monitor `[obsf] Latência da checkout-api fora do padrão`: o gráfico mostra a **faixa cinza** do comportamento esperado em torno da linha da métrica. Ninguém informou esses valores.
3. Aos 2 minutos a anomalia começa. A linha sai da faixa cinza e os dois monitores de latência passam a **Alert**.
4. Abra o **Watchdog** (menu principal): se houver histórico suficiente, ele lista a anomalia sem que nenhum monitor tenha sido criado para isso.
5. Em **APM → Traces**, filtre por duração acima de 2 s e abra um trace: o tempo está em `process_payment`, com a tag `chaos.latency_ms`. Do alerta à causa em dois cliques.
6. Aos 4 minutos a anomalia termina e os monitores voltam a **OK**.

| | Módulo 6 (open source) | Datadog |
|---|---|---|
| Limite fixo | Regra em `alert-rules.yml` | Monitor com Threshold |
| Baseline | Regra PromQL escrita à mão, com média e desvio padrão | Monitor de anomalia: escolhe-se o algoritmo e o Datadog calcula a faixa |
| Sem regra nenhuma | Não há | Watchdog |
| Entrega do alerta | Alertmanager → webhook | Notificação do próprio monitor |

### B.7 Teste de resiliência com o Gremlin

**O que dizer:** até agora a "falha" era um parâmetro da nossa aplicação. O Gremlin provoca a falha na rede do container, de fora, sem que a aplicação saiba. E ele observa um monitor do Datadog: se o sistema sair do aceitável, o experimento é interrompido sozinho.

**Na demo:**

1. Volte o gerador ao modo normal e espere o monitor `[obsf] Latência da checkout-api alta` ficar **OK**.
2. No Gremlin, abra o cenário `Lentidão no pagamento` e mostre o Health Check apontando para o monitor do Datadog.
3. Clique em **Run Scenario**.
4. No Datadog, a latência sobe como no passo B.6, mas desta vez o atributo `chaos.latency_ms` do span está em `0`: a aplicação não sabe de nada.
5. Em 1 a 3 minutos o monitor vai a **Alert**. O Gremlin detecta, **interrompe o experimento** antes dos 300 s e marca o cenário como interrompido pelo Health Check.
6. A latência volta ao normal e o monitor volta a **OK**.

Fechamento: a observabilidade deixou de ser só para investigar depois do problema. Ela virou o critério de segurança de um teste feito de propósito.

### B.8 Encerrar

No terminal da instância:

```bash
cd /opt/obsf && sudo observability-lab/trocar-modulo.sh parar
```

```bash
sudo docker rm -f modulo-7-gremlin-1
```

Depois da última aula com este módulo:

1. No Datadog, em **Organization Settings → API Keys**, revogue a API key e a Application key.
2. Na instância, apague o arquivo de chaves: `sudo rm /opt/obsf/observability-lab/modulo-7/segredos.env` (ele some de qualquer forma ao apagar a stack).
3. No Gremlin, remova o Health Check, que guarda as chaves do Datadog.

### Resumo para fechar o módulo

| Papel | Módulos 2 a 6 | Módulo 7 |
|-------|---------------|----------|
| Instrumentação | OpenTelemetry, Pino, prom-client | A mesma |
| Recebe os traces | Jaeger | Datadog Agent (OTLP) |
| Coleta as métricas | Prometheus | Datadog Agent (OpenMetrics) |
| Coleta os logs | `docker logs` | Datadog Agent |
| Consulta e dashboards | Jaeger UI, Prometheus, Grafana | Datadog |
| Alertas | Alertmanager | Monitores |
| Containers de observabilidade | 4 a 6 | 1 |
| Mudança no código | — | Quatro linhas no logger |

Três ideias para os alunos levarem: instrumentar com padrões abertos permite **trocar de ferramenta sem reescrever a aplicação**; uma plataforma integrada troca **esforço de operação por custo de licença**; e observabilidade madura é a que serve de **critério para decisões**, como metas (SLO) e testes de resiliência.

---

# Encerramento

## 11. Apagar tudo

```bash
aws cloudformation delete-stack --stack-name obsf-modulo-2
```

Isso remove a instância, o Security Group e a Role. Nada fica cobrando depois.

---

# Referência

## Problemas comuns

| Sintoma | O que fazer |
|---------|-------------|
| As URLs não abrem | Aguarde os 3 a 4 minutos iniciais. Se restringiu o `AllowedCidr` ao seu IP e ele mudou (outra rede, VPN), rode o passo 2 de novo com o IP atual. |
| A demo não subiu depois de criar a stack | No terminal da instância: `sudo tail -50 /var/log/cloud-init-output.log`. O erro mais comum é o `git clone` falhar porque o repositório está privado ou o código não foi enviado. |
| `trocar-modulo.sh` não existe na instância | A instância foi criada antes de o script entrar no repositório. O comando da rotina já começa com `git pull`, que o traz. |
| O Jaeger mostra dados do módulo anterior | Não deveria: cada troca de módulo recria o Jaeger, que guarda os traces em memória. Confira qual módulo está no ar com `sudo docker ps`. |
| `No default VPC` ao criar a stack | Crie uma com `aws ec2 create-default-vpc` ou use outra região. |

## Segurança

A demo usa HTTP sem criptografia, Grafana com `admin/admin` e Jaeger/Prometheus sem login. Com `0.0.0.0/0` tudo isso fica aberto para a internet: não coloque dados reais na demo e não deixe a stack ligada fora da aula.

## Rodar local (opcional)

Com o Docker Desktop aberto, as mesmas demos rodam na sua máquina. Na raiz do repositório:

```bash
observability-lab/trocar-modulo.sh 3
```

Endereços: app em http://localhost:3000, Jaeger em http://localhost:16686, Prometheus em http://localhost:9090 e Grafana em http://localhost:3001. Para derrubar:

```bash
observability-lab/trocar-modulo.sh parar
```

## Estrutura do repositório

```
observability-lab/
├── trocar-modulo.sh          coloca no ar a demo do módulo 2, 3, 4, 6 ou 7
├── modulo-1/assets/          infográficos de conceitos
├── modulo-2/                 checkout-api com os 3 pilares
│   ├── aws/cloudformation.yaml   o ambiente da AWS (usado por todos os módulos)
│   ├── app.js, load.js, .env
│   ├── docker-compose.yml, prometheus.yml, grafana/
│   ├── start.sh, atualizar.sh
│   └── assets/               diagrama, código → sinal, sampling
├── modulo-3/                 checkout-api com OpenTelemetry
│   ├── tracing.js            configuração do OpenTelemetry
│   ├── app.js, load.js, .env e os mesmos arquivos de infraestrutura
│   └── assets/               comparação das arquiteturas M2 e M3
├── modulo-4/                 dois serviços
│   ├── api/                  checkout-api (app.js, tracing.js, Dockerfile)
│   ├── payment-service/      serviço de pagamentos (app.js, tracing.js, Dockerfile)
│   ├── docker-compose.yml, prometheus.yml, .env, load.js, start.sh, atualizar.sh
│   └── assets/               infográficos de OpenTelemetry e do cenário open source
├── modulo-5/
│   ├── data-masking.js       funções de mascaramento
│   ├── exemplo.js            demonstração executável
│   └── assets/cia-triad.html infográfico da tríade CIA
├── modulo-6/                 os dois serviços do módulo 4, com anomalias e alertas
│   ├── api/, payment-service/    o payment-service ganha o endpoint /chaos
│   ├── load.js               gerador de tráfego com os modos anomaly, erros e pico
│   ├── alert-rules.yml       regras de alerta do Prometheus
│   ├── alertmanager.yml      agrupamento e destino dos alertas
│   ├── webhook/              destino de mentira que imprime os alertas
│   └── grafana/dashboards/   dashboard pronto
└── modulo-7/                 os mesmos serviços, enviando para o Datadog
    ├── api/, payment-service/    código do módulo 6 + campos dd.trace_id nos logs
    ├── docker-compose.yml    os dois serviços, o Datadog Agent e o agente do Gremlin
    ├── segredos.env.exemplo  modelo do arquivo de chaves (o segredos.env não vai para o GitHub)
    └── .env, load.js, start.sh, atualizar.sh
```
