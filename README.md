# Nexus Finance

Aplicação web de controle financeiro pessoal, feita com React, TypeScript e Vite. Os dados são guardados no armazenamento local do navegador em que a aplicação é usada.

## Executar no computador

1. Abra esta pasta no VS Code.
2. Abra o terminal integrado (`Terminal` → `Novo Terminal`).
3. Execute `npm run dev`.
4. Abra o endereço local mostrado no terminal (normalmente `http://localhost:5173`).

O Node.js e as dependências deste projeto já estão instalados nesta pasta.

## Recursos

- Modelos de despesas recorrentes mensais com revisão por mês; cada cobrança só entra nos lançamentos depois de confirmada, e pode ser pulada ou pausada.
- Tema escuro alternável, com preferência guardada neste navegador.

- Cadastro de lançamentos por PIX, débito, crédito à vista e crédito parcelado.
- Parcelas distribuídas nos meses seguintes, com arredondamento em centavos.
- Cartões configuráveis com dia de fechamento e vencimento. O sistema prevê o mês de vencimento da fatura; compras no fechamento ou depois vão para o próximo ciclo.
- Categorias, visão mensal, busca, filtros, resumo por categoria e exportação CSV.
- Participantes para dividir despesas, com atribuição por lançamento ou parcela e resumo local de valores a receber.
- Backup completo em JSON para exportar e restaurar categorias, cartões, participantes e lançamentos. A importação substitui os dados atuais após confirmação.
- Dados locais no navegador; não há conta ou servidor. A validação dos dados salvos e dos backups evita carregar registros com estrutura inválida.
- Exportação CSV com proteção contra fórmulas em campos preenchidos pelo usuário.

## Testes

Execute `npm test` com Node.js 22.6 ou mais recente para verificar o cálculo de faturas e parcelas, validação/restauração de backups e proteção do CSV.

## Hospedar no GitHub Pages

O arquivo `.github/workflows/deploy.yml` publica automaticamente a aplicação no GitHub Pages a cada envio para a branch `main`. Crie um repositório GitHub para o projeto, envie os arquivos e, em `Settings` → `Pages`, selecione `GitHub Actions` como origem de publicação. Os dados ficam no navegador de cada pessoa e não são sincronizados entre dispositivos.

Para usar em produção com mais de um dispositivo ou usuário, será necessário adicionar uma API e um banco de dados.
