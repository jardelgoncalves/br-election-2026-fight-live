# Deploy de produção

O projeto é entregue como um único serviço Node.js: a API serve o build do
frontend, mantém o stream SSE e é o único processo que consulta o TSE.

## Opção recomendada: Docker

Pré-requisitos: Docker 24+ e uma plataforma que preserve conexões HTTP longas
(SSE).

```bash
docker build -t apuracao-fight .
docker run -d \
  --name apuracao-fight \
  --restart unless-stopped \
  -p 3001:3001 \
  -e TRUST_PROXY=1 \
  -e CORS_ORIGIN=https://seu-dominio.com.br \
  -e PUBLIC_SITE_URL=https://seu-dominio.com.br \
  -v apuracao-fight-data:/app/backend/data \
  apuracao-fight
```

Publique a porta `3001` por um proxy reverso ou plataforma de containers. O
volume é recomendado para preservar o histórico entre reinícios.

Use **uma réplica** nesta versão. Várias réplicas consultariam o TSE
independentemente e manteriam históricos/streams distintos. Para escalar o
backend horizontalmente, separe o coletor em um worker único e use um banco e
pub/sub compartilhados.

## Sem Docker

Requer Node.js 22+:

```bash
npm ci
npm run build
HOST=0.0.0.0 PORT=3001 npm start
```

O frontend e a API ficam disponíveis na mesma origem, na porta configurada.

## Proxy e CDN

Coloque Cloudflare, Fastly ou outro CDN/WAF na frente do serviço e bloqueie
acesso público direto ao IP da origem. Isso é indispensável contra ataques
volumétricos; rate limit dentro do Node protege recursos da aplicação, mas não
protege a banda ou o host antes da conexão chegar ao processo.

O proxy precisa:

- preservar SSE em `/api/v1/events`, sem buffering e com timeout longo;
- encaminhar o IP real em `X-Forwarded-For`;
- usar `TRUST_PROXY=1` somente quando a origem aceitar tráfego exclusivamente
  desse proxy confiável;
- respeitar o cache de `/assets/*` e `/api/v1/election`;
- manter TLS/HTTPS na borda.

Exemplo do trecho específico para SSE no Nginx:

```nginx
location /api/v1/events {
  proxy_pass http://127.0.0.1:3001;
  proxy_http_version 1.1;
  proxy_set_header Connection "";
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  proxy_buffering off;
  proxy_read_timeout 1h;
}
```

## Limites padrão

| Recurso | Limite | Impacto esperado |
| --- | ---: | --- |
| API geral | 600 requisições/minuto/IP | Uma abertura normal usa duas requisições. |
| Histórico | 60 requisições/minuto/IP | Endpoint mais caro, não usado pela arena. |
| Tamanho do histórico | 200 snapshots/resposta | Evita respostas gigantes. |
| SSE por IP | 250 conexões simultâneas | Suporta redes compartilhadas grandes. |
| SSE por instância | 2.000 conexões simultâneas | Protege memória e descritores do processo. |
| Resposta do TSE | 5 MB | Rejeita payload inesperadamente grande. |

Os limites são configuráveis pelas variáveis em `backend/.env.example`. Uma
rede corporativa, universidade ou operadora CGNAT com mais de 250 visitantes
simultâneos pode atingir o limite de SSE por IP; nesse cenário, aumente
`MAX_SSE_CLIENTS_PER_IP` e aplique proteção por bot/fingerprint no WAF. Não
reduza agressivamente limites por IP, pois usuários legítimos podem compartilhar
o mesmo endereço.

Os contadores vivem em memória e são por instância. Para limites globais entre
réplicas, use o rate limiting distribuído do provedor ou Redis.

## Checklist

1. Ajuste `TSE_RESULTS_URL` para o arquivo oficial definitivo da eleição.
2. Configure domínio, TLS, CDN/WAF e bloqueio da origem.
3. Defina `CORS_ORIGIN` para o domínio público.
4. Defina `PUBLIC_SITE_URL` para gerar URLs canônicas e imagens sociais absolutas.
5. Ative `TRUST_PROXY=1` apenas atrás do proxy confiável.
6. Monte um volume em `/app/backend/data`.
7. Confirme que o proxy não faz buffering do SSE.
8. Monitore `/health`, uso de memória, conexões SSE e respostas 429/503.
9. Faça teste de carga no ambiente de homologação, nunca contra o TSE.
