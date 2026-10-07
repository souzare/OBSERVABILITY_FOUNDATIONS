# Observability Foundations — Laboratório

Material de apoio e demos do curso **Observability Foundations**. Todas as demos usam a mesma aplicação, a `checkout-api`, que evolui a cada módulo.

| Módulo | O que tem | Como usar |
|--------|-----------|-----------|
| 1 — Conceitos | Infográficos: ruído vs sinal, MELT, consumidores | Abrir os `.html` no navegador |
| 2 — Pilares | `checkout-api` com logs, métricas e traces; demo de sampling | Demo na AWS |
| 3 — OpenTelemetry | Auto-instrumentação, hierarquia de spans, baggage, eventos | Demo na AWS |
| 4 — Service mapping | Dois serviços em um único trace; mapa de serviços | Demo na AWS |
| 5 — DataOps e CIA Triad | Infográfico da tríade CIA e mascaramento de dados | Abrir o `.html` e rodar um script |

---

# Passo a passo: visão única

Um único ambiente na AWS serve os módulos 2, 3 e 4. Você o cria uma vez, troca de módulo com um comando e apaga tudo no final.

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
| 9 | [Apagar tudo](#9-apagar-tudo) | Ao final | Seu computador | `aws cloudformation delete-stack ...` |

Os passos 5, 6 e 7 seguem sempre a mesma [rotina de demo](#rotina-de-cada-demo-módulos-2-3-e-4): colocar o módulo no ar, gerar tráfego e abrir as ferramentas.

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

Leva cerca de 2 minutos e usa a região padrão do seu AWS CLI (para outra, acrescente `--region sa-east-1`). A stack se chama `obsf-modulo-2` por ter nascido nesse módulo, mas atende os módulos 2, 3 e 4.

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
- **Security Group:** libera as portas 3000, 3001, 9090 e 16686 para a faixa do parâmetro `AllowedCidr`. Não há SSH.
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
| `TerminalUrl` | Terminal da instância no navegador |

Os endereços são os mesmos para os módulos 2, 3 e 4. Depois que a stack fica pronta, a instância ainda leva **de 3 a 4 minutos** para instalar o Docker e subir a demo. Está pronta quando `AppUrl` + `/metrics` responder no navegador.

---

# Rotina de cada demo (módulos 2, 3 e 4)

Tudo aqui é feito no terminal da instância: abra o `TerminalUrl` no navegador (ou **EC2 → Instances → obsf-modulo-2 → Connect → Session Manager**).

## A. Colocar o módulo no ar

Troque o número no final pelo módulo desejado (`2`, `3` ou `4`):

```bash
cd /opt/obsf && sudo git pull && sudo observability-lab/trocar-modulo.sh 3
```

O comando baixa a última versão do código, derruba a demo que estiver rodando e sobe a do módulo escolhido. Os três módulos usam as mesmas portas, então só um roda por vez. O Módulo 4 constrói imagens na primeira vez e leva de 1 a 2 minutos.

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

Coloque no ar com `trocar-modulo.sh 2` e gere tráfego ([rotina](#rotina-de-cada-demo-módulos-2-3-e-4)). Neste módulo, 5% dos `GET /orders/:id` retornam 500 (falha intermitente).

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

Coloque no ar com `trocar-modulo.sh 4` e gere tráfego ([rotina](#rotina-de-cada-demo-módulos-2-3-e-4)). Com 5% de timeout no pagamento e uma nova tentativa automática, quase todos os pedidos terminam em 201; cerca de 1 a cada 400 termina em 502.

Material para projetar, em `observability-lab/modulo-4/assets/`: `infografico-opentelemetry.html` (OpenTelemetry em uma página) e `infografico-open-source.html` (panorama de ferramentas, com o que usamos na demo e as de IA).

### O que mudou em relação ao Módulo 3

| | Módulo 3 | Módulo 4 |
|---|----------|----------|
| Serviços | 1 (`checkout-api`) | 2 (`checkout-api` e `payment-service`), cada um em sua pasta, com seu `Dockerfile` |
| Etapas do pedido | validar, gravar, enviar e-mail | validar, gravar, **chamar o pagamento** |
| Trace | 5 spans de um serviço | 7 spans de dois serviços |
| Baggage | Entre spans do mesmo processo | Atravessa a rede no cabeçalho `baggage` |
| Falhas | Retries na gravação | Timeout em 5% dos pagamentos, com 1 nova tentativa |
| Prometheus | 1 alvo | 2 alvos; o rótulo `job` separa os serviços |

```
checkout-api     POST /orders
checkout-api     └─ process_order
checkout-api        ├─ validate_order
checkout-api        ├─ save_to_database
checkout-api        └─ call_payment_service        injeta traceparent + baggage
payment-service        └─ POST /process-payment    lê o traceparent e continua o trace
payment-service           └─ process_payment       vermelho quando dá timeout
```

### Como o trace atravessa a rede

1. Em `api/app.js`, dentro do span `call_payment_service`, a linha `propagation.inject(context.active(), headers)` grava dois cabeçalhos HTTP padrão W3C:

```
traceparent: 00-5739583a86180ffa37c64bcd03135b65-04514c4893c80e37-01
             versão - trace_id - span_id de quem chamou - amostrado
baggage:     customer_id=CUST-387,order_id=ORD-34b2424d,correlation_id=6aa000d0-...
```

2. No `payment-service`, a auto-instrumentação HTTP lê o `traceparent` e cria o span `POST /process-payment` como **filho** do span que chamou, em vez de começar um trace novo.
3. A `baggage` chega junto: `customer_id`, `order_id` e `correlation_id` aparecem nos spans e nos logs do `payment-service` sem que ninguém os tenha passado como parâmetro.

Se o cabeçalho não fosse enviado, cada serviço teria seu próprio trace e não haveria como ligar um ao outro.

### Mapa de serviços (Jaeger)

1. No Jaeger, abra **System Architecture** (em versões mais antigas da interface, **Dependencies**).
2. Aparecem duas caixas, `checkout-api` e `payment-service`, ligadas por uma seta com o número de chamadas.
3. Ninguém desenhou esse mapa: ele é calculado a partir dos traces, olhando qual serviço é pai de qual.

O mapa do Jaeger mostra apenas a contagem de chamadas. Taxa de requisições, erro e latência por serviço vêm do Prometheus (mais abaixo).

### Um trace com os dois serviços

1. Service `checkout-api`, Operation `POST /orders`, **Find Traces**.
2. Abra um trace: 7 spans, com cores diferentes para cada serviço.
3. Clique em `process_payment`: nas **Tags** estão `customer_id`, `order_id` e `correlation_id`, que vieram pela baggage.

### Um erro que atravessa os serviços

1. Na busca, Service `payment-service` e **Tags** `error=true`.
2. Abra um trace: o primeiro `process_payment` está em vermelho, com o evento `payment.gateway.timeout`, e dura cerca de 1 segundo.
3. Logo abaixo há um segundo `POST /process-payment`, bem-sucedido: é a nova tentativa. O span `call_payment_service` mostra `tentativas=2` e os eventos `payment.failed` e `payment.approved`.
4. O cliente recebeu 201, mas esperou 1 segundo a mais. Sem o trace, isso seria só "uma requisição lenta".

Para ver um pedido que falhou de vez, busque Service `checkout-api` com **Tags** `http.response.status_code=502`. Para que aconteça com mais frequência, aumente `PAYMENT_ERROR_RATE` em `observability-lab/modulo-4/.env` (por exemplo `0.3`), publique e rode `sudo ./atualizar.sh`.

### Números por serviço (Prometheus)

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

O `payment-service` mostra cerca de 5% de erro; a `checkout-api` mostra quase zero, porque a nova tentativa esconde a falha do cliente. A latência p95 da `checkout-api` é que denuncia o problema.

### O mesmo trace nos logs dos dois serviços

Pegue um `trace_id` de um pagamento com falha:

```bash
sudo docker logs modulo-4-payment-service-1 | grep '"level":"ERROR"' | tail -1
```

Procure o mesmo `trace_id` nos logs da `checkout-api` (troque `TRACE_ID`):

```bash
sudo docker logs modulo-4-api-1 | grep TRACE_ID
```

As linhas dos dois serviços têm o mesmo `trace_id` e o mesmo `correlation_id`. O log `pagamento recebido` do `payment-service` mostra os cabeçalhos `traceparent` e `baggage` exatamente como chegaram.

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

---

# Encerramento

## 9. Apagar tudo

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
├── trocar-modulo.sh          coloca no ar a demo do módulo 2, 3 ou 4
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
└── modulo-5/
    ├── data-masking.js       funções de mascaramento
    ├── exemplo.js            demonstração executável
    └── assets/cia-triad.html infográfico da tríade CIA
```
