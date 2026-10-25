# Backend

API em Node.js para acompanhar a apuração presidencial publicada pelo TSE.

O processo consulta o arquivo oficial a cada cinco segundos, usa `ETag` e
`Last-Modified` para evitar transferências desnecessárias e grava apenas versões
novas em `data/snapshots.jsonl`.

## Endpoints

- `GET /health`: estado do servidor e do coletor.
- `GET /api/v1/election`: snapshot normalizado mais recente.
- `GET /api/v1/election/history?limit=100`: snapshots em ordem cronológica.
- `GET /api/v1/events`: stream SSE; emite `connected` e `election-update`.

A API aplica limites independentes à API geral, histórico e conexões SSE. Os
valores padrão e recomendações para proxy/CDN estão em `../DEPLOYMENT.md`.

## Configuração

As variáveis disponíveis estão em `.env.example`. O projeto não carrega arquivos
`.env` automaticamente para continuar sem dependências; exporte as variáveis no
shell ou use o suporte `--env-file` do Node:

```bash
node --env-file=.env src/server.js
```

## Execução

```bash
npm start
```

## Testes

```bash
npm test
```
