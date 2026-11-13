# Põe na Conta

Notas internas para desenvolver e manter este projeto pessoal. Este README descreve a implementação atual; não é uma apresentação do produto nem um guia para distribuição a usuários.

## Escopo atual

Aplicação de finanças pessoais feita para uso local no navegador. Não há autenticação, API, banco de dados ou sincronização. Cada navegador mantém seus próprios dados; publicar o frontend no GitHub Pages não compartilha nem transfere esses dados entre computadores.

Em uma instalação sem dados salvos, a aplicação inicializa com registros fictícios de demonstração definidos em `src/finance.ts`. Considere isso ao validar uma instalação ou preparar uma cópia para uso próprio.

## Ambiente de desenvolvimento

Requer Node.js 22 (como no workflow de publicação) e npm.

```sh
npm ci
npm run dev
```

O Vite informa o endereço local no terminal. Os demais comandos disponíveis são:

```sh
npm test       # testes das regras financeiras e de importação/exportação
npm run lint   # análise estática
npm run build  # verificação TypeScript e build de produção em dist/
npm run preview # servir localmente o build de dist/
```

## Dados e backup

Os lançamentos e cadastros são persistidos no `localStorage` do navegador. Preferências e perfil também são locais. Não existe conta para recuperação de dados: para transportar as informações entre navegadores, use a exportação e importação do backup JSON disponível na aplicação. A importação substitui os dados locais atuais após confirmação. CSV é uma exportação para consulta, não um formato de restauração.

O armazenamento local é validado ao carregar e os backups são validados antes da restauração. O backup JSON inclui os dados financeiros e configurações de perfil suportadas pelo formato atual.

## Organização do código

- `src/App.tsx`: composição da interface, navegação e interações.
- `src/App.css`: estilos, temas e comportamento responsivo.
- `src/finance.ts`: tipos, dados iniciais e regras/cálculos financeiros.
- `tests/finance.test.mjs`: testes das regras financeiras, backups e exportação CSV.
- `vite.config.ts`: configuração do Vite; o servidor local usa a porta 5173.
- `.github/workflows/deploy.yml`: build e publicação no GitHub Pages.

## Publicação configurada

O workflow publica o conteúdo de `dist/` no GitHub Pages quando há push para `main` ou execução manual do workflow. O repositório precisa estar configurado para usar GitHub Actions como origem do Pages. A publicação serve somente o frontend estático; não cria backend, autenticação nem sincronização.

Antes de alterar o fluxo de publicação, confira o workflow e as configurações de Pages do repositório. Os dados de cada navegador não fazem parte do artefato publicado.
