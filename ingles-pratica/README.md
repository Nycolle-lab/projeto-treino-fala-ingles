# Treino de Fala

Site para praticar **conversação em inglês** com ajuda de inteligência artificial, pensado para brasileiros iniciantes (nível A1 a A2).

Não precisa instalar nada nem criar conta. O site roda inteiro no navegador.

## O que o site faz

- **Conversa por voz com IA (atividade principal).** Você fala em inglês, a IA responde em inglês simples, corrige só o erro que importa e, no fim, mostra um resumo com pontos fortes, correções e frases novas para treinar.
- **Situações do dia a dia (roleplay).** Pedir um café, conhecer alguém num evento, falar com um personal trainer.
- **Avaliação de pronúncia.** Você fala uma frase e o site mostra, palavra por palavra e som por som, o que está **Correto**, **Adequado** ou **Precisa melhorar**, com dicas para quem fala português.
- **Blocos prontos com repetição espaçada.** Frases úteis que voltam para revisão no momento certo, como no Anki.
- **Shadowing e recontar.** Exercícios de repetir diálogos e contar a mesma história cada vez mais rápido.
- **Aulas novas geradas por IA.** Cole as anotações de uma aula e a IA cria frases, diálogos e situações no mesmo nível.
- **Gamificação.** XP, níveis, metas diárias e dias seguidos de prática.
- **Perfis.** Cada pessoa tem o próprio progresso no mesmo aparelho.

## Como testar (5 minutos)

1. Abra o site no **Google Chrome** (computador ou Android). Outros navegadores abrem o site, mas o reconhecimento de voz funciona melhor no Chrome.
2. Crie um perfil: digite um nome, escolha uma cor e clique em **Criar perfil e começar**.
3. Quando o navegador perguntar se o site pode usar o **microfone**, clique em **Permitir**. O áudio nunca é gravado nem enviado para lugar nenhum.
4. Para conversar com a IA, configure uma chave gratuita do Google (passo abaixo). Sem a chave, o diário falado funciona com perguntas prontas.
5. Sugestão de roteiro: **Conversar → Começar o diário**, depois **Praticar → Blocos prontos** para ver a avaliação de pronúncia.

### Chave gratuita da IA (Google Gemini)

O site usa a API gratuita do Google Gemini. Cada visitante usa a própria chave, então **nenhuma chave está guardada no código**.

1. Acesse https://aistudio.google.com/apikey e entre com uma conta Google.
2. Clique em **Create API key** e copie a chave.
3. No site, abra **Ajustes**, cole a chave no campo **Chave do Google AI Studio** e salve.

A chave fica salva só no seu navegador. O plano gratuito tem limite por minuto: se aparecer o aviso de limite, espere um minuto.

### Avaliação de pronúncia

Há dois modos, escolhidos em **Ajustes**:

- **Local (padrão):** um modelo de reconhecimento de fonemas roda dentro do próprio navegador. Na primeira vez, ele baixa cerca de 355 MB (use Wi-Fi). Depois fica guardado no navegador.
- **Rápida:** usa o reconhecimento de voz do Chrome e compara palavra por palavra. Não baixa nada.

## Onde a IA é usada

| Parte do site | Tecnologia | Onde roda |
| --- | --- | --- |
| Conversa, correções e feedback | Google Gemini (modelo "flash" escolhido automaticamente pela chave) | Servidores do Google |
| Geração de aulas a partir de anotações | Google Gemini, com resposta em JSON estruturado | Servidores do Google |
| Avaliação de pronúncia | Modelo `robg/speako-phoneme-recognizer` com Transformers.js | No navegador do usuário |
| Pronúncia de referência | Dicionário CMU, convertido para símbolos fonéticos | No navegador do usuário |
| Fala e escuta | Web Speech API (síntese e reconhecimento de voz) | No navegador |

Detalhes de como foi construído:

- Os **prompts** colocam a IA no papel de parceira de conversa paciente, limitam as respostas ao vocabulário que o aluno já estudou e pedem no máximo uma correção por vez, para não desmotivar.
- A IA sempre responde em **JSON**, para o site mostrar a resposta, a tradução e a correção em lugares separados.
- O site **descobre sozinho** qual modelo Gemini está disponível para a chave e troca para um modelo reserva se o principal atingir o limite.
- Na pronúncia, o modelo ouve os **sons** produzidos (não as palavras), e o site alinha esses sons com a pronúncia de referência para dar uma nota por som e dicas para erros típicos de brasileiros.

## Privacidade

- O áudio **nunca é salvo**. Ele fica na memória só até a avaliação terminar.
- Para a conversa, **só o texto** é enviado ao Google. No plano gratuito, o Google pode usar esse texto para melhorar os produtos dele.
- O progresso e a chave ficam salvos **apenas no navegador** de quem usa (localStorage). Não há servidor nem banco de dados.

## Tecnologias

HTML, CSS e JavaScript puros, sem frameworks e sem etapa de build. Hospedado gratuitamente no GitHub Pages.

| Arquivo | Função |
| --- | --- |
| `index.html` | Página principal |
| `app.js` | Telas e navegação |
| `ia.js` | Conversa com o Gemini |
| `pronuncia.js` | Gravação e avaliação de pronúncia |
| `pronuncias.js` | Pronúncias de referência das palavras mais usadas |
| `voz.js` | Leitura em voz alta e reconhecimento de voz |
| `dados.js` | Perfis, progresso, XP e repetição espaçada |
| `conteudo.js` | Conteúdo das aulas |
| `estilo.css` | Visual do site |

## Rodar no seu computador

Baixe os arquivos (botão verde **Code → Download ZIP**), descompacte e abra a pasta com um servidor local simples, por exemplo a extensão **Live Server** do VS Code. Abrir o `index.html` com dois cliques também funciona na maioria dos casos, mas o servidor local evita bloqueios do navegador.
