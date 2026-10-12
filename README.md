# Darktide

Dashboard financeira em React 19 e Vite, com API Express, sessões e Neon Postgres. Usuários podem registrar entradas recebidas ou previstas, confirmar previsões, filtrar por status e período e remover lançamentos.

## Neon

O diretório está vinculado ao projeto `ancient-forest-36493381`, branch `production`. A CLI salva `DATABASE_URL` e `DATABASE_URL_UNPOOLED` em `.env.local`, que é ignorado pelo Git. A aplicação usa a URL pooled; a conexão direta é usada para aplicar o schema.

```sh
neon login
neon link --project-id ancient-forest-36493381 --branch production -y
neon deploy
yarn db:seed
yarn dev
```

O schema versionado em `db/schema.sql` é aplicado automaticamente ao iniciar o servidor. `yarn db:seed` também garante o schema e cria ou atualiza o usuário inicial. As credenciais locais padrão são `root` / `administrator`; defina `DEMO_USERNAME` e `DEMO_PASSWORD` antes de executar o seed para alterá-las.

Abra `http://localhost:3000`.

O desenvolvimento inicia a API Express em `http://localhost:3000` e o frontend React/Vite com atualização instantânea em `http://localhost:5173`. Abra o endereço da porta `5173`.

Para gerar e servir a versão otimizada de produção:

```sh
yarn build
yarn start
```

O Express serve os arquivos compilados de `dist/`; os assets com hash são enviados com cache longo. A dashboard é carregada como um chunk separado, depois do login.

## Lançamentos

Cada registro tem descrição, valor, tipo e data. Para lançamentos previstos, a ação **Confirmar recebimento** muda o status para recebido e grava a data atual. O resumo soma os dois status para o período selecionado; o feed pode ser filtrado por todos, a receber ou recebidos, além de data inicial e final.

Todos os lançamentos são removidos automaticamente às 00:00 do dia 5 de cada mês, no fuso `America/Sao_Paulo`. Se o servidor estiver desligado nessa hora, a limpeza atrasada acontece ao iniciar ou na primeira consulta ao feed. A tabela de usuários e as sessões não são removidas.

Em produção, configure `SESSION_SECRET` com um valor aleatório e defina `NODE_ENV=production` atrás de HTTPS. Para sessões persistentes em múltiplas instâncias, substitua o armazenamento em memória padrão do Express.