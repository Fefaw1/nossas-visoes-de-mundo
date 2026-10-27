# Nossas visões de mundo ✳

Um mini site de debates privados para duas pessoas. Feito com **HTML + CSS + JavaScript** (sem React, sem Node.js e sem servidor próprio), **Supabase** (PostgreSQL, login e fotos) e **GitHub Pages** (hospedagem).

## O que já funciona

- Tela de entrada: uma conta individual por pessoa, via e-mail e senha.
- Sala compartilhada com **convite secreto** e limite de **duas pessoas**.
- Painel com blocos clicáveis: debates abertos, encerrados e pontos em comum.
- Debates individuais com título, categoria e descrição.
- Mensagens em cores distintas, identificadas por nome, inicial ou foto.
- Botão de resposta, mostrando qual mensagem está sendo respondida.
- Encerrar e reabrir conversas sem apagá-las.
- Proposta de ponto em comum **que só vira consenso quando a outra pessoa confirma**.
- Página de pontos em comum já confirmados.
- Layout que se adapta a computador e celular.
- Botão **Atualizar** para buscar novas mensagens. Não é chat em tempo real.
- **Demonstração** com conteúdo fictício (não é salvo).

## 1. O que instalar / quais contas criar

1. Baixe o **Visual Studio Code**: https://code.visualstudio.com/
2. No VS Code, abra **Extensões** (ícone de quadrados à esquerda), pesquise **Live Server** de *Ritwick Dey*, clique em **Install**. Ele serve para abrir o site em seu computador com um endereço `http://127.0.0.1:5500/...`.
3. Crie uma conta no **Supabase**: https://supabase.com/ (para banco de dados e login).
4. Crie uma conta no **GitHub**: https://github.com/ (para publicar gratuitamente o HTML/CSS/JS).

**Não precisa instalar:** MySQL, Workbench, Python, Node.js, npm, Docker, XAMPP ou servidor Express. O projeto usa PostgreSQL, provido online pelo Supabase. A biblioteca JavaScript do Supabase já é carregada via CDN, em `index.html`.

## 2. Abrir o projeto no VS Code

1. Extraia o arquivo `nossas-visoes-de-mundo.zip` para uma pasta, por exemplo `Documentos/nossas-visoes-de-mundo`.
2. No VS Code, clique em **File > Open Folder / Arquivo > Abrir Pasta** e selecione essa pasta.
3. Você verá:

```
nossas-visoes-de-mundo/
├── index.html         ← estrutura visual da interface
├── style.css          ← cores, fontes, layout e versão mobile
├── app.js             ← lógica, debates, mensagens, login e fotos
├── config.js          ← duas informações públicas do Supabase a preencher
├── schema.sql         ← tabelas, funções de sala, regras de acesso, fotos
├── README.md          ← este guia
└── .nojekyll          ← compatibilidade com GitHub Pages
```

4. Clique com o botão direito no arquivo `index.html` e escolha **Open with Live Server**. Por enquanto, com `config.js` não configurado, escolha **Quero conhecer uma demonstração primeiro**. É uma versão de exemplo, clicável e não persistente.

## 3. Criar o banco de dados Supabase

1. Entre em https://supabase.com/dashboard e clique em **New project**.
2. Escolha uma organização, um nome, por exemplo `nossas-visoes`, uma senha **forte** para o banco (guarde-a, mas **não** a coloque em `config.js`) e a região disponível mais próxima. Aguarde o projeto ficar pronto.
3. No menu esquerdo, abra **SQL Editor > New query**.
4. Volte ao VS Code, abra `schema.sql`, copie **todo o conteúdo** (`Ctrl + A`, `Ctrl + C`).
5. Cole no SQL Editor (`Ctrl + V`) e clique em **Run**.
6. Confirme que a execução terminou sem erro. O arquivo cria: `rooms`, `members`, `debates`, `messages`, `common_points`, as funções da sala, as políticas de segurança RLS e um bucket **privado** de fotos.

⚠️ Execute o SQL inteiro **uma vez só**, em um projeto novo. Se der erro, não fique repetindo a instalação: primeiro veja a mensagem de erro.

### Por que esse banco de dados é privado?

O site que hospeda a interface é público, mas os dados não são públicos. As tabelas têm políticas de **Row Level Security**, e só contas participantes da mesma sala podem ler seus debates. O código do convite é longo e deve ser compartilhado apenas entre vocês. As fotos ficam em um bucket privado e são carregadas por links temporários.

## 4. Conectar o site ao Supabase

