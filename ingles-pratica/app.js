(function () {
  "use strict";

  // ---------- utilitários de tela ----------
  function h(tag, attrs) {
    const el = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      const v = attrs[k];
      if (v == null || v === false) return;
      if (k === "class") el.className = v;
      else if (k === "html") el.innerHTML = v;
      else if (k === "text") el.textContent = v;
      else if (k.slice(0, 2) === "on") el.addEventListener(k.slice(2), v);
      else if (k === "style") el.setAttribute("style", v);
      else el.setAttribute(k, v === true ? "" : v);
    });
    for (let i = 2; i < arguments.length; i++) anexar(el, arguments[i]);
    return el;
  }
  function anexar(el, c) {
    if (c == null || c === false) return;
    if (Array.isArray(c)) { c.forEach(function (x) { anexar(el, x); }); return; }
    el.appendChild(typeof c === "string" || typeof c === "number" ? document.createTextNode(String(c)) : c);
  }
  const $app = document.getElementById("app");
  const $topo = document.getElementById("topo");
  const $abas = document.getElementById("abas");

  const ICONES = {
    hoje: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-5h4v5"/></svg>',
    conversar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5h16v11H9l-5 4z"/><path d="M8 9h8M8 12h5"/></svg>',
    praticar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="0.5"/></svg>',
    progresso: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>',
    aulas: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 21V5"/><path d="M9 8h6"/></svg>',
    blocos: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="6" width="13" height="13" rx="2"/><path d="M8 3h11a2 2 0 0 1 2 2v11"/></svg>',
    shadowing: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10v4M7 7v10M11 4v16M15 8v8M19 11v2"/></svg>',
    recontar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l3 2M9 2h6"/></svg>'
  };
  function icone(nome) { const s = h("span", { "aria-hidden": "true" }); s.innerHTML = ICONES[nome]; return s.firstChild; }

  const CORES_PERFIL = ["#5e2257", "#2a64a8", "#187a62", "#b86a00", "#b3261e", "#6b4bb8"];

  // ---------- toasts de pontos ----------
  let filaToast = [];
  let mostrandoToast = false;
  function toast(texto, ouro) {
    filaToast.push({ texto: texto, ouro: ouro });
    if (!mostrandoToast) proximoToast();
  }
  function proximoToast() {
    const t = filaToast.shift();
    if (!t) { mostrandoToast = false; return; }
    mostrandoToast = true;
    const el = h("div", { class: "toast" + (t.ouro ? " ouro" : ""), role: "status", text: t.texto });
    document.body.appendChild(el);
    setTimeout(function () { el.remove(); proximoToast(); }, t.ouro ? 2600 : 1400);
  }
  Dados.aoGanhar(function (eventos) {
    eventos.forEach(function (e) {
      if (e.tipo === "xp") toast("+" + e.valor + " XP");
      if (e.tipo === "meta") toast("Meta do dia batida! +" + e.valor + " XP de bônus", true);
      if (e.tipo === "nivel") toast("Nível " + e.valor + ": " + e.nome, true);
      if (e.tipo === "conquista") toast("Conquista: " + e.conquista.titulo, true);
    });
    desenharTopo();
  });

  // ---------- navegação ----------
  const ABAS = [
    { id: "hoje", nome: "Hoje" }, { id: "conversar", nome: "Conversar" }, { id: "praticar", nome: "Praticar" },
    { id: "progresso", nome: "Progresso" }, { id: "aulas", nome: "Aulas" }
  ];
  let limpeza = null; // função que encerra o microfone/voz da tela anterior
  function ir(rota) { if (location.hash === "#" + rota) render(); else location.hash = rota; }
  window.addEventListener("hashchange", render);

  function desenharAbas(atual) {
    $abas.innerHTML = "";
    if (!Dados.perfil()) { $abas.hidden = true; return; }
    $abas.hidden = false;
    const inn = h("div", { class: "abas-in" });
    ABAS.forEach(function (a) {
      inn.appendChild(h("button", { class: "aba", type: "button", "aria-current": atual === a.id ? "page" : null, onclick: function () { ir(a.id); } }, icone(a.id), a.nome));
    });
    $abas.appendChild(inn);
  }
  function desenharTopo() {
    $topo.innerHTML = "";
    const p = Dados.perfil();
    const marca = h("div", { class: "marca" }, h("div", { class: "logo", "aria-hidden": "true", text: "T" }), h("h1", { text: "Treino de Fala" }));
    if (!p) { $topo.appendChild(marca); return; }
    const n = Dados.nivelDe(p.xp);
    $topo.appendChild(marca);
    $topo.appendChild(h("button", { class: "perfil-chip", type: "button", onclick: function () { ir("ajustes"); }, "aria-label": "Perfil e ajustes" },
      h("span", { class: "avatar", style: "background:" + p.cor, text: p.nome.charAt(0).toUpperCase() }),
      h("span", { class: "small num", text: "Nv " + n.nivel + " · " + p.xp + " XP" })));
  }

  function render() {
    if (limpeza) { try { limpeza(); } catch (e) { /* nada */ } limpeza = null; }
    Voz.calar();
    const rota = (location.hash || "#hoje").slice(1).split("/");
    $app.innerHTML = "";
    desenharTopo();
    if (!Dados.perfil()) { desenharAbas(null); telaPerfis(); return; }
    const telas = { hoje: telaHoje, conversar: telaConversar, praticar: telaPraticar, progresso: telaProgresso, aulas: telaAulas, ajustes: telaAjustes };
    const fn = telas[rota[0]] || telaHoje;
    desenharAbas(telas[rota[0]] ? rota[0] : "hoje");
    fn(rota.slice(1));
    window.scrollTo(0, 0);
  }

  // =====================================================================
  // PERFIS
  // =====================================================================
  function telaPerfis() {
    const lista = Dados.perfis();
    const box = h("div", { class: "stack-lg" });
    box.appendChild(h("div", { class: "stack" }, h("h2", { text: lista.length ? "Quem vai praticar agora?" : "Crie o seu perfil" }),
      h("p", { class: "muted", text: "Cada pessoa tem o próprio perfil, com progresso, pontos e revisões separados. Os exercícios são os mesmos para todos." })));
    if (lista.length) {
      box.appendChild(h("div", { class: "perfis" }, lista.map(function (pf) {
        return h("button", { class: "perfil", type: "button", onclick: function () { Dados.entrar(pf.id); ir("hoje"); } },
          h("span", { class: "avatar grande", style: "background:" + pf.cor, text: pf.nome.charAt(0).toUpperCase() }), h("b", { text: pf.nome }));
      })));
    }
    box.appendChild(formPerfil(null));
    $app.appendChild(box);
  }
  function formPerfil(existente) {
    let cor = existente ? existente.cor : CORES_PERFIL[Dados.perfis().length % CORES_PERFIL.length];
    const nome = h("input", { type: "text", id: "nome-perfil", maxlength: "24", placeholder: "Seu nome", value: existente ? existente.nome : "" });
    const cores = h("div", { class: "cores", role: "group", "aria-label": "Cor do perfil" });
    function desenharCores() {
      cores.innerHTML = "";
      CORES_PERFIL.forEach(function (c) {
        cores.appendChild(h("button", { class: "cor", type: "button", style: "background:" + c, "aria-pressed": String(c === cor), "aria-label": "Cor", onclick: function () { cor = c; desenharCores(); } }));
      });
    }
    desenharCores();
    const erro = h("p", { class: "small", style: "color:var(--bad)" });
    return h("div", { class: "card" },
      h("h3", { text: existente ? "Editar perfil" : "Novo perfil" }),
      h("label", { class: "campo", for: "nome-perfil" }, "Nome", nome),
      h("div", { class: "campo" }, "Cor", cores),
      erro,
      h("button", { class: "btn cheio", type: "button", onclick: function () {
        const n = nome.value.trim();
        if (!n) { erro.textContent = "Escreva um nome."; return; }
        if (existente) { Dados.renomearPerfil(existente.id, n, cor); toast("Perfil atualizado"); render(); }
        else { Dados.criarPerfil(n, cor); Dados.pedirPersistencia(); ir("hoje"); }
      } }, existente ? "Salvar" : "Criar perfil e começar"));
  }

  // =====================================================================
  // HOJE
  // =====================================================================
  function telaHoje() {
    const p = Dados.perfil();
    const d = Dados.dia(p);
    const n = Dados.nivelDe(p.xp);
    const seq = Dados.sequencia(p);
    const bonus = Math.round(Dados.bonusSequencia(p) * 100);
    const fila = Dados.filaDoDia(5);

    const hero = h("div", { class: "card hero" },
      h("div", { class: "between" },
        h("div", {}, h("div", { class: "small muted", text: "Olá, " + p.nome }), h("h2", { text: "Nível " + n.nivel + ": " + Dados.nomeNivel(n.nivel) })),
        h("div", { class: "small", style: "display:grid;justify-items:end;text-align:right;gap:0;margin-left:auto" }, h("b", { class: "num", style: "font-size:1.1rem", text: seq + (seq === 1 ? " dia seguido" : " dias seguidos") }), h("span", { class: "muted", text: seq ? "bônus de +" + bonus + "% no XP" : "comece hoje" }))),
      h("div", { class: "stack", style: "gap:6px" },
        h("div", { class: "between small" }, h("span", { text: "Meta de hoje" }), h("span", { class: "num", text: Math.min(d.xp, p.metaDiaria) + " / " + p.metaDiaria + " XP" })),
        h("div", { class: "barra", role: "progressbar", "aria-valuemin": "0", "aria-valuemax": String(p.metaDiaria), "aria-valuenow": String(d.xp) }, h("span", { style: "width:" + Math.min(100, Math.round(100 * d.xp / p.metaDiaria)) + "%" }))),
      h("div", { class: "small muted num", text: "Faltam " + (n.proximo - n.atual) + " XP para o nível " + (n.nivel + 1) }));

    const m = d.missao;
    const passos = [
      { id: "conversa", cls: "conversa", ic: "conversar", titulo: "Diário falado com a IA", desc: "5 minutos contando sobre o seu dia", feito: m.conversa, acao: function () { ir("conversar/diario"); } },
      { id: "blocos", cls: "blocos", ic: "blocos", titulo: "Blocos prontos", desc: fila.length ? fila.length + " frases para revisar falando" : "Nada pendente, só frases novas", feito: m.blocos, acao: function () { ir("praticar/blocos"); } },
      { id: "shadowing", cls: "shadowing", ic: "shadowing", titulo: "Shadowing", desc: "Repita um diálogo curto junto com o áudio", feito: m.shadowing, acao: function () { ir("praticar/shadowing"); } },
      { id: "recontar", cls: "recontar", ic: "recontar", titulo: "Recontar (bônus)", desc: "Conte a mesma história 3 vezes, cada vez mais rápido", feito: m.recontar, acao: function () { ir("praticar/recontar"); } }
    ];
    const principais = passos.slice(0, 3).filter(function (x) { return x.feito; }).length;
    const missao = h("div", { class: "card" },
      h("div", { class: "between" }, h("h3", { text: "Missão do dia" }), h("span", { class: "pill" + (principais === 3 ? " ok" : ""), text: principais + " de 3" })),
      h("div", { class: "missao" }, passos.map(function (x) {
        return h("button", { class: "passo " + x.cls + (x.feito ? " feito" : ""), type: "button", onclick: x.acao },
          h("span", { class: "ic" }, icone(x.ic)),
          h("span", {}, h("b", { text: x.titulo }), h("div", { class: "small muted", text: x.desc })),
          h("span", { class: "estado", text: x.feito ? "Feito" : "Começar" }));
      })),
      h("p", { class: "small muted", text: m.bau ? "Missão completa. Você ganhou o bônus de 50 XP hoje." : "Complete os 3 primeiros passos para ganhar 50 XP de bônus." }));

    if (!Voz.disponivel) $app.appendChild(h("div", { class: "aviso", text: "Para falar e ser avaliado, abra este site no Google Chrome (Android ou computador). Neste navegador você ainda pode ouvir as frases e conversar digitando." }));
    $app.appendChild(hero);
    if (!IA.temChave()) $app.appendChild(h("div", { class: "aviso info" }, "A conversa com IA precisa de uma chave gratuita do Google. ", h("a", { href: "#ajustes", text: "Configurar em 2 minutos" }), ". Sem ela, o diário falado funciona com perguntas prontas."));
    if (Pronuncia.modo() === "local" && !Pronuncia.modeloJaBaixado()) $app.appendChild(h("div", { class: "aviso info" }, "A avaliação de pronúncia usa um modelo de 355 MB que roda no seu navegador. ", h("a", { href: "#ajustes", text: "Baixe uma vez em Ajustes" }), ", de preferência no Wi-Fi. Ou ele baixa sozinho no primeiro exercício."));
    $app.appendChild(missao);
  }
  function verificarBau() {
    const p = Dados.perfil();
    const d = Dados.dia(p);
    if (!d.missao.bau && d.missao.conversa && d.missao.blocos && d.missao.shadowing) {
      d.missao.bau = true; Dados.salvar();
      toast("Missão do dia completa!", true);
      Dados.ganharXP(50, "missão completa");
    }
  }
  function completarPasso(chave) {
    const d = Dados.dia();
    if (!d.missao[chave]) { Dados.marcarMissao(chave); verificarBau(); }
  }

  // =====================================================================
  // CONVERSAR
  // =====================================================================
  function telaConversar(args) {
    if (args[0] === "diario") return sessaoConversa("diario", null);
    if (args[0] === "cena") {
      let cena = null;
      Dados.aulas().forEach(function (a) { (a.cenas || []).forEach(function (c) { if (c.id === args[1]) cena = c; }); });
      if (cena) return sessaoConversa("cena", cena);
    }
    const p = Dados.perfil();
    const box = h("div", { class: "stack-lg" });
    box.appendChild(h("div", { class: "stack" }, h("div", { class: "eyebrow conversa", text: "Atividade principal" }), h("h2", { text: "Conversar" }),
      h("p", { class: "muted", text: "Fale em voz alta, sem medo de errar. A IA responde em inglês simples, corrige só o que importa e no fim mostra o que melhorar." })));
    box.appendChild(h("div", { class: "card conversa" },
      h("h3", { text: "Diário falado" }),
      h("p", { class: "muted", text: "A IA pergunta sobre o seu dia, como um amigo. Bom para fazer todo dia, em 5 minutos." }),
      h("button", { class: "btn cheio grande", type: "button", onclick: function () { ir("conversar/diario"); } }, "Começar o diário")));
    const cenas = h("div", { class: "lista" });
    Dados.aulas().forEach(function (a) {
      (a.cenas || []).forEach(function (c) {
        const vezes = p.conversas.filter(function (x) { return x.cena === c.id; }).length;
        cenas.appendChild(h("button", { class: "item item-btn", type: "button", onclick: function () { ir("conversar/cena/" + c.id); } },
          h("div", { class: "between" }, h("b", { text: c.titulo }), h("span", { class: "pill" + (vezes ? " ok" : " novo"), text: vezes ? vezes + "x feita" : "nova" })),
          h("span", { class: "small muted", text: c.objetivo }),
          h("span", { class: "small muted", text: "Aula: " + a.titulo })));
      });
    });
    box.appendChild(h("div", { class: "stack" }, h("h3", { text: "Situações para praticar (roleplay)" }), cenas));
    if (p.conversas.length) {
      box.appendChild(h("div", { class: "stack" }, h("h3", { text: "Últimas conversas" }), h("div", { class: "lista" }, p.conversas.slice(-5).reverse().map(cartaoConversa))));
    }
    $app.appendChild(box);
  }
  function cartaoConversa(c) {
    return h("div", { class: "item" },
      h("div", { class: "between" }, h("b", { text: c.titulo }), h("span", { class: "small muted", text: c.data.split("-").reverse().join("/") })),
      h("span", { class: "small muted", text: c.turnos + " falas · " + c.palavras + " palavras" + (c.fluencia ? " · fluência " + c.fluencia + "/5" : "") }),
      (c.correcoes || []).slice(0, 2).map(function (k) { return h("div", { class: "correcao" }, h("span", { class: "disse", text: k.said }), h("span", { class: "melhor", text: k.better })); }));
  }

  function sessaoConversa(modo, cena) {
    const p = Dados.perfil();
    const comIA = IA.temChave();
    const historico = []; // { papel: "ia" | "eu", texto, pt?, correcao? }
    const correcoesTurno = [];
    let lerEmVozAlta = true;
    let escuta = null;
    let ocupado = false;
    let palavrasDitas = 0;
    let turnos = 0;
    let encerrada = false;

    // Perguntas prontas (sem IA): mistura perguntas das aulas
    const perguntas = [];
    Dados.aulas().forEach(function (a) { (a.diario || []).forEach(function (q) { perguntas.push(q); }); });
    perguntas.sort(function () { return Math.random() - 0.5; });
    let idxPergunta = 0;

    const titulo = modo === "diario" ? "Diário falado" : cena.titulo;
    const chat = h("div", { class: "chat", "aria-live": "polite" });
    const parcial = h("div", { class: "parcial" });
    const erro = h("div", { class: "aviso", hidden: true });
    const btnFalar = h("button", { class: "btn cheio grande", type: "button", disabled: !Voz.disponivel }, "Falar");
    const campo = h("input", { type: "text", id: "digitar-conversa", placeholder: Voz.disponivel ? "Ou digite em inglês" : "Digite em inglês", autocomplete: "off" });
    const btnEnviar = h("button", { class: "btn", type: "button" }, "Enviar");
    const btnAjuda = h("button", { class: "btn", type: "button", hidden: !comIA }, "Como digo…?");
    const btnFim = h("button", { class: "btn fantasma", type: "button" }, "Encerrar e ver feedback");
    const chkVoz = h("input", { type: "checkbox", id: "ler-voz", checked: true });
    chkVoz.addEventListener("change", function () { lerEmVozAlta = chkVoz.checked; if (!lerEmVozAlta) Voz.calar(); });
    const ajudaBox = h("div", { class: "card", hidden: true });

    const topo = h("div", { class: "stack" },
      h("div", { class: "between" }, h("button", { class: "btn fantasma", type: "button", onclick: function () { ir("conversar"); } }, "← Voltar"), btnFim),
      h("div", { class: "eyebrow conversa", text: modo === "diario" ? "Diário falado" : "Roleplay" }),
      h("h2", { text: titulo }),
      cena ? h("p", { class: "muted", text: "Seu objetivo: " + cena.objetivo }) : null,
      cena && cena.blocosAlvo && cena.blocosAlvo.length ? h("div", { class: "row" }, cena.blocosAlvo.map(function (id) { const b = Dados.blocoPorId(id); return b ? h("span", { class: "chunk small", text: b.en }) : null; })) : null,
      !comIA ? h("div", { class: "aviso info", text: "Modo sem IA: você responde perguntas prontas, sem correções. Configure a chave gratuita em Ajustes para conversar de verdade." }) : null);

    const controles = h("div", { class: "card conversa" },
      parcial,
      h("div", { class: "row" }, btnFalar),
      h("div", { class: "digitar" }, campo, btnEnviar),
      h("div", { class: "between" }, h("label", { class: "small", for: "ler-voz", style: "display:inline-flex;gap:6px;align-items:center" }, chkVoz, "Ler respostas em voz alta"), btnAjuda));

    $app.appendChild(h("div", { class: "stack-lg" }, topo, chat, erro, ajudaBox, controles));

    function mostrarErro(msg) { erro.textContent = msg; erro.hidden = !msg; }
    function rolar() { controles.scrollIntoView({ block: "end", behavior: "smooth" }); }

    function adicionarMsg(m) {
      historico.push(m);
      const el = h("div", { class: "msg " + m.papel });
      el.appendChild(h("div", { text: m.texto }));
      if (m.papel === "ia") {
        const pt = h("div", { class: "pt", hidden: true, text: m.pt || "" });
        el.appendChild(pt);
        el.appendChild(h("div", { class: "acoes" },
          h("button", { type: "button", onclick: function () { Voz.falar(m.texto); } }, "▶ Ouvir"),
          h("button", { type: "button", onclick: function () { Voz.falar(m.texto, 0.65); } }, "Devagar"),
          m.pt ? h("button", { type: "button", onclick: function () { pt.hidden = !pt.hidden; } }, "Tradução") : null));
      }
      chat.appendChild(el);
      if (m.correcao) {
        chat.appendChild(h("div", { class: "correcao" },
          h("span", { class: "small", text: "Dica de correção" }),
          h("span", { class: "disse", text: m.correcao.said }),
          h("span", { class: "melhor", text: m.correcao.better }),
          m.correcao.why_pt ? h("span", { class: "small", text: m.correcao.why_pt }) : null));
      }
      rolar();
    }

    async function vezDaIA() {
      ocupado = true; atualizarBotoes();
      parcial.textContent = "Pensando…";
      try {
        if (comIA) {
          const r = await IA.responder(modo, cena, historico.map(function (m) { return { papel: m.papel, texto: m.texto }; }));
          if (encerrada) return;
          if (r.correction && r.correction.better) {
            const ultimo = chat.querySelector(".msg.eu:last-of-type");
            correcoesTurno.push(r.correction);
            const cx = h("div", { class: "correcao" }, h("span", { class: "small", text: "Dica de correção" }), h("span", { class: "disse", text: r.correction.said }), h("span", { class: "melhor", text: r.correction.better }), r.correction.why_pt ? h("span", { class: "small", text: r.correction.why_pt }) : null);
            if (ultimo) chat.appendChild(cx);
          }
          adicionarMsg({ papel: "ia", texto: r.reply_en || "Sorry, can you say that again?", pt: r.reply_pt });
          if (lerEmVozAlta) Voz.falar(r.reply_en || "");
        } else {
          let q;
          if (!historico.length) q = "Hi! Let's talk about your day. How are you today?";
          else if (idxPergunta < perguntas.length && idxPergunta < 6) q = perguntas[idxPergunta++];
          else q = "Great job today! Tap \"Encerrar\" to finish.";
          adicionarMsg({ papel: "ia", texto: q });
          if (lerEmVozAlta) Voz.falar(q);
        }
        mostrarErro("");
      } catch (e) {
        mostrarErro(e.message);
      } finally {
        ocupado = false; parcial.textContent = ""; atualizarBotoes();
      }
    }

    function enviar(texto, segundos) {
      texto = (texto || "").trim();
      if (!texto || ocupado) return;
      const qtd = Voz.palavras(texto).length;
      palavrasDitas += qtd; turnos += 1;
      p.totais.turnos += 1;
      Dados.registrarFala(segundos || qtd * 0.6, qtd);
      adicionarMsg({ papel: "eu", texto: texto });
      Dados.ganharXP(qtd >= 6 ? 15 : 10, "fala na conversa");
      vezDaIA();
    }

    function atualizarBotoes() {
      btnFalar.disabled = !Voz.disponivel || ocupado;
      btnEnviar.disabled = ocupado;
      btnAjuda.disabled = ocupado;
    }

    btnFalar.addEventListener("click", function () {
      if (escuta) { escuta.parar(); return; }
      Voz.calar();
      mostrarErro("");
      btnFalar.textContent = "Enviar fala";
      btnFalar.classList.add("ouvindo");
      parcial.textContent = "Pode falar…";
      escuta = Voz.ouvir({ continuo: true, aoParcial: function (t) { parcial.textContent = t; } });
      escuta.promessa.then(function (r) { enviar(r.texto, r.segundosFala); })
        .catch(function (e) { mostrarErro(e.message); })
        .finally(function () { escuta = null; btnFalar.textContent = "Falar"; btnFalar.classList.remove("ouvindo"); if (!ocupado) parcial.textContent = ""; });
    });
    function enviarDigitado() { const t = campo.value; campo.value = ""; enviar(t, 0); }
    btnEnviar.addEventListener("click", enviarDigitado);
    campo.addEventListener("keydown", function (e) { if (e.key === "Enter") enviarDigitado(); });

    btnAjuda.addEventListener("click", function () {
      ajudaBox.hidden = false;
      ajudaBox.innerHTML = "";
      const entrada = h("input", { type: "text", id: "como-digo", placeholder: "Escreva em português o que quer dizer" });
      const saida = h("div", { class: "stack" });
      const pedir = async function () {
        if (!entrada.value.trim()) return;
        saida.textContent = "Procurando um jeito simples…";
        try {
          const r = await IA.comoDizer(entrada.value.trim(), historico);
          saida.innerHTML = "";
          saida.appendChild(h("div", { class: "frase-en", style: "font-size:1.25rem", text: r.en }));
          if (r.dica_pt) saida.appendChild(h("p", { class: "small muted", text: r.dica_pt }));
          saida.appendChild(h("div", { class: "row" },
            h("button", { class: "btn", type: "button", onclick: function () { Voz.falar(r.en, 0.8); } }, "▶ Ouvir"),
            h("button", { class: "btn", type: "button", onclick: function (ev) { Dados.adicionarBlocoPessoal(r.en, entrada.value.trim(), "conversa"); ev.target.textContent = "Salvo nos blocos"; ev.target.disabled = true; } }, "Salvar nos meus blocos")));
          saida.appendChild(h("p", { class: "small muted", text: "Agora fale a frase com as suas palavras usando o botão Falar." }));
        } catch (e) { saida.textContent = e.message; }
      };
      ajudaBox.appendChild(h("div", { class: "between" }, h("h3", { text: "Como digo…?" }), h("button", { class: "btn fantasma", type: "button", onclick: function () { ajudaBox.hidden = true; } }, "Fechar")));
      ajudaBox.appendChild(h("div", { class: "digitar" }, entrada, h("button", { class: "btn cheio", type: "button", onclick: pedir }, "Traduzir")));
      entrada.addEventListener("keydown", function (e) { if (e.key === "Enter") pedir(); });
      ajudaBox.appendChild(saida);
      entrada.focus();
    });

    btnFim.addEventListener("click", async function () {
      if (escuta) escuta.parar();
      encerrada = true;
      Voz.calar();
      if (!turnos) { ir("conversar"); return; }
      const registro = { data: Dados.hoje(), modo: modo, cena: cena ? cena.id : null, titulo: titulo, turnos: turnos, palavras: palavrasDitas, correcoes: correcoesTurno.slice(0, 5), fluencia: null };
      $app.innerHTML = "";
      const box = h("div", { class: "stack-lg" }, h("div", { class: "eyebrow conversa", text: "Fim da conversa" }), h("h2", { text: "Muito bem!" }),
        h("div", { class: "metricas" },
          h("div", { class: "metrica" }, h("b", { text: String(turnos) }), h("span", { text: "falas suas" })),
          h("div", { class: "metrica" }, h("b", { text: String(palavrasDitas) }), h("span", { text: "palavras ditas" }))));
      $app.appendChild(box);
      const fb = h("div", { class: "card conversa" }, h("p", { class: "muted", text: comIA ? "Preparando o seu feedback…" : "Configure a IA em Ajustes para receber correções e frases novas no fim de cada conversa." }));
      box.appendChild(fb);
      box.appendChild(h("button", { class: "btn cheio", type: "button", onclick: function () { ir("hoje"); } }, "Voltar para Hoje"));
      if (turnos >= 3) {
        if (modo === "diario") p.totais.diarios += 1;
        completarPasso("conversa");
        Dados.ganharXP(40, "conversa concluída");
      }
      if (comIA) {
        try {
          const r = await IA.feedback(modo, cena, historico);
          registro.fluencia = r.fluencia || null;
          const vistas = new Set();
          registro.correcoes = (r.correcoes || []).concat(correcoesTurno).filter(function (k) { const c = String(k.better || "").toLowerCase().replace(/[^a-z ]/g, "").trim(); if (!c || vistas.has(c)) return false; vistas.add(c); return true; }).slice(0, 5);
          fb.innerHTML = "";
          fb.appendChild(h("p", { text: r.resumo_pt || "" }));
          if ((r.pontos_fortes || []).length) fb.appendChild(h("div", { class: "stack", style: "gap:4px" }, h("b", { text: "O que foi bem" }), (r.pontos_fortes || []).map(function (x) { return h("div", { class: "small", text: "• " + x }); })));
          if ((r.correcoes || []).length) fb.appendChild(h("div", { class: "stack", style: "gap:8px" }, h("b", { text: "Para melhorar" }), r.correcoes.map(function (k) {
            return h("div", { class: "correcao" }, h("span", { class: "disse", text: k.said }), h("span", { class: "melhor", text: k.better }), h("span", { class: "small", text: k.why_pt || "" }),
              h("div", { class: "row" }, h("button", { class: "btn", type: "button", onclick: function (ev) { Dados.adicionarBlocoPessoal(k.better, k.why_pt || "", "correção"); ev.target.textContent = "Salvo"; ev.target.disabled = true; } }, "Treinar esta frase")));
          })));
          if ((r.novos_blocos || []).length) fb.appendChild(h("div", { class: "stack", style: "gap:8px" }, h("b", { text: "Blocos prontos para a próxima vez" }), r.novos_blocos.map(function (b) {
            return h("div", { class: "between item" }, h("div", {}, h("span", { class: "chunk", text: b.en }), h("div", { class: "small muted", text: b.pt })),
              h("button", { class: "btn", type: "button", onclick: function (ev) { Dados.adicionarBlocoPessoal(b.en, b.pt, "conversa"); ev.target.textContent = "Salvo"; ev.target.disabled = true; } }, "Salvar"));
          })));
        } catch (e) { fb.innerHTML = ""; fb.appendChild(h("p", { class: "muted", text: "Não consegui gerar o feedback agora: " + e.message })); }
      }
      p.conversas.push(registro);
      p.conversas = p.conversas.slice(-40);
      Dados.salvar();
    });

    limpeza = function () { encerrada = true; if (escuta) escuta.parar(); Voz.calar(); };
    vezDaIA();
  }

  // =====================================================================
  // PRATICAR (hub)
  // =====================================================================
  function telaPraticar(args) {
    if (args[0] === "blocos") return sessaoBlocos();
    if (args[0] === "shadowing") return args[1] ? sessaoShadowing(args[1]) : listaShadowing();
    if (args[0] === "recontar") return sessaoRecontar();
    const p = Dados.perfil();
    const fila = Dados.filaDoDia(5);
    const box = h("div", { class: "stack-lg" }, h("div", { class: "stack" }, h("h2", { text: "Praticar" }), h("p", { class: "muted", text: "Exercícios curtos que preparam você para conversar. Cada cor é um tipo de treino." })));
    const card = function (cls, ic, titulo, desc, info, rota) {
      return h("div", { class: "card " + cls },
        h("div", { class: "between" }, h("div", { class: "row" }, h("span", { class: "eyebrow " + cls }, titulo)), h("span", { class: "small muted", text: info })),
        h("p", { text: desc }),
        h("button", { class: "btn cheio " + cls, type: "button", onclick: function () { ir(rota); } }, "Começar"));
    };
    box.appendChild(card("blocos", "blocos", "Blocos prontos", "Frases inteiras para usar na conversa. Você vê em português, fala em inglês e o app avalia. As revisões seguem a repetição espaçada: o que você erra volta logo, o que acerta demora mais para voltar.", fila.length + " para hoje · " + Dados.contarDominados(p) + " dominados", "praticar/blocos"));
    box.appendChild(card("shadowing", "shadowing", "Shadowing", "Ouça um diálogo curto e repita logo em seguida, imitando o ritmo. Melhora a pronúncia e a velocidade.", Object.keys(p.shadowing).length + " diálogos feitos", "praticar/shadowing"));
    box.appendChild(card("recontar", "recontar", "Recontar 3 vezes", "Conte a mesma história 3 vezes, com menos tempo a cada rodada. Treina a fala sem travar.", p.recontar.length + " sessões", "praticar/recontar"));
    $app.appendChild(box);
  }

  // ---------- botão de falar e avaliar a pronúncia ----------
  function avaliador(frase, opcoes) {
    const rotulo = opcoes.rotulo || "Falar";
    const btn = h("button", { class: "btn cheio grande " + (opcoes.cls || ""), type: "button", disabled: !Pronuncia.disponivel() }, rotulo);
    const status = h("div", { class: "small muted", "aria-live": "polite" });
    let tent = null, usado = false;
    function iniciar() {
      if (tent) { tent.parar(); return; }
      Voz.calar();
      status.textContent = "";
      tent = Pronuncia.tentar(frase, { aoEstado: function (e) {
        if (e.fase === "carregando") { btn.textContent = "Preparando…"; status.textContent = "Carregando o modelo de pronúncia…"; }
        else if (e.fase === "baixando") { btn.textContent = "Baixando " + e.pct + "%"; status.textContent = "Baixando o modelo (" + (e.mb || 355) + " MB). Isso acontece só na primeira vez neste aparelho."; }
        else if (e.fase === "ouvindo") { btn.textContent = "Ouvindo… toque para terminar"; btn.classList.add("ouvindo"); status.textContent = "Pode falar. Eu paro sozinho quando você terminar."; }
        else if (e.fase === "analisando") { btn.textContent = "Analisando…"; btn.classList.remove("ouvindo"); status.textContent = "Comparando os sons da sua voz com a pronúncia esperada…"; }
      } });
      tent.promessa.then(function (r) { usado = true; status.textContent = ""; if (opcoes.aoResultado) opcoes.aoResultado(r); })
        .catch(function (e) { if (e.message !== "Cancelado.") status.textContent = e.message; if (opcoes.aoErro) opcoes.aoErro(e); })
        .finally(function () { tent = null; btn.classList.remove("ouvindo"); btn.textContent = usado ? (opcoes.rotuloDepois || rotulo) : rotulo; });
    }
    btn.addEventListener("click", iniciar);
    return { btn: btn, status: status, iniciar: iniciar, parar: function () { if (tent) tent.parar(); }, promessa: function () { return tent ? tent.promessa : null; } };
  }

  // ---------- blocos (repetição espaçada falada) ----------
  function sessaoBlocos() {
    const fila = Dados.filaDoDia(5).slice(0, 15);
    let i = 0, feitos = 0, acertos = 0;
    let escuta = null;
    const box = h("div", { class: "stack-lg" });
    $app.appendChild(box);
    limpeza = function () { if (escuta) escuta.parar(); };

    function fim() {
      box.innerHTML = "";
      if (feitos >= Math.min(5, fila.length) || !fila.length) completarPasso("blocos");
      box.appendChild(h("div", { class: "card blocos" },
        h("div", { class: "eyebrow blocos", text: "Blocos prontos" }),
        h("h2", { text: fila.length ? "Revisão concluída" : "Tudo em dia" }),
        h("p", { class: "muted", text: fila.length ? feitos + " frases faladas, " + acertos + " corretas. As que você errou voltam ainda hoje ou amanhã." : "Não há frases para revisar agora. Novas frases entram quando você adiciona uma aula ou salva frases das conversas." }),
        h("div", { class: "row" }, h("button", { class: "btn cheio blocos", type: "button", onclick: function () { ir("hoje"); } }, "Voltar para Hoje"), h("button", { class: "btn", type: "button", onclick: function () { ir("conversar/diario"); } }, "Usar na conversa"))));
    }

    function mostrar() {
      box.innerHTML = "";
      if (i >= fila.length) { fim(); return; }
      const b = fila[i];
      const estado = Dados.estadoCartao(b.id);
      let revelado = false;
      const en = h("div", { class: "frase-en oculta", title: "Toque para ver", text: b.en });
      en.addEventListener("click", function () { revelar(); });
      const resultado = h("div");
      const detalhe = h("div");
      let registrado = false;
      const aval = avaliador(b.en, { cls: "blocos", rotulo: "Falar em inglês", rotuloDepois: "Falar de novo", aoResultado: function (r) {
        Dados.registrarFala(r.segundos || 2, r.qtdPalavras || 0);
        revelar();
        Pronuncia.pintarFrase(en, r, h, function (p) { detalhe.innerHTML = ""; detalhe.appendChild(Pronuncia.detalhePalavra(p, h)); });
        detalhe.innerHTML = "";
        resultado.innerHTML = ""; resultado.appendChild(Pronuncia.cartao(r, h));
        if (!registrado) { registrado = true; registrar(r.nivel, r.nota); }
      } });
      const btnFalar = aval.btn;
      const autoavaliar = h("div", { class: "row", hidden: true },
        h("button", { class: "btn", type: "button", onclick: function () { registrado = true; registrar("bad", 30); } }, "Errei"),
        h("button", { class: "btn", type: "button", onclick: function () { registrado = true; registrar("mid", 70); } }, "Quase"),
        h("button", { class: "btn", type: "button", onclick: function () { registrado = true; registrar("ok", 100); } }, "Acertei"));
      const btnProx = h("button", { class: "btn cheio blocos", type: "button", hidden: true, onclick: function () { i++; mostrar(); } }, "Próxima →");

      function revelar() { if (revelado) return; revelado = true; en.classList.remove("oculta"); en.title = ""; if (!Pronuncia.disponivel()) autoavaliar.hidden = false; }
      function registrar(nivel, nota) {
        Dados.revisarCartao(b.id, nivel, nota);
        feitos++; if (nivel === "ok") acertos++;
        Dados.ganharXP(nivel === "ok" ? 10 : nivel === "mid" ? 6 : 2, "bloco");
        autoavaliar.hidden = true; btnProx.hidden = false;
      }
      limpeza = function () { aval.parar(); };

      box.appendChild(h("div", { class: "between" }, h("button", { class: "btn fantasma", type: "button", onclick: function () { ir("praticar"); } }, "← Sair"), h("span", { class: "small muted num", text: (i + 1) + " de " + fila.length })));
      box.appendChild(h("div", { class: "barra" }, h("span", { style: "width:" + Math.round(100 * i / fila.length) + "%;background:var(--blocos)" })));
      box.appendChild(h("div", { class: "card blocos" },
        h("div", { class: "between" }, h("span", { class: "eyebrow blocos", text: b.aulaTitulo || "Bloco" }), h("span", { class: "pill" + (estado === "novo" ? " novo" : estado === "revisar" ? " mid" : ""), text: estado === "novo" ? "nova" : estado === "revisar" ? "revisão" : estado })),
        h("p", { style: "font-size:1.15rem", text: b.pt }),
        b.dica ? h("p", { class: "small muted", text: b.dica }) : null,
        en,
        h("div", { class: "row" },
          h("button", { class: "btn", type: "button", onclick: function () { revelar(); Voz.falar(b.en); } }, "▶ Ouvir"),
          h("button", { class: "btn", type: "button", onclick: function () { revelar(); Voz.falar(b.en, 0.6); } }, "▶ Devagar"),
          !Pronuncia.disponivel() ? h("button", { class: "btn", type: "button", onclick: revelar }, "Mostrar") : null),
        h("p", { class: "small muted", text: Pronuncia.disponivel() ? "Tente falar antes de ouvir. Lembrar sozinho fixa mais." : "Fale em voz alta, depois toque em Mostrar e diga como foi." }),
        btnFalar, aval.status, autoavaliar, resultado, detalhe, h("div", { class: "row" }, btnProx)));
    }
    mostrar();
  }

  // ---------- shadowing ----------
  function todosDialogos() {
    const l = [];
    Dados.aulas().forEach(function (a) { (a.dialogos || []).forEach(function (d) { l.push(Object.assign({ aulaTitulo: a.titulo }, d)); }); });
    return l;
  }
  function listaShadowing() {
    const p = Dados.perfil();
    const box = h("div", { class: "stack-lg" },
      h("div", { class: "stack" }, h("button", { class: "btn fantasma", type: "button", style: "justify-self:start", onclick: function () { ir("praticar"); } }, "← Praticar"),
        h("div", { class: "eyebrow shadowing", text: "Shadowing" }), h("h2", { text: "Escolha um diálogo" }),
        h("p", { class: "muted", text: "Os trechos marcados em âmbar são blocos prontos que você também revisa nos cartões." })));
    box.appendChild(h("div", { class: "lista" }, todosDialogos().map(function (d) {
      const s = p.shadowing[d.id];
      return h("button", { class: "item item-btn", type: "button", onclick: function () { ir("praticar/shadowing/" + d.id); } },
        h("div", { class: "between" }, h("b", { text: d.titulo }), h("span", { class: "pill" + (s ? (s.melhor >= 90 ? " ok" : " mid") : " novo"), text: s ? "melhor " + s.melhor + "%" : "novo" })),
        h("span", { class: "small muted", text: d.aulaTitulo + " · " + d.linhas.length + " falas" + (s ? " · feito " + s.vezes + "x" : "") }));
    })));
    $app.appendChild(box);
  }
  function marcarBlocos(texto) {
    // devolve nós com os blocos prontos destacados
    const frag = document.createDocumentFragment();
    const blocos = Dados.todosBlocos().map(function (b) { return b.en.replace(/[.?!]+$/, "").replace(/_{2,}.*$/, "").trim(); }).filter(function (t) { return t.split(" ").length >= 2; });
    blocos.sort(function (a, b) { return b.length - a.length; });
    let resto = texto;
    while (resto) {
      let melhor = null;
      blocos.forEach(function (bl) {
        const pos = resto.toLowerCase().indexOf(bl.toLowerCase());
        if (pos >= 0 && (!melhor || pos < melhor.pos || (pos === melhor.pos && bl.length > melhor.len))) melhor = { pos: pos, len: bl.length };
      });
      if (!melhor) { frag.appendChild(document.createTextNode(resto)); break; }
      if (melhor.pos) frag.appendChild(document.createTextNode(resto.slice(0, melhor.pos)));
      frag.appendChild(h("span", { class: "chunk", text: resto.slice(melhor.pos, melhor.pos + melhor.len) }));
      resto = resto.slice(melhor.pos + melhor.len);
    }
    return frag;
  }
  function sessaoShadowing(id) {
    const d = todosDialogos().find(function (x) { return x.id === id; });
    if (!d) { ir("praticar/shadowing"); return; }
    const p = Dados.perfil();
    let velocidade = 0.8;
    let esconder = false;
    let parar = false;
    let escuta = null;
    const notas = new Array(d.linhas.length).fill(null);
    limpeza = function () { parar = true; if (escuta) escuta.parar(); Voz.calar(); };

    const etapas = h("div", { class: "etapas", role: "group", "aria-label": "Velocidade" });
    function desenharEtapas() {
      etapas.innerHTML = "";
      [[0.6, "Devagar"], [0.8, "Médio"], [0.95, "Normal"]].forEach(function (v) {
        etapas.appendChild(h("button", { class: "etapa", type: "button", "aria-pressed": String(velocidade === v[0]), onclick: function () { velocidade = v[0]; desenharEtapas(); } }, v[1]));
      });
      etapas.appendChild(h("button", { class: "etapa", type: "button", "aria-pressed": String(esconder), onclick: function () { esconder = !esconder; desenharEtapas(); desenharLinhas(); } }, "Esconder inglês"));
    }
    const linhasEl = h("div", { class: "linhas" });
    const status = h("div", { class: "small muted", "aria-live": "polite" });

    function desenharLinhas(ativa) {
      linhasEl.innerHTML = "";
      d.linhas.forEach(function (l, k) {
        const nota = notas[k];
        const en = h("div", { class: "en" });
        if (esconder && k !== ativa) en.textContent = "• • •"; else en.appendChild(marcarBlocos(l.en));
        linhasEl.appendChild(h("div", { class: "linha" + (k === ativa ? " ativa" : "") },
          h("div", { class: "quem " + l.quem, text: l.quem }),
          h("div", { class: "stack", style: "gap:4px" }, en, h("div", { class: "pt", text: l.pt }),
            h("div", { class: "row", style: "gap:6px" },
              h("button", { class: "btn fantasma small", type: "button", onclick: function () { Voz.falar(l.en, velocidade); } }, "▶ Ouvir"),
              Pronuncia.disponivel() ? h("button", { class: "btn fantasma small", type: "button", onclick: function () { repetirLinha(k); } }, "Repetir") : null,
              nota ? h("span", { class: "nota", style: "color:var(--" + nota.nivel + ")", text: nota.nota + "%" }) : null),
            nota ? resultadoLinha(nota) : null)));
      });
    }
    function resultadoLinha(r) {
      const frase = h("div", { class: "frase-en", style: "font-size:1.05rem" });
      const det = h("div");
      Pronuncia.pintarFrase(frase, r, h, function (pal) { det.innerHTML = ""; det.appendChild(Pronuncia.detalhePalavra(pal, h)); });
      return h("div", { class: "stack", style: "gap:6px" }, frase,
        (r.dicas || []).slice(0, 1).map(function (dc) { return h("div", { class: "dica" }, h("span", { class: "som", text: dc.som }), h("span", { text: dc.texto })); }), det);
    }
    async function repetirLinha(k) {
      if (escuta) return;
      desenharLinhas(k);
      await Voz.falar(d.linhas[k].en, velocidade);
      if (parar) return;
      status.textContent = "Sua vez: repita a fala " + (k + 1);
      escuta = Pronuncia.tentar(d.linhas[k].en, { aoEstado: function (e) {
        if (e.fase === "baixando") status.textContent = "Baixando o modelo de pronúncia: " + e.pct + "% (só na primeira vez)";
        else if (e.fase === "carregando") status.textContent = "Preparando o modelo de pronúncia…";
        else if (e.fase === "ouvindo") status.textContent = "Sua vez: repita a fala " + (k + 1) + ". Eu paro sozinho quando você terminar.";
        else if (e.fase === "analisando") status.textContent = "Analisando os sons…";
      } });
      try {
        const r = await escuta.promessa;
        notas[k] = r;
        Dados.registrarFala(r.segundos || 2, r.qtdPalavras || 0);
        p.totais.linhasShadow += 1;
        if (r.nivel !== "bad") Dados.ganharXP(5, "shadowing");
        status.textContent = "";
      } catch (e) { if (e.message !== "Cancelado.") status.textContent = e.message; }
      escuta = null;
      desenharLinhas(k);
      verificarFim();
    }
    async function automatico() {
      parar = false;
      for (let k = 0; k < d.linhas.length && !parar; k++) await repetirLinha(k);
    }
    async function ouvirTudo() {
      parar = false;
      for (let k = 0; k < d.linhas.length && !parar; k++) { desenharLinhas(k); await Voz.falar(d.linhas[k].en, velocidade); await new Promise(function (r) { setTimeout(r, 350); }); }
      desenharLinhas();
    }
    let concluido = false;
    function verificarFim() {
      if (concluido || notas.some(function (n) { return !n; })) return;
      concluido = true;
      const media = Math.round(notas.reduce(function (s, n) { return s + n.nota; }, 0) / notas.length);
      const s = p.shadowing[d.id] || { vezes: 0, melhor: 0 };
      s.vezes += 1; s.melhor = Math.max(s.melhor, media); s.ultima = Dados.hoje();
      p.shadowing[d.id] = s;
      Dados.salvar();
      completarPasso("shadowing");
      Dados.ganharXP(20, "diálogo completo");
      status.textContent = "Diálogo completo. Média " + media + "%. Faça de novo mais rápido ou escondendo o inglês.";
    }

    desenharEtapas(); desenharLinhas();
    $app.appendChild(h("div", { class: "stack-lg" },
      h("div", { class: "stack" }, h("button", { class: "btn fantasma", type: "button", style: "justify-self:start", onclick: function () { ir("praticar/shadowing"); } }, "← Diálogos"),
        h("div", { class: "eyebrow shadowing", text: "Shadowing · " + d.aulaTitulo }), h("h2", { text: d.titulo }),
        h("p", { class: "muted small", text: "1. Ouça tudo uma vez. 2. Use o modo automático: o app fala cada frase e você repete logo depois, imitando o ritmo. 3. Repita escondendo o inglês." })),
      etapas,
      h("div", { class: "row" },
        h("button", { class: "btn", type: "button", onclick: ouvirTudo }, "▶ Ouvir tudo"),
        Pronuncia.disponivel() ? h("button", { class: "btn cheio shadowing", type: "button", onclick: automatico }, "Ouvir e repetir (automático)") : null,
        h("button", { class: "btn fantasma", type: "button", onclick: function () { parar = true; Voz.calar(); if (escuta) escuta.parar(); } }, "Parar")),
      status,
      linhasEl));
  }

  // ---------- recontar 4-3-2 ----------
  function sessaoRecontar() {
    const p = Dados.perfil();
    const temas = [];
    Dados.aulas().forEach(function (a) { (a.recontar || []).forEach(function (t) { temas.push(t); }); });
    let tema = temas[Math.floor(Math.random() * temas.length)] || "Conte como foi o seu dia.";
    let modo = "iniciante";
    const TEMPOS = { iniciante: [120, 90, 60], classico: [240, 180, 120] };
    let rodada = 0;
    const wpm = [];
    let escuta = null, timer = null;
    limpeza = function () { if (timer) clearInterval(timer); if (escuta) escuta.parar(); };

    const box = h("div", { class: "stack-lg" });
    $app.appendChild(box);

    function inicio() {
      box.innerHTML = "";
      const sel = h("select", { id: "tema-recontar" }, temas.map(function (t) { return h("option", { value: t, text: t }); }));
      sel.value = tema;
      sel.addEventListener("change", function () { tema = sel.value; });
      const seg = h("div", { class: "seg", role: "group", "aria-label": "Duração" });
      function desenharSeg() {
        seg.innerHTML = "";
        [["iniciante", "2 · 1,5 · 1 min"], ["classico", "4 · 3 · 2 min"]].forEach(function (m) {
          seg.appendChild(h("button", { type: "button", "aria-pressed": String(modo === m[0]), onclick: function () { modo = m[0]; desenharSeg(); } }, m[1]));
        });
      }
      desenharSeg();
      box.appendChild(h("div", { class: "stack" }, h("button", { class: "btn fantasma", type: "button", style: "justify-self:start", onclick: function () { ir("praticar"); } }, "← Praticar"),
        h("div", { class: "eyebrow recontar", text: "Recontar" }), h("h2", { text: "Mesma história, 3 vezes" }),
        h("p", { class: "muted", text: "Você conta a mesma história três vezes, com menos tempo em cada rodada. Como o conteúdo já é conhecido, o cérebro treina velocidade. O app conta quantas palavras por minuto você fala." })));
      box.appendChild(h("div", { class: "card recontar" },
        h("label", { class: "campo", for: "tema-recontar" }, "Tema", sel),
        h("div", { class: "campo" }, "Duração das rodadas", seg),
        h("button", { class: "btn cheio recontar grande", type: "button", disabled: !Voz.disponivel, onclick: function () { rodada = 0; wpm.length = 0; rodadaTela(); } }, "Começar a rodada 1"),
        !Voz.disponivel ? h("p", { class: "small muted", text: "Este exercício precisa do Google Chrome para contar as palavras." }) : null));
    }

    function rodadaTela() {
      box.innerHTML = "";
      const total = TEMPOS[modo][rodada];
      let resta = total;
      let palavrasAgora = 0;
      const relogio = h("div", { class: "relogio", text: fmt(resta) });
      const contador = h("div", { class: "small muted num", style: "text-align:center", text: "0 palavras" });
      const parcial = h("div", { class: "parcial" });
      const btn = h("button", { class: "btn cheio recontar grande", type: "button" }, "Terminar antes");
      box.appendChild(h("div", { class: "stack" }, h("div", { class: "eyebrow recontar", text: "Rodada " + (rodada + 1) + " de 3" }), h("h2", { text: tema })));
      box.appendChild(desenharRodadas());
      box.appendChild(h("div", { class: "card recontar" }, relogio, contador, parcial, btn));
      escuta = Voz.ouvir({ continuo: true, aoParcial: function (t) { palavrasAgora = Voz.palavras(t).length; contador.textContent = palavrasAgora + " palavras"; parcial.textContent = t.split(" ").slice(-14).join(" "); } });
      const inicioMs = Date.now();
      timer = setInterval(function () {
        resta = total - Math.floor((Date.now() - inicioMs) / 1000);
        relogio.textContent = fmt(Math.max(0, resta));
        if (resta <= 0) terminar();
      }, 250);
      function terminar() {
        clearInterval(timer); timer = null;
        if (escuta) escuta.parar();
      }
      btn.addEventListener("click", terminar);
      escuta.promessa.then(function (r) { return r; }).catch(function () { return { texto: "", segundosFala: 0 }; }).then(function (r) {
        escuta = null;
        const usados = Math.max(10, (Date.now() - inicioMs) / 1000);
        const qtd = Voz.palavras(r.texto).length || palavrasAgora;
        wpm.push(Math.round(qtd / (usados / 60)));
        Dados.registrarFala(usados, qtd);
        Dados.ganharXP(20, "rodada do recontar");
        rodada++;
        if (rodada < 3) intervalo(); else final();
      });
    }
    function desenharRodadas() {
      return h("div", { class: "rodadas" }, [0, 1, 2].map(function (k) {
        return h("div", { class: "rodada" + (k === rodada ? " atual" : "") }, h("b", { text: wpm[k] != null ? String(wpm[k]) : "—" }), h("span", { text: "palavras/min" }), h("span", { text: fmt(TEMPOS[modo][k]) }));
      }));
    }
    function intervalo() {
      box.innerHTML = "";
      box.appendChild(h("div", { class: "stack" }, h("div", { class: "eyebrow recontar", text: "Respire" }), h("h2", { text: "Agora a mesma história em " + fmt(TEMPOS[modo][rodada]) })));
      box.appendChild(desenharRodadas());
      box.appendChild(h("p", { class: "muted", text: "Use as mesmas frases. Tente falar mais solto e cortar as pausas." }));
      box.appendChild(h("button", { class: "btn cheio recontar grande", type: "button", onclick: rodadaTela }, "Começar a rodada " + (rodada + 1)));
    }
    function final() {
      const ganho = wpm[0] ? Math.round(100 * (wpm[2] - wpm[0]) / wpm[0]) : 0;
      p.recontar.push({ data: Dados.hoje(), tema: tema, modo: modo, wpm: wpm.slice(), ganho: ganho });
      p.recontar = p.recontar.slice(-60);
      Dados.salvar();
      completarPasso("recontar");
      if (ganho >= 20) Dados.ganharXP(20, "bônus de velocidade");
      box.innerHTML = "";
      box.appendChild(h("div", { class: "stack" }, h("div", { class: "eyebrow recontar", text: "Resultado" }), h("h2", { text: ganho > 0 ? "Você falou " + ganho + "% mais rápido na última rodada" : "Rodadas concluídas" })));
      box.appendChild(desenharRodadas());
      box.appendChild(h("p", { class: "muted", text: "Ganhar velocidade com o mesmo conteúdo é sinal de fluência. Repita este tema em outro dia e compare." }));
      box.appendChild(h("button", { class: "btn cheio recontar", type: "button", onclick: function () { ir("hoje"); } }, "Voltar para Hoje"));
    }
    function fmt(s) { const m = Math.floor(s / 60), r = s % 60; return m + ":" + String(r).padStart(2, "0"); }
    inicio();
  }

  // =====================================================================
  // PROGRESSO
  // =====================================================================
  function telaProgresso() {
    const p = Dados.perfil();
    const n = Dados.nivelDe(p.xp);
    const minutos = p.totais.segundosFala < 600 ? (Math.round(p.totais.segundosFala / 6) / 10).toLocaleString("pt-BR") : Math.round(p.totais.segundosFala / 60);
    const box = h("div", { class: "stack-lg" }, h("h2", { text: "Progresso de " + p.nome }));
    box.appendChild(h("div", { class: "metricas" },
      metrica(n.nivel, "nível · " + Dados.nomeNivel(n.nivel)),
      metrica(p.xp, "XP no total"),
      metrica(Dados.sequencia(p), "dias seguidos"),
      metrica(minutos, "minutos falando"),
      metrica(p.totais.palavras, "palavras ditas"),
      metrica(p.conversas.length, "conversas"),
      metrica(Dados.contarDominados(p), "blocos dominados"),
      metrica(Object.keys(p.shadowing).length, "diálogos no shadowing")));

    // últimos 7 dias
    const dias = [];
    for (let k = 6; k >= 0; k--) dias.push(Dados.somarDias(Dados.hoje(), -k));
    const max = Math.max(p.metaDiaria, Math.max.apply(null, dias.map(function (d) { return (p.dias[d] || {}).xp || 0; })));
    const nomes = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
    box.appendChild(h("div", { class: "card" }, h("div", { class: "between" }, h("h3", { text: "XP nos últimos 7 dias" }), h("span", { class: "small muted", text: "meta " + p.metaDiaria + "/dia" })),
      h("div", { class: "semana" }, dias.map(function (d) {
        const xp = (p.dias[d] || {}).xp || 0;
        return h("div", { class: "col" + (xp ? "" : " vazio"), title: xp + " XP" }, h("small", { class: "num", text: xp ? String(xp) : "" }), h("i", { style: "height:" + Math.max(3, Math.round(60 * xp / max)) + "px" + (xp >= p.metaDiaria ? ";background:var(--ouro)" : "") }), h("small", { text: nomes[new Date(d + "T12:00:00").getDay()] }));
      })),
      h("p", { class: "small muted", text: "Barras douradas: dias em que a meta foi batida." })));

    // blocos por estado
    const todos = Dados.todosBlocos().concat(p.blocosPessoais);
    const cont = { novo: 0, aprendendo: 0, revisar: 0, dominado: 0 };
    todos.forEach(function (b) { cont[Dados.estadoCartao(b.id)]++; });
    box.appendChild(h("div", { class: "card blocos" }, h("h3", { text: "Seus blocos prontos" }),
      h("div", { class: "row" },
        h("span", { class: "pill novo", text: cont.novo + " novos" }), h("span", { class: "pill mid", text: cont.revisar + " para revisar" }),
        h("span", { class: "pill", text: cont.aprendendo + " aprendendo" }), h("span", { class: "pill ok", text: cont.dominado + " dominados" })),
      h("p", { class: "small muted", text: "Um bloco fica dominado quando o próximo intervalo de revisão passa de 2 semanas." })));

    // recontar
    if (p.recontar.length) {
      const ult = p.recontar.slice(-5).reverse();
      box.appendChild(h("div", { class: "card recontar" }, h("h3", { text: "Velocidade no recontar" }), h("div", { class: "lista" }, ult.map(function (r) {
        return h("div", { class: "between small" }, h("span", { text: r.data.split("-").reverse().join("/") + " · " + r.tema }), h("span", { class: "num", text: r.wpm.join(" → ") + " palavras/min" }));
      }))));
    }

    box.appendChild(h("div", { class: "stack" }, h("h3", { text: "Conquistas" }), h("div", { class: "conquistas" }, Dados.CONQUISTAS.map(function (c) {
      const g = p.conquistas[c.id];
      return h("div", { class: "conquista" + (g ? " ganha" : "") }, h("div", { class: "selo", text: g ? "✓" : "?" }), h("b", { text: c.titulo }), h("span", { text: g ? "Ganha em " + g.split("-").reverse().join("/") : c.desc }));
    }))));

    if (p.conversas.length) box.appendChild(h("div", { class: "stack" }, h("h3", { text: "Correções recentes" }), h("div", { class: "lista" }, p.conversas.slice(-6).reverse().map(cartaoConversa))));
    $app.appendChild(box);
  }
  function metrica(v, rot) { return h("div", { class: "metrica" }, h("b", { text: String(v) }), h("span", { text: rot })); }

  // =====================================================================
  // AULAS (material)
  // =====================================================================
  function telaAulas(args) {
    if (args[0] === "nova") return novaAula();
    const p = Dados.perfil();
    const extras = (function () { try { return JSON.parse(localStorage.getItem("tf:aulasExtras") || "[]").map(function (a) { return a.id; }); } catch (e) { return []; } })();
    const box = h("div", { class: "stack-lg" },
      h("div", { class: "stack" }, h("h2", { text: "Aulas" }), h("p", { class: "muted", text: "Todo o material vem daqui. A cada aula nova, os exercícios, diálogos e conversas passam a usar o conteúdo dela." })),
      h("button", { class: "btn cheio", type: "button", onclick: function () { ir("aulas/nova"); } }, "Adicionar aula nova"));
    const todasAulas = Dados.aulas();
    todasAulas.filter(function (a) { return !a.extra; }).reverse().concat(todasAulas.filter(function (a) { return a.extra; })).forEach(function (a) {
      const blocos = h("div", { class: "lista", hidden: true }, (a.blocos || []).map(function (b) {
        const e = Dados.estadoCartao(b.id);
        return h("div", { class: "between item" }, h("div", { style: "min-width:0" }, h("b", { text: b.en }), h("div", { class: "small muted", text: b.pt })),
          h("span", { class: "pill" + (e === "dominado" ? " ok" : e === "revisar" ? " mid" : e === "novo" ? " novo" : ""), text: e }));
      }));
      box.appendChild(h("div", { class: "card" },
        h("div", { class: "between" }, h("h3", { text: a.titulo }), extras.indexOf(a.id) >= 0 ? h("span", { class: "pill novo", text: "adicionada aqui" }) : null),
        h("p", { class: "muted small", text: a.resumo || "" }),
        h("div", { class: "row small" },
          h("span", { class: "pill", style: "color:var(--blocos)", text: (a.blocos || []).length + " blocos" }),
          h("span", { class: "pill", style: "color:var(--shadow)", text: (a.dialogos || []).length + " diálogos" }),
          h("span", { class: "pill", style: "color:var(--berinjela)", text: (a.cenas || []).length + " situações" })),
        h("div", { class: "row" },
          h("button", { class: "btn", type: "button", onclick: function (ev) { blocos.hidden = !blocos.hidden; ev.target.textContent = blocos.hidden ? "Ver frases" : "Esconder frases"; } }, "Ver frases"),
          extras.indexOf(a.id) >= 0 ? botaoConfirmar("Remover aula", "Remover de verdade", function () { Dados.removerAula(a.id); render(); }) : null),
        blocos));
    });
    if (p.blocosPessoais.length) {
      box.appendChild(h("div", { class: "card" }, h("h3", { text: "Minhas frases (das conversas)" }), h("div", { class: "lista" }, p.blocosPessoais.map(function (b) {
        return h("div", { class: "item" }, h("b", { text: b.en }), h("span", { class: "small muted", text: b.pt }));
      }))));
    }
    $app.appendChild(box);
  }
  function botaoConfirmar(rotulo, rotuloConfirmar, acao) {
    const b = h("button", { class: "btn", type: "button" }, rotulo);
    let armado = false;
    b.addEventListener("click", function () {
      if (armado) { acao(); return; }
      armado = true; b.textContent = rotuloConfirmar; b.style.color = "var(--bad)";
      setTimeout(function () { armado = false; b.textContent = rotulo; b.style.color = ""; }, 4000);
    });
    return b;
  }
  function novaAula() {
    const box = h("div", { class: "stack-lg" });
    const texto = h("textarea", { id: "material-aula", placeholder: "Cole aqui as anotações da aula: frases, palavras novas, correções da professora, o tema da conversa…" });
    const status = h("div");
    const json = h("textarea", { id: "json-aula", placeholder: "{ \"id\": \"u4\", \"titulo\": \"…\", \"blocos\": [ … ] }" });
    box.appendChild(h("div", { class: "stack" }, h("button", { class: "btn fantasma", type: "button", style: "justify-self:start", onclick: function () { ir("aulas"); } }, "← Aulas"),
      h("h2", { text: "Adicionar aula nova" }),
      h("p", { class: "muted", text: "Duas formas. A mais simples: mande o material da aula para o Claude no projeto, que ele atualiza o site para os dois perfis. Ou gere aqui mesmo com a IA; nesse caso a aula fica salva só neste aparelho." })));
    box.appendChild(h("div", { class: "card" },
      h("h3", { text: "Gerar com a IA" }),
      h("label", { class: "campo", for: "material-aula" }, "Anotações da aula", texto),
      h("button", { class: "btn cheio", type: "button", disabled: !IA.temChave(), onclick: async function () {
        if (!texto.value.trim()) return;
        status.innerHTML = ""; status.appendChild(h("p", { class: "muted", text: "Criando frases, diálogos e situações… pode levar uns 20 segundos." }));
        try {
          const aula = await IA.gerarAula(texto.value.trim(), "a" + Date.now().toString(36));
          previa(aula);
        } catch (e) { status.innerHTML = ""; status.appendChild(h("div", { class: "aviso", text: e.message })); }
      } }, "Gerar exercícios"),
      !IA.temChave() ? h("p", { class: "small muted", text: "Configure a chave da IA em Ajustes para usar esta opção." }) : null,
      status));
    box.appendChild(h("details", { class: "card" }, h("summary", { text: "Colar uma aula pronta (formato do Claude)" }),
      h("p", { class: "small muted", text: "Se o Claude te mandar uma aula em texto começando com {, cole aqui." }), json,
      h("button", { class: "btn", type: "button", onclick: function () {
        try { const a = JSON.parse(json.value); if (!a.id || !a.titulo) throw new Error("Faltam id ou título."); Dados.adicionarAula(a); toast("Aula adicionada"); ir("aulas"); }
        catch (e) { status.innerHTML = ""; status.appendChild(h("div", { class: "aviso", text: "Não consegui ler: " + e.message })); window.scrollTo(0, 0); }
      } }, "Adicionar")));
    function previa(aula) {
      status.innerHTML = "";
      status.appendChild(h("div", { class: "stack" },
        h("h3", { text: aula.titulo }), h("p", { class: "small muted", text: aula.resumo }),
        h("div", { class: "lista" }, aula.blocos.map(function (b) { return h("div", { class: "item" }, h("b", { text: b.en }), h("span", { class: "small muted", text: b.pt })); })),
        h("p", { class: "small muted", text: aula.dialogos.length + " diálogos, " + aula.cenas.length + " situações de conversa, " + aula.diario.length + " perguntas para o diário." }),
        h("div", { class: "row" }, h("button", { class: "btn cheio", type: "button", onclick: function () { Dados.adicionarAula(aula); toast("Aula adicionada", true); ir("aulas"); } }, "Salvar aula"))));
    }
    $app.appendChild(box);
  }

  // =====================================================================
  // AJUSTES
  // =====================================================================
  function telaAjustes() {
    const p = Dados.perfil();
    const cfg = Dados.config();
    const box = h("div", { class: "stack-lg" }, h("h2", { text: "Ajustes" }));

    box.appendChild(h("div", { class: "card" },
      h("div", { class: "row" }, h("span", { class: "avatar grande", style: "background:" + p.cor, text: p.nome.charAt(0).toUpperCase() }), h("div", {}, h("b", { text: p.nome }), h("div", { class: "small muted", text: "Perfil desde " + (p.criado || "").split("-").reverse().join("/") }))),
      h("button", { class: "btn cheio", type: "button", onclick: function () { Dados.sair(); ir("hoje"); } }, "Trocar de perfil")));
    box.appendChild(formPerfil(p));

    // IA
    const chave = h("input", { type: "password", id: "chave-ia", placeholder: "Cole a chave aqui", value: cfg.chave, autocomplete: "off" });
    const st = h("p", { class: "small", text: cfg.chave ? "Configurada. Modelo: " + (cfg.modelo || "a definir") : "" });
    box.appendChild(h("div", { class: "card conversa" },
      h("h3", { text: "Conversa com IA (gratuita)" }),
      h("ol", { class: "small", style: "margin:0;padding-left:20px" },
        h("li", {}, "Abra o ", h("a", { href: "https://aistudio.google.com/apikey", target: "_blank", rel: "noopener", text: "Google AI Studio" }), " e entre com a sua conta Google."),
        h("li", { text: "Toque em \"Create API key\" e copie a chave." }),
        h("li", { text: "Cole abaixo e toque em Salvar." })),
      h("label", { class: "campo", for: "chave-ia" }, "Chave do Google AI Studio", chave),
      h("div", { class: "row" },
        h("button", { class: "btn cheio", type: "button", onclick: async function () {
          const k = chave.value.trim();
          if (!k) { Dados.salvarConfig({ chave: "", modelo: "", modeloReserva: "" }); st.textContent = "Chave removida."; return; }
          st.textContent = "Testando…";
          try { const m = await IA.configurar(k); st.textContent = "Funcionando. Modelo: " + m.principal; }
          catch (e) { st.textContent = e.message; }
        } }, "Salvar e testar")),
      st,
      h("p", { class: "small muted", text: "A chave fica salva só neste aparelho e vale para os dois perfis. O plano gratuito tem limite de uso por minuto e por dia, suficiente para praticar. Só o texto da conversa vai para o Google; no plano gratuito, o Google pode usar esse texto para melhorar os produtos dele, então não fale dados pessoais sensíveis." })));

    // pronúncia
    const modoP = h("select", { id: "modo-pronuncia" },
      h("option", { value: "local", text: "Pelo áudio, com modelo no navegador (recomendado)" }),
      h("option", { value: "rapido", text: "Rápida, pelo reconhecimento de texto do Chrome" }));
    modoP.value = Pronuncia.modo();
    modoP.addEventListener("change", function () { Dados.salvarConfig({ pronuncia: modoP.value }); toast("Modo de pronúncia atualizado"); });
    const stModelo = h("p", { class: "small", text: Pronuncia.modeloPronto() ? "Modelo carregado e pronto." : Pronuncia.modeloJaBaixado() ? "Modelo já baixado neste aparelho. Ele carrega em alguns segundos quando você pratica." : "Modelo ainda não baixado neste aparelho." });
    const btnModelo = h("button", { class: "btn", type: "button", onclick: function () {
      btnModelo.disabled = true;
      Pronuncia.carregarModelo(function (p) { stModelo.textContent = p.fase === "baixando" ? "Baixando: " + p.pct + "% de " + p.mb + " MB" : "Preparando…"; })
        .then(function () { stModelo.textContent = "Modelo carregado e pronto."; })
        .catch(function (e) { stModelo.textContent = "Não consegui baixar o modelo: " + e.message; btnModelo.disabled = false; });
    } }, Pronuncia.modeloJaBaixado() ? "Carregar modelo agora" : "Baixar modelo agora (355 MB)");
    box.appendChild(h("div", { class: "card blocos" }, h("h3", { text: "Avaliação de pronúncia" }),
      h("label", { class: "campo", for: "modo-pronuncia" }, "Como avaliar", modoP),
      h("p", { class: "small muted", text: "Pelo áudio: um modelo roda no seu navegador, ouve os sons que você produziu (sem adivinhar palavras) e compara com a pronúncia do dicionário, som por som. Sua voz não sai do aparelho e não fica salva. Ele não avalia entonação. O download é feito uma vez por aparelho; prefira Wi-Fi e computador." }),
      h("div", { class: "row" }, btnModelo), stModelo));

    // voz e meta
    const vel = h("select", { id: "velocidade" }, [[0.7, "Devagar"], [0.9, "Normal"], [1, "Rápida"]].map(function (v) { return h("option", { value: v[0], text: v[1] }); }));
    vel.value = String(cfg.velocidade);
    vel.addEventListener("change", function () { Dados.salvarConfig({ velocidade: parseFloat(vel.value) }); });
    const sot = h("select", { id: "sotaque" }, [["en-US", "Americano"], ["en-GB", "Britânico"]].map(function (v) { return h("option", { value: v[0], text: v[1] }); }));
    sot.value = cfg.sotaque;
    sot.addEventListener("change", function () { Dados.salvarConfig({ sotaque: sot.value }); location.reload(); });
    const meta = h("select", { id: "meta" }, [[60, "Leve: 60 XP (cerca de 10 min)"], [120, "Normal: 120 XP (cerca de 20 min)"], [200, "Intensa: 200 XP (cerca de 35 min)"]].map(function (v) { return h("option", { value: v[0], text: v[1] }); }));
    meta.value = String(p.metaDiaria);
    meta.addEventListener("change", function () { p.metaDiaria = parseInt(meta.value, 10); Dados.salvar(); toast("Meta atualizada"); });
    box.appendChild(h("div", { class: "card" }, h("h3", { text: "Voz e meta" }),
      h("label", { class: "campo", for: "velocidade" }, "Velocidade da voz", vel),
      h("label", { class: "campo", for: "sotaque" }, "Sotaque", sot),
      h("label", { class: "campo", for: "meta" }, "Meta diária deste perfil", meta)));

    // cópia de segurança
    const arquivo = h("input", { type: "file", id: "arquivo-copia", accept: "application/json,.json", hidden: true });
    const stCopia = h("p", { class: "small" });
    arquivo.addEventListener("change", function () {
      const f = arquivo.files[0]; if (!f) return;
      const leitor = new FileReader();
      leitor.onload = function () { try { Dados.importar(JSON.parse(leitor.result)); stCopia.textContent = "Cópia restaurada."; desenharTopo(); } catch (e) { stCopia.textContent = "Não consegui restaurar: " + e.message; } };
      leitor.readAsText(f);
    });
    box.appendChild(h("div", { class: "card" }, h("h3", { text: "Seus dados" }),
      h("p", { class: "small muted", text: "O progresso fica salvo neste navegador, separado por perfil. Nenhum áudio é guardado. Faça uma cópia de vez em quando: se o navegador for limpo, é ela que recupera tudo." }),
      h("div", { class: "row" },
        h("button", { class: "btn", type: "button", onclick: function () {
          const blob = new Blob([JSON.stringify(Dados.exportar(), null, 1)], { type: "application/json" });
          const a = h("a", { href: URL.createObjectURL(blob), download: "treino-de-fala-copia-" + Dados.hoje() + ".json" });
          document.body.appendChild(a); a.click(); a.remove();
          stCopia.textContent = "Cópia baixada.";
        } }, "Baixar cópia"),
        h("button", { class: "btn", type: "button", onclick: function () { arquivo.click(); } }, "Restaurar cópia")),
      arquivo, stCopia,
      h("div", { class: "row" }, botaoConfirmar("Excluir este perfil", "Toque de novo para excluir " + p.nome, function () { Dados.excluirPerfil(p.id); ir("hoje"); }))));
    $app.appendChild(box);
  }

  // ---------- início ----------
  window.__teste = { h: h };
  render();
})();
