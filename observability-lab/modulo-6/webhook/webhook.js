// =============================================================
// webhook.js — destino "de mentira" para os alertas (Módulo 6)
//
// Em produção, este lugar seria ocupado por Slack, PagerDuty, e-mail etc.
// Aqui só imprimimos o que o Alertmanager enviou.
// Acompanhe com:  docker logs -f modulo-6-webhook-1
// =============================================================

const express = require('express');

const PORT = process.env.PORT || 5001;
const app = express();
app.use(express.json());

app.post('/alerts', (req, res) => {
  const { alerts = [] } = req.body || {};

  console.log(`\n[${new Date().toISOString()}] Alerta recebido (${alerts.length})`);
  for (const alerta of alerts) {
    const estado = alerta.status === 'firing' ? 'DISPAROU ' : 'RESOLVIDO';
    console.log(`  ${estado} ${alerta.labels.alertname} [${alerta.labels.severity}] ${alerta.annotations.summary}`);
    console.log(`            ${alerta.annotations.description}`);
  }

  // O corpo completo, como o Alertmanager enviou (defina VERBOSE=true para ver)
  if (process.env.VERBOSE === 'true') console.log(JSON.stringify(req.body, null, 2));

  res.json({ recebido: alerts.length });
});

app.listen(PORT, () => console.log(`Webhook aguardando alertas na porta ${PORT}`));
