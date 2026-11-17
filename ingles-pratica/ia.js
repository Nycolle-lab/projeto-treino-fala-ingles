// Conversa com IA usando a API gratuita do Google Gemini.
// A chave fica salva só neste aparelho. Só texto é enviado (nunca áudio).
(function () {
  "use strict";
  const BASE = "https://generativelanguage.googleapis.com/v1beta/";

  function chave() { return Dados.config().chave; }
  function temChave() { return !!chave(); }

  // Descobre um modelo "flash" disponível na conta, para não depender de um nome fixo que pode mudar.
  async function descobrirModelo(k) {
    const r = await fetch(BASE + "models?pageSize=200", { headers: { "x-goog-api-key": k } });
    if (!r.ok) throw new Error(r.status === 400 || r.status === 403 ? "A chave não foi aceita pelo Google. Confira se copiou a chave inteira." : "Não consegui falar com o Google (" + r.status + ").");
    const j = await r.json();
    const candidatos = (j.models || []).filter(function (m) {
      const n = m.name || "";
      return (m.supportedGenerationMethods || []).indexOf("generateContent") >= 0 && /flash/.test(n) && !/(image|tts|audio|live|embedding|exp|thinking|vision|native)/.test(n);
    }).map(function (m) {
      const n = m.name.replace(/^models\//, "");
      const v = parseFloat((n.match(/gemini-(\d+(?:\.\d+)?)/) || [0, 0])[1]) || 0;
      return { nome: n, versao: v, lite: /lite/.test(n), preview: /preview/.test(n), latest: /latest/.test(n) };
    });
    if (!candidatos.length) throw new Error("Nenhum modelo de texto disponível para esta chave.");
    candidatos.sort(function (a, b) {
      if (a.preview !== b.preview) return a.preview ? 1 : -1;
      if (a.versao !== b.versao) return b.versao - a.versao;
      if (a.lite !== b.lite) return a.lite ? 1 : -1;
      return a.nome.length - b.nome.length;
    });
    const principal = candidatos[0].nome;
    const reserva = (candidatos.find(function (c) { return c.lite && !c.preview; }) || candidatos[1] || candidatos[0]).nome;
    return { principal: principal, reserva: reserva };
  }

  async function configurar(k) {
    const m = await descobrirModelo(k);
    Dados.salvarConfig({ chave: k, modelo: m.principal, modeloReserva: m.reserva });
    return m;
  }

  function extrairJSON(texto) {
    const limpo = String(texto || "").replace(/^```(?:json)?/i, "").replace(/```\s*$/, "").trim();
    try { return JSON.parse(limpo); } catch (e) {
      const a = limpo.indexOf("{"), b = limpo.lastIndexOf("}");
      if (a >= 0 && b > a) return JSON.parse(limpo.slice(a, b + 1));
      throw new Error("A IA respondeu num formato inesperado. Tente de novo.");
    }
  }

  async function gerar(sistema, mensagens, opcoes) {
    opcoes = opcoes || {};
    const cfg = Dados.config();
    if (!cfg.chave) throw new Error("Configure a chave da IA em Ajustes.");
    const corpo = {
      systemInstruction: { parts: [{ text: sistema }] },
      contents: mensagens.map(function (m) { return { role: m.papel === "ia" ? "model" : "user", parts: [{ text: m.texto }] }; }),
      generationConfig: { temperature: opcoes.temperatura == null ? 0.7 : opcoes.temperatura, responseMimeType: "application/json", maxOutputTokens: opcoes.max || 1024 }
    };
    const modelos = [cfg.modelo, cfg.modeloReserva].filter(Boolean);
    if (!modelos.length) { const m = await configurar(cfg.chave); modelos.push(m.principal, m.reserva); }
    let ultimoErro = null;
    for (let i = 0; i < modelos.length; i++) {
      try {
        const r = await fetch(BASE + "models/" + modelos[i] + ":generateContent", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": cfg.chave },
          body: JSON.stringify(corpo)
        });
        if (r.status === 429) { ultimoErro = new Error("Você usou o limite gratuito da IA por agora. Espere um minuto e tente de novo."); continue; }
        if (r.status === 404) { const m = await configurar(cfg.chave); modelos.push(m.principal); ultimoErro = new Error("Modelo atualizado, tente de novo."); continue; }
        if (!r.ok) { ultimoErro = new Error("A IA não respondeu (" + r.status + ")."); continue; }
        const j = await r.json();
        const partes = (((j.candidates || [])[0] || {}).content || {}).parts || [];
        const texto = partes.filter(function (p) { return !p.thought; }).map(function (p) { return p.text || ""; }).join("");
        return extrairJSON(texto);
      } catch (e) { ultimoErro = e; }
    }
    throw ultimoErro || new Error("A IA não respondeu.");
  }

  function listaBlocos(ids) {
    return (ids || []).map(function (id) { const b = Dados.blocoPorId(id); return b ? "- " + b.en : ""; }).filter(Boolean).join("\n");
  }
  function blocosRecentes(n) {
    const todos = Dados.todosBlocos();
    return todos.slice(-n).map(function (b) { return "- " + b.en; }).join("\n");
  }

  const REGRAS = [
    "You are a warm, patient English conversation partner for a Brazilian beginner (CEFR A1 to A2) who speaks Portuguese.",
    "The learner speaks through speech recognition, so ignore missing punctuation, capitalization and small transcription glitches.",
    "Rules for every reply:",
    "- Use very simple English: short sentences, common words, mostly present simple. Avoid past and future tenses unless the learner uses them first.",
    "- Build your sentences mainly with the structures the learner already studied in class (listed below), so they can understand and copy you.",
    "- Reply with at most 2 short sentences, then ask exactly 1 simple question to keep the learner talking.",
    "- Naturally reuse the target phrases when they fit.",
    "- If the learner writes in Portuguese or mixes languages, show them how to say it in English in reply_en (\"You can say: ...\") and continue.",
    "- Corrections: only if there is a real mistake that matters (wrong word, wrong tense, missing verb). At most 1 correction per turn. Do not correct style or tiny things. If the message is fine, correction is null.",
    "- Be encouraging, never sarcastic. No emojis.",
    "Always answer with JSON only, in this exact shape:",
    "{\"reply_en\": \"...\", \"reply_pt\": \"tradução natural em português do Brasil\", \"correction\": null or {\"said\": \"what the learner said (short)\", \"better\": \"corrected version\", \"why_pt\": \"explicação curta em português\"}}"
  ].join("\n");

  function estudado() {
    const l = Dados.aulas().filter(function (a) { return a.estruturas; }).map(function (a) { return "- " + a.titulo + ": " + a.estruturas; });
    return l.length ? "\n\nWhat the learner studied in class so far:\n" + l.join("\n") : "";
  }
  function sistemaConversa(modo, cena) {
    if (modo === "diario") {
      return REGRAS + estudado() + "\n\nActivity: spoken diary. Talk about the learner's habits and routine: what they eat and drink in the morning, afternoon and at night, where they go, on which days and how often, what they like and prefer. One topic at a time, like a friendly friend. Start with a short greeting and one simple question.\n\nTarget phrases the learner is studying:\n" + blocosRecentes(20);
    }
    return REGRAS + estudado() + "\n\nActivity: role-play. You are " + cena.papel + ". Stay in character. The learner's goal (in Portuguese): " + cena.objetivo + "\nStart the scene with a short, natural opening line.\n\nTarget phrases for this scene:\n" + listaBlocos(cena.blocosAlvo);
  }

  async function responder(modo, cena, historico) {
    const msgs = historico.length ? historico : [{ papel: "eu", texto: "(Start the conversation now.)" }];
    if (msgs[0].papel === "ia") msgs.unshift({ papel: "eu", texto: "(Start the conversation now.)" });
    return gerar(sistemaConversa(modo, cena), msgs);
  }

  async function feedback(modo, cena, historico) {
    const transcricao = historico.map(function (m) { return (m.papel === "ia" ? "Partner: " : "Learner: ") + m.texto; }).join("\n");
    const sistema = [
      "You are an English teacher giving end-of-conversation feedback to a Brazilian beginner (A1 to A2). Write explanations in Brazilian Portuguese, simple and encouraging.",
      "Ignore punctuation and speech recognition glitches. Focus on the 3 most useful improvements for speaking, preferring mistakes in the structures the learner already studied." + estudado(),
      "Answer with JSON only, in this shape:",
      "{\"resumo_pt\": \"2 frases sobre como foi\", \"pontos_fortes\": [\"...\", \"...\"], \"correcoes\": [{\"said\": \"...\", \"better\": \"...\", \"why_pt\": \"...\"}], \"novos_blocos\": [{\"en\": \"useful ready-made phrase for next time\", \"pt\": \"tradução\"}], \"fluencia\": 1-5}",
      "Give at most 3 correcoes and 3 novos_blocos. novos_blocos must be short, reusable chunks (3 to 8 words) the learner needed in this conversation."
    ].join("\n");
    return gerar(sistema, [{ papel: "eu", texto: "Conversation (" + (modo === "diario" ? "spoken diary" : "role-play: " + cena.titulo) + "):\n" + transcricao }], { temperatura: 0.3 });
  }

  async function comoDizer(ideiaPt, historico) {
    const contexto = historico.slice(-4).map(function (m) { return (m.papel === "ia" ? "Partner: " : "Learner: ") + m.texto; }).join("\n");
    const sistema = "You help a Brazilian A1 English learner say something in simple English during a conversation. Answer JSON only: {\"en\": \"simple English sentence\", \"dica_pt\": \"dica curta em português, opcional\"}";
    return gerar(sistema, [{ papel: "eu", texto: "Conversation so far:\n" + contexto + "\n\nWhat I want to say in Portuguese: " + ideiaPt }], { temperatura: 0.3, max: 300 });
  }

  async function gerarAula(material, id) {
    const sistema = [
      "You turn a Brazilian beginner's English class notes into practice material. The learner is A1 to A2. Keep the same level and topics as the notes. You may add a few closely related, very common phrases.",
      "Answer with JSON only, in this exact shape (Portuguese fields in Brazilian Portuguese):",
      "{\"titulo\": \"título curto em português\", \"resumo\": \"1 frase em português\",",
      "\"blocos\": [{\"en\": \"ready-made phrase\", \"pt\": \"tradução\"}],",
      "\"dialogos\": [{\"titulo\": \"...\", \"linhas\": [{\"quem\": \"A\" or \"B\", \"en\": \"...\", \"pt\": \"...\"}]}],",
      "\"cenas\": [{\"titulo\": \"título em português\", \"papel\": \"who the AI plays, in English\", \"objetivo\": \"objetivo do aluno em português\", \"blocosAlvo\": [indexes of blocos, starting at 0]}],",
      "\"diario\": [\"simple question in English\"], \"recontar\": [\"tema em português\"]}",
      "Give 8 to 14 blocos, 2 dialogos with 5 to 7 lines each, 2 cenas, 3 diario questions and 1 or 2 recontar topics."
    ].join("\n");
    const j = await gerar(sistema, [{ papel: "eu", texto: "Class notes:\n" + material }], { temperatura: 0.4, max: 4096 });
    const aula = { id: id, titulo: j.titulo || "Aula nova", resumo: j.resumo || "", criada: Dados.hoje() };
    aula.blocos = (j.blocos || []).map(function (b, i) { return { id: id + "b" + (i + 1), en: b.en, pt: b.pt || "" }; });
    aula.dialogos = (j.dialogos || []).map(function (d, i) { return { id: id + "d" + (i + 1), titulo: d.titulo, linhas: (d.linhas || []).map(function (l) { return { quem: l.quem === "B" ? "B" : "A", en: l.en, pt: l.pt || "" }; }) }; });
    aula.cenas = (j.cenas || []).map(function (c, i) { return { id: id + "c" + (i + 1), titulo: c.titulo, papel: c.papel, objetivo: c.objetivo, blocosAlvo: (c.blocosAlvo || []).map(function (k) { return aula.blocos[k] ? aula.blocos[k].id : null; }).filter(Boolean) }; });
    aula.diario = j.diario || [];
    aula.recontar = j.recontar || [];
    return aula;
  }

  window.IA = { temChave: temChave, configurar: configurar, responder: responder, feedback: feedback, comoDizer: comoDizer, gerarAula: gerarAula };
})();
