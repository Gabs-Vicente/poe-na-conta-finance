# Nexus Finance

Aplicação web de controle financeiro pessoal, feita com React, TypeScript e Vite. Os dados são guardados no armazenamento local do navegador em que a aplicação é usada.

## Executar no computador

1. Abra esta pasta no VS Code.
2. Abra o terminal integrado (`Terminal` → `Novo Terminal`).
3. Execute `npm run dev`.
4. Abra o endereço local mostrado no terminal (normalmente `http://localhost:5173`).

O Node.js e as dependências deste projeto já estão instalados nesta pasta.

## Recursos

- Cadastro de lançamentos por PIX, débito, crédito à vista e crédito parcelado.
- Parcelas distribuídas nos meses seguintes, com arredondamento em centavos.
- Cartões configuráveis com dia de fechamento e vencimento. O sistema prevê o mês de vencimento da fatura; compras no fechamento ou depois vão para o próximo ciclo.
- Categorias, visão mensal, busca, filtros, resumo por categoria e exportação CSV.
- Participantes para dividir despesas, com atribuição por lançamento ou parcela e resumo local de valores a receber.
- Dados locais no navegador; não há conta ou servidor.

## Hospedar no GitHub Pages

O arquivo `.github/workflows/deploy.yml` publica automaticamente a aplicação no GitHub Pages a cada envio para a branch `main`. Crie um repositório GitHub para o projeto, envie os arquivos e, em `Settings` → `Pages`, selecione `GitHub Actions` como origem de publicação. Os dados ficam no navegador de cada pessoa e não são sincronizados entre dispositivos.

Para usar em produção com mais de um dispositivo ou usuário, será necessário adicionar uma API e um banco de dados.
