# Frontend

Arena de apuração eleitoral construída com Vite, React, TypeScript e Tailwind CSS.

## Desenvolvimento

Com o backend em `http://127.0.0.1:3001`, execute na raiz:

```bash
npm run dev:frontend
```

O Vite encaminha `/api` e `/health` para o backend. Para apontar para outra API,
defina `VITE_API_BASE_URL`.

## Build

```bash
npm run build:frontend
```

Os spritesheets originais ficam em `source-assets/` e não entram no bundle de
produção. Execute `npm --workspace frontend run sprites` para regenerar os
quadros públicos.
