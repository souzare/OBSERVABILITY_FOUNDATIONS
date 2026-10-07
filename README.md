# Observability Foundations — Laboratório

Material de apoio e demos do curso **Observability Foundations**.

| Módulo | Conteúdo | Onde está |
|--------|----------|-----------|
| 1 — Conceitos | Infográficos: ruído vs sinal, MELT, consumidores de observabilidade | `observability-lab/modulo-1/assets/` (abra os `.html` no navegador) |
| 2 — Pilares | Demo `checkout-api` com logs, métricas e traces, rodando na AWS | `observability-lab/modulo-2/` |
| 3 — OpenTelemetry | A mesma API com auto-instrumentação, hierarquia de spans, baggage e eventos | `observability-lab/modulo-3/` ([instruções](#módulo-3-opentelemetry)) |
| 4 — Service mapping | Dois serviços (`checkout-api` → `payment-service`) em um único trace, com mapa de serviços | `observability-lab/modulo-4/` ([instruções](#módulo-4-service-mapping)) |
| 5 — DataOps e CIA Triad | Infográfico da tríade CIA e biblioteca de mascaramento de dados sensíveis | `observability-lab/modulo-5/` ([instruções](#módulo-5-dataops-e-cia-triad)) |

---

# Módulo 2: Pilares da Observabilidade na AWS

Uma API de pedidos (`checkout-api`) instrumentada com os 3 pilares: **logs** (Pino), **métricas** (Prometheus) e **traces** (OpenTelemetry + Jaeger).

## Arquitetura

Um template do CloudFormation cria tudo:

```
Seu navegador ──(AllowedCidr)──▶ Security Group ──▶ EC2 t3.small (Amazon Linux 2023)
                                                          └─ Docker Compose
                                                              ├─ app         :3000   checkout-api
                                                              ├─ jaeger      :16686  traces
                                                              ├─ prometheus  :9090   métricas
                                                              └─ grafana     :3001   dashboards
```

- **EC2**: ao iniciar, instala o Docker, clona este repositório e executa `start.sh`.
- **Security Group**: libera as portas 3000, 3001, 9090 e 16686 para a faixa de IP do parâmetro `AllowedCidr`. Não há SSH.
- **IAM Role**: permite abrir o terminal da instância pelo Session Manager (sem chave `.pem`).

Custo aproximado: US$ 0,03 por hora enquanto a stack existir. **Apague a stack ao final da aula** (passo 8).

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
aws cloudformation deploy --stack-name obsf-modulo-2 --template-file observability-lab/modulo-2/aws/cloudformation.yaml --capabilities CAPABILITY_IAM --parameter-overrides AllowedCidr=0.0.0.0/0
```

O comando usa a região padrão do seu AWS CLI (para outra, acrescente `--region sa-east-1`) e leva cerca de 2 minutos.
Com `AllowedCidr=0.0.0.0/0` qualquer pessoa com o endereço acessa a demo, o que facilita o uso com os alunos; apague a stack ao fim da aula (passo 8).
Para restringir ao seu IP, use `AllowedCidr=$(curl -s https://checkip.amazonaws.com)/32`. Rodar o comando de novo com outro valor atualiza a regra sem recriar a instância.

Parâmetros opcionais (acrescente em `--parameter-overrides`):

| Parâmetro | Padrão | Para que serve |
|-----------|--------|----------------|
| `RepoUrl` | `https://github.com/souzare/OBSERVABILITY_FOUNDATIONS.git` | Outro fork do repositório |
| `RepoBranch` | `main` | Outra branch |
| `InstanceType` | `t3.small` | `t3.medium` ou `t3.large` |

Prefere o console? **CloudFormation → Create stack → Upload a template file**, envie `observability-lab/modulo-2/aws/cloudformation.yaml`, preencha `AllowedCidr` com `0.0.0.0/0` (ou `SEU_IP/32` para restringir) e marque a caixa de confirmação de recursos IAM.

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

## 6. Demo de sampling: com e sem amostragem

A app já tem o sampler configurado em `app.js` (bloco `sampler:` do `NodeSDK`). A taxa vem da variável `TRACE_SAMPLE_RATE` no `.env`, que começa em `1.0` (100% dos traces, ou seja, sem sampling).

> Se a instância foi criada antes de o sampler entrar no repositório, ela ainda não tem o `atualizar.sh` nem a métrica `traces_total`. Atualize uma vez, antes da aula, no terminal da instância:
> `cd /opt/obsf && sudo git pull && cd observability-lab/modulo-2 && sudo ./atualizar.sh`

**Antes: sem sampling.** Com o gerador de tráfego rodando, abra o Prometheus e rode as duas queries (aba **Graph**):

```promql
# Requisições por segundo
sum(rate(http_requests_total[1m]))
```

```promql
# Traces por segundo enviados ao Jaeger
sum(rate(traces_total{sampled="true"}[1m]))
```

As duas linhas ficam iguais: toda requisição gera um trace.

**Aplicar o sampling.** No seu computador, edite `observability-lab/modulo-2/.env` e troque para `TRACE_SAMPLE_RATE=0.1`. Depois:

```bash
git commit -am "Aplica sampling de 10% nos traces"
```

```bash
git push origin main
```

No terminal da instância:

```bash
cd /opt/obsf/observability-lab/modulo-2
```

```bash
sudo ./atualizar.sh
```

O script faz `git pull`, recria a app e mostra a taxa que entrou em vigor (`"trace_sample_rate":0.1`). O Jaeger e o Prometheus não são reiniciados, então o histórico é preservado.

**Depois: com sampling.** Em cerca de um minuto:

- No Prometheus, a linha de traces cai para cerca de 10% da linha de requisições. A fração exata:

```promql
sum(rate(traces_total{sampled="true"}[1m])) / sum(rate(traces_total[1m]))
```

- Nos logs, todo registro continua tendo `trace_id`, mas agora com `"sampled":false` na maioria:

```bash
sudo docker logs --since 1m modulo-2-app-1 | grep -c '"sampled":false'
```

- No Jaeger, busque os últimos 5 minutos: aparecem bem menos traces. Copie o `trace_id` de um log com `"sampled":false` e cole na busca: o Jaeger não encontra.
- Os erros também são amostrados: a maioria dos 500 fica sem trace. É a limitação do head sampling.

Para voltar, troque para `TRACE_SAMPLE_RATE=1.0`, faça commit, push e rode `sudo ./atualizar.sh` de novo.

Material de apoio para projetar (abra no navegador): `observability-lab/modulo-2/assets/sampling.html` (com e sem sampling), `codigo-para-sinal.html` (o código que gera cada sinal) e `diagrama-arquitetura.html`.

## 7. Observações para aula

- **Logs** mostram o QUÊ aconteceu (eventos, um a um, com todo o contexto)
- **Métricas** mostram agregados (quantos, quanto tempo)
- **Traces** mostram a HISTÓRIA completa de uma requisição (início ao fim)
- Nos logs o `endpoint` é o caminho real (`/orders/ORD-123`); nas métricas é a rota (`/orders/:id`).
  É proposital: um label por pedido criaria milhares de séries no Prometheus (alta cardinalidade).

## 8. Apagar tudo

```bash
aws cloudformation delete-stack --stack-name obsf-modulo-2
```

Isso remove a instância, o Security Group e a Role. Nada fica cobrando depois.

## Problemas comuns

| Sintoma | O que fazer |
|---------|-------------|
| As URLs não abrem | Aguarde os 3 a 4 minutos iniciais. Se restringiu o `AllowedCidr` ao seu IP e ele mudou (outra rede, VPN), rode o passo 2 de novo com o IP atual. |
| A demo não subiu | No terminal da instância: `sudo tail -50 /var/log/cloud-init-output.log`. O erro mais comum é o `git clone` falhar porque o repositório está privado ou o código não foi enviado. |
| Atualizei o código | No terminal da instância: `cd /opt/obsf/observability-lab/modulo-2 && sudo ./atualizar.sh` |
| `No default VPC` ao criar a stack | Crie uma com `aws ec2 create-default-vpc` ou use outra região. |

## Segurança

A demo usa HTTP sem criptografia, Grafana com `admin/admin` e Jaeger/Prometheus sem login. Com `0.0.0.0/0` tudo isso fica aberto para a internet: não coloque dados reais na demo e não deixe a stack ligada fora da aula.

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
| `atualizar.sh` | Na instância: baixa a última versão do código e recria a app |
| `assets/` | Diagrama e páginas de apoio para projetar na aula |

## Rodar local (opcional)

Com o Docker Desktop aberto, a mesma demo roda na sua máquina:

```bash
cd observability-lab/modulo-2 && ./start.sh
```

Endereços: app em http://localhost:3000, Jaeger em http://localhost:16686, Prometheus em http://localhost:9090 e Grafana em http://localhost:3001. Para parar: `docker compose down`.

---

# Módulo 3: OpenTelemetry

A mesma `checkout-api` do Módulo 2, refeita com o SDK do OpenTelemetry. Prometheus, Grafana e Jaeger são os mesmos; o que muda é a instrumentação de traces e logs.

## O que mudou em relação ao Módulo 2

| | Módulo 2 | Módulo 3 |
|---|----------|----------|
| Span da requisição | Criado na mão, em um middleware | Criado pela **auto-instrumentação** HTTP/Express |
| Configuração | Dentro do `app.js` | Em `tracing.js`, carregado na primeira linha do `app.js` |
| Trace do `POST /orders` | 2 spans | 5 spans em **hierarquia** |
| Contexto do pedido | Atributos só no span raiz | **Baggage** levada a todos os spans e logs |
| Momentos dentro do span | Não havia | **Eventos** (validação, gravação, e-mail, retries) |
| Logs | `trace_id` | `trace_id` + `span_id` + itens da baggage |
| Erros | 5% aleatório no GET | Retries na gravação: até 3 tentativas, depois erro 500 |

Hierarquia de um `POST /orders`:

```
POST /orders                    auto-instrumentação HTTP
└─ process_order                span de negócio: payment_method, customer_tier
   ├─ validate_order            ~50 ms   eventos: order.validation.started / passed / failed
   ├─ save_to_database          ~200 ms por tentativa   atributos: tentativas, rows_affected, db_latency_ms
   └─ send_confirmation_email   ~150 ms  evento: email.send.queued
```

## Conceitos

| Conceito | O que é | Onde ver no código | Onde ver na demo |
|----------|---------|--------------------|------------------|
| **Atributo** | Um par chave/valor que descreve **um span**. Serve de filtro na busca. | `span.setAttributes({ payment_method, customer_tier })` em `app.js` | Jaeger, aba **Tags** do span `process_order` |
| **Baggage** | Dados que **viajam com a requisição** pelo contexto, de um span para o próximo (e entre serviços). Sozinha ela não aparece em lugar nenhum: alguém precisa ler e usar. | `propagation.createBaggage(...)` em `app.js`; a classe `BaggageParaAtributos` em `tracing.js` copia cada item para os spans | `customer_id`, `order_id` e `correlation_id` em **todos** os spans filhos e em todas as linhas de log |
| **Evento** | Um **momento** dentro de um span, com horário exato. É como um log preso ao span. | `span.addEvent('order.validation.passed')` | Jaeger, seção **Logs** dentro do span |
| **Correlação de logs** | Toda linha de log carrega o `trace_id` e o `span_id` do span ativo. | `mixin()` do Pino em `app.js` | `docker logs`: copie o `trace_id` e cole na busca do Jaeger |

Regra prática: **atributo** responde "como era esta operação?", **evento** responde "o que aconteceu durante ela, e quando?", **baggage** responde "que contexto as próximas etapas precisam conhecer?".

## Subir a demo

### Opção A: na mesma instância do Módulo 2 (recomendado)

Usa a stack `obsf-modulo-2` que já existe; os endereços continuam os mesmos. Depois de publicar o código do Módulo 3 no GitHub (`git add -A`, `git commit`, `git push origin main`), no terminal da instância:

```bash
cd /opt/obsf && sudo git pull
```

```bash
cd /opt/obsf/observability-lab/modulo-2 && sudo docker compose down
```

```bash
cd /opt/obsf/observability-lab/modulo-3 && sudo ./start.sh
```

Para voltar ao Módulo 2, faça o inverso: `docker compose down` na pasta `modulo-3` e `./start.sh` na `modulo-2`. Os dois módulos usam as mesmas portas, então só um roda por vez.

### Opção B: uma instância só para o Módulo 3

```bash
aws cloudformation deploy --stack-name obsf-modulo-3 --template-file observability-lab/modulo-3/aws/cloudformation.yaml --capabilities CAPABILITY_IAM --parameter-overrides AllowedCidr=0.0.0.0/0
```

```bash
aws cloudformation describe-stacks --stack-name obsf-modulo-3 --query "Stacks[0].Outputs[].[OutputKey,OutputValue]" --output table
```

Vale tudo o que está descrito no Módulo 2 (tempo de espera, segurança, custo). Ao final: `aws cloudformation delete-stack --stack-name obsf-modulo-3`.

### Opção C: local

```bash
cd observability-lab/modulo-3 && ./start.sh
```

## Gerar tráfego

No terminal da instância (ou local), dentro de `observability-lab/modulo-3`:

```bash
sudo docker compose run --rm load
```

Igual ao do Módulo 2, com dois acréscimos: o cabeçalho `X-Customer-Tier` (`premium` ou `standard`) e o campo `payment_method` (`credit_card`, `pix` ou `boleto`).

## O que mostrar

### 1. Hierarquia e timeline (Jaeger)

1. Service `checkout-api`, Operation `POST /orders`, **Find Traces**.
2. Abra um trace: são 5 spans. A timeline mostra que `save_to_database` é a etapa mais demorada.
3. Clique em `process_order` → **Tags**: `payment_method`, `customer_tier` (atributos) e `customer_id`, `order_id`, `correlation_id` (vindos da baggage).
4. Clique em `validate_order` → **Logs**: os eventos `order.validation.started` e `order.validation.passed`, com o horário de cada um.
5. Clique em `save_to_database`: o atributo `tentativas` e, quando houve nova tentativa, o evento `database.insert.retry`.

### 2. Buscar por atributo

No campo **Tags** da busca do Jaeger:

| Busca | O que encontra |
|-------|----------------|
| `customer_tier=premium` | Pedidos de clientes premium |
| `payment_method=pix` | Pedidos pagos com pix |
| `tentativas=2` | Gravações que precisaram de uma segunda tentativa |
| `error=true` | Pedidos inválidos (400) e falhas de banco (500) |

### 3. Um erro de ponta a ponta

1. Busque `error=true` com Operation `POST /orders` e abra um trace com status 500.
2. `save_to_database` aparece em vermelho, com três eventos `database.insert.retry` e um evento `exception` com a mensagem e a stack trace.
3. O erro sobe pela hierarquia: `process_order` e `POST /orders` também ficam marcados.

### 4. Do log ao trace

```bash
sudo docker logs modulo-3-app-1 | grep '"level":"ERROR"' | tail -1
```

Copie o `trace_id` e cole na busca do Jaeger: abre o trace daquela requisição. O `span_id` indica em qual span o log foi escrito.

O Jaeger não exibe os logs da aplicação, então o caminho é sempre log → `trace_id` → Jaeger. Os "Logs" que aparecem dentro de um span no Jaeger são os **eventos** do span.

Exemplo de linha de log (uma por etapa do pedido):

```json
{"level":"INFO","timestamp":"2026-10-06T20:40:01.351Z","service":"checkout-api","trace_id":"b2d9f3f1172fe36f2a47271fe41007b2","span_id":"fd7964e987e9ccfd","customer_id":"CUST-293","order_id":"ORD-6d000d1b","correlation_id":"462ab034-59e6-4d81-b2e2-6e28905df7c3","message":"pedido validado"}
```

### 5. Métricas e sampling

Continuam como no Módulo 2: mesmas queries no Prometheus, mesmo `TRACE_SAMPLE_RATE` no `.env` e mesmo `sudo ./atualizar.sh` (agora na pasta `modulo-3`).

## Arquivos do módulo 3

| Arquivo | Para que serve |
|---------|----------------|
| `tracing.js` | Configuração do OpenTelemetry: recurso, sampler, exportador, auto-instrumentação e baggage → atributos |
| `app.js` | A aplicação: hierarquia de spans, baggage, atributos, eventos e logs correlacionados |
| `load.js` | Gerador de tráfego |
| `.env` | Variáveis (taxa de falha do banco, taxa de sampling) |
| Demais arquivos | Iguais aos do Módulo 2 (Docker Compose, Prometheus, Grafana, scripts, template da AWS) |

---

# Módulo 4: Service mapping

A `checkout-api` do Módulo 3 passa a chamar um segundo serviço, o `payment-service`, para cobrar o pedido. O foco é a **propagação de contexto**: os dois serviços escrevem spans no mesmo trace, e o Jaeger monta o mapa de serviços a partir disso.

Material de apoio para projetar: `observability-lab/modulo-4/assets/infografico-opentelemetry.html` e `infografico-open-source.html`.

## O que mudou em relação ao Módulo 3

| | Módulo 3 | Módulo 4 |
|---|----------|----------|
| Serviços | 1 (`checkout-api`) | 2 (`checkout-api` e `payment-service`), cada um em sua pasta, com seu `Dockerfile` |
| Etapas do pedido | validar, gravar, enviar e-mail | validar, gravar, **chamar o pagamento** |
| Trace | 5 spans de um serviço | 7 spans de dois serviços |
| Baggage | Entre spans do mesmo processo | Atravessa a rede no cabeçalho `baggage` |
| Falhas | Retries na gravação | Timeout em 5% dos pagamentos, com 1 nova tentativa |
| Prometheus | 1 alvo | 2 alvos; o rótulo `job` separa os serviços |

Trace de um `POST /orders`:

```
checkout-api     POST /orders
checkout-api     └─ process_order
checkout-api        ├─ validate_order
checkout-api        ├─ save_to_database
checkout-api        └─ call_payment_service        injeta traceparent + baggage
payment-service        └─ POST /process-payment    lê o traceparent e continua o trace
payment-service           └─ process_payment       vermelho quando dá timeout
```

## Como o trace atravessa a rede

1. Em `api/app.js`, dentro do span `call_payment_service`, a linha `propagation.inject(context.active(), headers)` grava dois cabeçalhos HTTP padrão W3C:

```
traceparent: 00-5739583a86180ffa37c64bcd03135b65-04514c4893c80e37-01
             versão - trace_id - span_id de quem chamou - amostrado
baggage:     customer_id=CUST-387,order_id=ORD-34b2424d,correlation_id=6aa000d0-...
```

2. No `payment-service`, a auto-instrumentação HTTP lê o `traceparent` e cria o span `POST /process-payment` como **filho** do span que chamou, em vez de começar um trace novo.
3. A `baggage` chega junto: `customer_id`, `order_id` e `correlation_id` aparecem nos spans e nos logs do `payment-service` sem que ninguém os tenha passado como parâmetro.

Se o cabeçalho não fosse enviado, cada serviço teria seu próprio trace e não haveria como ligar um ao outro.

## Subir a demo

### Opção A: na instância que já existe (recomendado)

Depois de publicar o código no GitHub, no terminal da instância:

```bash
cd /opt/obsf && sudo git pull
```

Derrube o módulo que estiver no ar (troque `modulo-3` por `modulo-2` se for o caso):

```bash
cd /opt/obsf/observability-lab/modulo-3 && sudo docker compose down
```

```bash
cd /opt/obsf/observability-lab/modulo-4 && sudo ./start.sh
```

Na primeira vez o `start.sh` constrói as imagens dos dois serviços, o que leva de 1 a 2 minutos. Os endereços e portas são os mesmos dos módulos anteriores.

### Opção B: uma instância só para o Módulo 4

```bash
aws cloudformation deploy --stack-name obsf-modulo-4 --template-file observability-lab/modulo-4/aws/cloudformation.yaml --capabilities CAPABILITY_IAM --parameter-overrides AllowedCidr=0.0.0.0/0
```

```bash
aws cloudformation describe-stacks --stack-name obsf-modulo-4 --query "Stacks[0].Outputs[].[OutputKey,OutputValue]" --output table
```

Ao final: `aws cloudformation delete-stack --stack-name obsf-modulo-4`.

### Opção C: local

```bash
cd observability-lab/modulo-4 && ./start.sh
```

## Gerar tráfego

Dentro de `observability-lab/modulo-4`:

```bash
sudo docker compose run --rm load
```

É o mesmo gerador do Módulo 3. Com 5% de timeout no pagamento e uma nova tentativa automática, quase todos os pedidos terminam em 201; cerca de 1 a cada 400 termina em 502.

## O que mostrar

### 1. Mapa de serviços (Jaeger)

1. No Jaeger, abra **System Architecture** (em versões mais antigas da interface, **Dependencies**).
2. Aparecem duas caixas, `checkout-api` e `payment-service`, ligadas por uma seta com o número de chamadas.
3. Ninguém desenhou esse mapa: ele é calculado a partir dos traces, olhando qual serviço é pai de qual.

O mapa do Jaeger mostra apenas a contagem de chamadas. Taxa de requisições, erro e latência por serviço vêm do Prometheus (item 4).

### 2. Um trace com os dois serviços

1. Service `checkout-api`, Operation `POST /orders`, **Find Traces**.
2. Abra um trace: 7 spans, com cores diferentes para cada serviço.
3. Clique em `process_payment`: nas **Tags** estão `customer_id`, `order_id` e `correlation_id`, que vieram pela baggage.

### 3. Um erro que atravessa os serviços

1. Na busca, Service `payment-service` e **Tags** `error=true`.
2. Abra um trace: o primeiro `process_payment` está em vermelho, com o evento `payment.gateway.timeout` e dura cerca de 1 segundo.
3. Logo abaixo há um segundo `POST /process-payment`, bem-sucedido: é a nova tentativa. O span `call_payment_service` mostra `tentativas=2` e os eventos `payment.failed` e `payment.approved`.
4. O cliente recebeu 201, mas esperou 1 segundo a mais. Sem o trace, isso seria só "uma requisição lenta".

Para ver um pedido que falhou de vez, busque Service `checkout-api` com **Tags** `http.response.status_code=502`. Para que aconteça com mais frequência, aumente `PAYMENT_ERROR_RATE` no `.env` (por exemplo `0.3`) e rode `sudo ./atualizar.sh`.

### 4. Números por serviço (Prometheus)

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

### 5. O mesmo trace nos logs dos dois serviços

Pegue um `trace_id` de um pagamento com falha:

```bash
sudo docker logs modulo-4-payment-service-1 | grep '"level":"ERROR"' | tail -1
```

Procure o mesmo `trace_id` nos logs da `checkout-api` (troque `TRACE_ID`):

```bash
sudo docker logs modulo-4-api-1 | grep TRACE_ID
```

As linhas dos dois serviços têm o mesmo `trace_id` e o mesmo `correlation_id`. O log `pagamento recebido` do `payment-service` mostra os cabeçalhos `traceparent` e `baggage` exatamente como chegaram.

## Arquivos do módulo 4

| Arquivo | Para que serve |
|---------|----------------|
| `api/app.js` | A `checkout-api`; a novidade é a função `chamarPagamento` |
| `payment-service/app.js` | O serviço de pagamentos |
| `api/tracing.js`, `payment-service/tracing.js` | Configuração do OpenTelemetry, igual nos dois; o nome do serviço vem da variável `SERVICE_NAME` |
| `api/Dockerfile`, `payment-service/Dockerfile` | Imagem de cada serviço |
| `docker-compose.yml` | Os dois serviços, Jaeger, Prometheus e Grafana |
| `prometheus.yml` | Um job de scrape por serviço |
| `.env` | Taxa de timeout do pagamento, sampling e endereços |
| `start.sh`, `atualizar.sh` | Sobem e atualizam a demo (agora com `--build`) |

---

# Módulo 5: DataOps e CIA Triad

Telemetria também é dado. Este módulo aplica a tríade CIA (confidencialidade, integridade e disponibilidade) aos logs, métricas e traces da `checkout-api`. Não há nada para subir na AWS: é um infográfico e um exemplo de código que roda em segundos.

## CIA Triad na Observabilidade

| Pilar | O que significa | Na observabilidade |
|-------|-----------------|--------------------|
| **Confidentiality** (Confidencialidade) | Dados não expostos sem autorização | Mascarar dados sensíveis antes de irem para logs e traces. Exemplo: e-mail vira `j***@*.com` |
| **Integrity** (Integridade) | Dados não podem ser alterados | O `trace_id` é o mesmo do início ao fim da requisição, o `timestamp` é gravado na origem e não muda, e o hash do payload denuncia qualquer alteração |
| **Availability** (Disponibilidade) | Dados sempre acessíveis quando necessário | Backup de métricas (Prometheus em alta disponibilidade) e persistência de traces (Jaeger com armazenamento em disco) |

Infográfico interativo para projetar: abra `observability-lab/modulo-5/assets/cia-triad.html` no navegador e clique em cada círculo.

Sobre disponibilidade, a demo dos módulos anteriores é um bom contraexemplo: há um único Prometheus e o Jaeger guarda os traces em memória, então reiniciar o container apaga tudo.

## Data Masking na Prática

A biblioteca `observability-lab/modulo-5/data-masking.js` não tem dependências e traz:

| Função | Antes | Depois |
|--------|-------|--------|
| `maskEmail` | `john.doe@company.com` | `j***@*.com` |
| `maskCreditCard` | `4532-1234-5678-9999` | `****-****-****-9999` |
| `maskCustomerId` | `CUST-295` | `CUST-****` |
| `maskPhone` | `+55 (11) 98765-1234` | `***-****-1234` |
| `maskIPAddress` | `192.168.10.25` | `192.168.***.***` |
| `pseudonymize` | `CUST-295` | `pseudo-165c596bcce9` (código estável por cliente) |
| `maskSensitiveFields` | um objeto inteiro | cópia com todos os campos sensíveis conhecidos mascarados |

### Rodar o exemplo

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

### Usar nos logs

Campo a campo:

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

## Arquivos do módulo 5

| Arquivo | Para que serve |
|---------|----------------|
| `assets/cia-triad.html` | Infográfico interativo da tríade CIA |
| `data-masking.js` | Funções de mascaramento e pseudonimização |
| `exemplo.js` | Demonstração executável: antes e depois, e hash de integridade |