1. No painel do Supabase, abra o botão **Connect** do projeto ou vá a **Project Settings / Settings > API Keys** (nomes podem variar).
2. Copie a **Project URL**, com formato `https://abcxyz.supabase.co`.
3. Copie a **Publishable key**, que começa com `sb_publishable_...`, ou a chave legada `anon` pública, se seu painel a mostrar.
4. Abra `config.js` no VS Code e troque os textos `COLE_...`:

```js
window.APP_CONFIG = {
  SUPABASE_URL: "https://SEU-PROJETO.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "sb_publishable_SUA_CHAVE_PUBLICA"
};
```

5. Salve (`Ctrl + S`). Recarregue a página aberta pelo Live Server.

**JAMAIS coloque** em arquivos do site a senha do banco, `service_role`, `sb_secret_...`, tokens de acesso de usuário, senhas pessoais ou o código secreto de convite. A chave **publishable/anon** foi projetada para uso no navegador, desde que as políticas RLS estejam corretamente habilitadas.

## 5. Configurar e-mail de login

1. No painel Supabase, abra **Authentication > Providers / Sign In / Email** e certifique-se de que autenticação por **Email** está ativada.
2. Recomendo manter **Confirm email** ativado (cada um confirma sua conta pelo e-mail).
3. Vá a **Authentication > URL Configuration**.
4. Enquanto testa localmente, adicione à lista **Redirect URLs**: `http://127.0.0.1:5500/**` e, se necessário, `http://localhost:5500/**`.
5. Quando publicar, adicione a URL exata do GitHub Pages na lista e coloque-a também como **Site URL** (por exemplo `https://SEU-USUARIO.github.io/nossas-visoes-de-mundo/`).
6. Caso o Supabase envie um e-mail de confirmação, clique no link e retorne ao site para entrar.

**Depois de vocês duas pessoas terem criado e confirmado suas contas**, você pode desativar novos cadastros em **Authentication > Providers > Email / Allow new users to sign up** ou opção equivalente no painel. Os nomes mudam entre versões do Supabase. Isso impede novos registros, mas não elimina as contas existentes.

## 6. Criar a sala e convidar a outra pessoa

1. Abra o site local (via Live Server) e clique **Criar conta**. Cadastre **o seu e-mail** e **uma senha**.
2. Confirme o e-mail, se solicitado, e volte em **Entrar**.
3. Escolha um nome, por exemplo `Fer`, e a opção **Criar nossa sala**.
4. Já dentro do painel, clique na sua bolinha de perfil (à esquerda ou no topo, se estiver no celular) e escolha **Copiar convite para a outra pessoa**.
5. Envie esse código **em particular** ao seu namorado. Não o publique no GitHub ou em redes sociais.
6. Ele entra na **mesma URL**, cria **a própria conta**, confirma o e-mail, escolhe um nome e depois **Entrar com convite**. Ele cola o código.
7. Pronto: os dois verão os mesmos debates, mensagens e propostas. Clique em **Atualizar** para carregar o que o outro escreveu.

### Fotos e cores

Abra **Meu perfil**, altere o nome e, se quiser, escolha foto JPG/PNG/WebP de até **3 MB**. Na página dos debates, um dos participantes aparece em lilás e o outro em pêssego; com foto, o avatar mostra a imagem. São fotos opcionais.

### Pontos em comum

Um propõe algo em **Pontos em comum** dentro de um debate; a outra pessoa clica em **Confirmar ponto em comum**. Só então ele entra na contagem da página inicial e na página de consensos. Qualquer um pode encerrar ou reabrir um debate, mas as mensagens anteriores ficam registradas.

## 7. Publicar o site no GitHub Pages

> O GitHub Pages hospeda os arquivos estáticos; o Supabase continua hospedando o banco de dados. Isso significa que o site funciona mesmo com os dois acessando de computadores/celulares diferentes.

1. Faça login em https://github.com e clique no botão **New repository**.
2. Use o nome do repositório **`nossas-visoes-de-mundo`** (outro nome também funciona, mas muda a URL).
3. Na conta **GitHub Free**, selecione **Public** para poder usar o Pages sem pagar. O código do site ficará visível publicamente; **o conteúdo dos debates não é incluído nele**.
4. Crie o repositório. Entre nele e escolha **Add file > Upload files**.
5. Arraste para a página os arquivos `index.html`, `style.css`, `app.js`, `config.js`, `schema.sql`, `README.md`, `.nojekyll` (arquivos da pasta, **não** a pasta inteira). Não envie prints privados ou documentos pessoais.
6. Clique em **Commit changes**.
7. Vá a **Settings > Pages**.
8. Na seção **Build and deployment**, escolha **Source: Deploy from a branch**, depois **Branch: main** e **Folder: /(root)**. Clique **Save**.
9. Após a publicação, a URL terá formato:

   `https://SEU-USUARIO.github.io/nossas-visoes-de-mundo/`

10. Abra a URL e volte ao Supabase: **Authentication > URL Configuration**. Ajuste **Site URL** e adicione essa URL em **Redirect URLs** (consulte a etapa 5).
11. Teste **Criar conta**, **Entrar**, **Criar nossa sala**, **Criar debate** e **Respostas** em duas contas diferentes.

**Importante:** o GitHub Pages pode levar alguns minutos para refletir o primeiro envio ou uma alteração. Qualquer mudança feita só no seu VS Code **não é publicada automaticamente**: será preciso enviar o arquivo modificado de novo para o repositório, ou usar Git.

### Como atualizar um arquivo pelo próprio GitHub

Abra o repositório, clique no arquivo (por exemplo `style.css`), clique no lápis **Edit this file**, cole suas alterações e **Commit changes**. Ou use **Add file > Upload files** para substituir arquivos com o mesmo nome, confirmando o commit.

## 8. Personalizar o visual

Abra `style.css` e altere as variáveis no início:

```css
:root {
  --plum: #74628a;       /* cor lilás dos botões */
  --peach: #d38d70;      /* pêssego */
  --sage: #789886;       /* verde */
  --cream: #f9f6f0;      /* fundo */
}
```

Textos, títulos, menu e campos ficam em `index.html`. A lógica fica em `app.js`.

## 9. Perguntas frequentes

**Preciso usar MySQL?** Não. O Supabase oferece PostgreSQL, um banco relacional com SQL, e já fornece login, API e armazenamento de fotos. Assim você não precisa contratar um servidor Node.js ou configurar uma conexão direta insegura do navegador ao MySQL.

**Vai custar algo?** O GitHub Pages é gratuito para repositórios públicos de contas GitHub Free. O Supabase tem um plano Free com limites de uso e pausa de projetos após um período de inatividade (a política pode mudar). Para uso de duas pessoas, normalmente cabe no limite. Confira preços antes de criar o projeto: https://supabase.com/pricing.

**O site é privado?** A interface (HTML/CSS/JS) do GitHub Pages e o repositório público são acessíveis a qualquer pessoa; **as conversas armazenadas no banco** só são acessíveis a contas que fazem parte da sala, desde que as políticas SQL não tenham sido alteradas. Nunca inclua conteúdo pessoal, senhas ou convite dentro dos arquivos publicados. Uma sessão aberta em um aparelho compartilhado também exige cuidado.

**As mensagens aparecem instantaneamente?** Não. A pessoa que receber mensagens precisa tocar em **Atualizar** ou recarregar a página. A simplicidade é intencional nesta primeira versão.

**Posso excluir mensagens?** Esta versão não oferece exclusão nem edição de mensagens antigas, para preservar o contexto. É possível encerrar e reabrir um debate. Para apagar dados de vez seria necessário criar uma função de exclusão e regras apropriadas ou administrar o banco como proprietária do projeto.

**E se o site disser que não consegue carregar?** Confira: `schema.sql` executado sem erros; URL/chave pública certas em `config.js`; e-mail confirmado; Internet; seu site tem `index.html`, `style.css`, `app.js` e `config.js` na **raiz**; projeto Supabase não está pausado.

**E se fotos não aparecerem?** Verifique se o script SQL criou o bucket privado `couple-avatars`, se o arquivo tem até 3 MB e se você está autenticada(o). Os URLs das fotos duram 1 hora e são renovados ao clicar **Atualizar**.

**O que acontece se alguém tiver o código do convite?** A sala só aceita duas pessoas; até a segunda entrada, trate o código como segredo. Depois de ambas entrarem, ele não permite um terceiro participante.

**Existe backup automático?** Não conte com backups gerenciados no plano gratuito. Se o histórico for importante, faça exportações regulares do banco no painel Supabase.

---

### Links de documentação
- Supabase JavaScript / CDN: https://supabase.com/docs/reference/javascript/installing
- Segurança por linha: https://supabase.com/docs/guides/database/postgres/row-level-security
- Confirmação de e-mail e URLs: https://supabase.com/docs/guides/auth/redirect-urls
- GitHub Pages: https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site

Feito para ser um espaço de escuta e construção de pontes — não um placar eleitoral. ♡
