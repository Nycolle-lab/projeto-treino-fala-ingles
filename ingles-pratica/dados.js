// Armazenamento local: perfis, progresso, repetição espaçada, pontos e conquistas.
// Nada de áudio é salvo. Só textos, notas e contadores.
(function () {
  "use strict";
  const PREFIXO = "tf:";

  function ler(chave, padrao) {
    try { const v = localStorage.getItem(PREFIXO + chave); return v ? JSON.parse(v) : padrao; } catch (e) { return padrao; }
  }
  function gravar(chave, valor) {
    try { localStorage.setItem(PREFIXO + chave, JSON.stringify(valor)); return true; } catch (e) { return false; }
  }
  function apagar(chave) { try { localStorage.removeItem(PREFIXO + chave); } catch (e) { /* nada */ } }

  function hoje(d) {
    d = d || new Date();
    const z = function (n) { return String(n).padStart(2, "0"); };
    return d.getFullYear() + "-" + z(d.getMonth() + 1) + "-" + z(d.getDate());
  }
  function somarDias(base, n) { const d = new Date(base + "T12:00:00"); d.setDate(d.getDate() + n); return hoje(d); }
  function diasEntre(a, b) { return Math.round((new Date(b + "T12:00:00") - new Date(a + "T12:00:00")) / 86400000); }

  // ---------- conteúdo (aulas fixas + aulas adicionadas neste aparelho) ----------
  function aulas() {
    const extras = ler("aulasExtras", []);
    const ids = new Set();
    return (window.AULAS || []).concat(extras).filter(function (a) { if (ids.has(a.id)) return false; ids.add(a.id); return true; });
  }
  function todosBlocos() {
    const lista = [];
    aulas().forEach(function (a) { (a.blocos || []).forEach(function (b) { lista.push(Object.assign({ aula: a.id, aulaTitulo: a.titulo }, b)); }); });
    return lista;
  }
  function blocoPorId(id) {
    const extras = perfil() ? (perfil().blocosPessoais || []) : [];
    return todosBlocos().concat(extras).find(function (b) { return b.id === id; });
  }
  function adicionarAula(aula) {
    const extras = ler("aulasExtras", []).filter(function (a) { return a.id !== aula.id; });
    extras.push(aula);
    gravar("aulasExtras", extras);
  }
  function removerAula(id) { gravar("aulasExtras", ler("aulasExtras", []).filter(function (a) { return a.id !== id; })); }

  // ---------- perfis ----------
  function perfis() { return ler("perfis", []); }
  function perfilAtualId() { return ler("atual", null); }
  let cache = null;
  function perfil() {
    const id = perfilAtualId();
    if (!id) return null;
    if (cache && cache.id === id) return cache;
    cache = ler("p:" + id, null);
    if (cache) normalizar(cache);
    return cache;
  }
  function normalizar(p) {
    p.xp = p.xp || 0;
    p.dias = p.dias || {};
    p.cartoes = p.cartoes || {};
    p.conquistas = p.conquistas || {};
    p.shadowing = p.shadowing || {};
    p.recontar = p.recontar || [];
    p.conversas = p.conversas || [];
    p.blocosPessoais = p.blocosPessoais || [];
    p.totais = Object.assign({ frases: 0, segundosFala: 0, palavras: 0, turnos: 0, diarios: 0, linhasShadow: 0 }, p.totais || {});
    p.metaDiaria = p.metaDiaria || 120;
  }
  function salvar() { const p = perfil(); if (p) gravar("p:" + p.id, p); }
  function criarPerfil(nome, cor) {
    const id = "p" + Date.now().toString(36);
    const lista = perfis();
    lista.push({ id: id, nome: nome, cor: cor });
    gravar("perfis", lista);
    const p = { id: id, nome: nome, cor: cor, criado: hoje() };
    normalizar(p);
    gravar("p:" + id, p);
    entrar(id);
    return p;
  }
  function entrar(id) { gravar("atual", id); cache = null; }
  function sair() { apagar("atual"); cache = null; }
  function excluirPerfil(id) {
    gravar("perfis", perfis().filter(function (p) { return p.id !== id; }));
    apagar("p:" + id);
    if (perfilAtualId() === id) sair();
  }
  function renomearPerfil(id, nome, cor) {
    gravar("perfis", perfis().map(function (p) { return p.id === id ? Object.assign(p, { nome: nome, cor: cor }) : p; }));
    const p = perfil();
    if (p && p.id === id) { p.nome = nome; p.cor = cor; salvar(); }
  }

  // ---------- dia, sequência e pontos ----------
  function dia(p, d) {
    p = p || perfil();
    d = d || hoje();
    if (!p.dias[d]) p.dias[d] = { xp: 0, segundos: 0, frases: 0, missao: {} };
    p.dias[d].missao = p.dias[d].missao || {};
    return p.dias[d];
  }
  function sequencia(p) {
    p = p || perfil();
    if (!p) return 0;
    const meta = Math.max(20, Math.round(p.metaDiaria / 4));
    let d = hoje();
    let n = 0;
    if (!(p.dias[d] && p.dias[d].xp >= meta)) d = somarDias(d, -1); // hoje ainda pode ser feito
    while (p.dias[d] && p.dias[d].xp >= meta) { n++; d = somarDias(d, -1); }
    return n;
  }
  function bonusSequencia(p) { return Math.min(0.5, sequencia(p) * 0.1); }
  function nivelDe(xp) {
    // Cada nível pede um pouco mais que o anterior: 150, 200, 250...
    let nivel = 1, resto = xp, custo = 150;
    while (resto >= custo) { resto -= custo; nivel++; custo += 50; }
    return { nivel: nivel, atual: resto, proximo: custo };
  }
  const NOMES_NIVEL = ["Primeiras palavras", "Quebrando o gelo", "Conversa curta", "Bate-papo", "Contador de histórias", "Conversa solta", "Falante confiante", "Fluência à vista"];
  function nomeNivel(n) { return NOMES_NIVEL[Math.min(n - 1, NOMES_NIVEL.length - 1)]; }

  const ouvintes = [];
  function aoGanhar(fn) { ouvintes.push(fn); }

  function ganharXP(base, motivo) {
    const p = perfil();
    if (!p) return 0;
    const nivelAntes = nivelDe(p.xp).nivel;
    const d = dia(p);
    const metaAntes = d.xp >= p.metaDiaria;
    const total = Math.round(base * (1 + bonusSequencia(p)));
    p.xp += total;
    d.xp += total;
    const eventos = [{ tipo: "xp", valor: total, motivo: motivo }];
    if (!metaAntes && d.xp >= p.metaDiaria) {
      p.xp += 30; d.xp += 30;
      eventos.push({ tipo: "meta", valor: 30 });
    }
    const nivelDepois = nivelDe(p.xp).nivel;
    if (nivelDepois > nivelAntes) eventos.push({ tipo: "nivel", valor: nivelDepois, nome: nomeNivel(nivelDepois) });
    verificarConquistas(p).forEach(function (c) { eventos.push({ tipo: "conquista", conquista: c }); });
    salvar();
    ouvintes.forEach(function (fn) { fn(eventos); });
    return total;
  }
  function registrarFala(segundos, palavras) {
    const p = perfil(); if (!p) return;
    const d = dia(p);
    d.segundos += Math.round(segundos);
    p.totais.segundosFala += Math.round(segundos);
    p.totais.palavras += palavras || 0;
    salvar();
  }
  function marcarMissao(chave) { const p = perfil(); if (!p) return; dia(p).missao[chave] = true; salvar(); }

  // ---------- repetição espaçada (SM-2 simplificado) ----------
  // nivel: "ok" | "mid" | "bad"
  function revisarCartao(id, nivel, nota) {
    const p = perfil(); if (!p) return;
    const c = p.cartoes[id] || { reps: 0, intervalo: 0, facilidade: 2.5, revisao: hoje(), historico: [] };
    if (nivel === "bad") { c.reps = 0; c.intervalo = 0; c.facilidade = Math.max(1.3, c.facilidade - 0.2); }
    else {
      c.reps += 1;
      if (nivel === "mid") c.facilidade = Math.max(1.3, c.facilidade - 0.08);
      else c.facilidade = Math.min(3, c.facilidade + 0.05);
      if (c.reps === 1) c.intervalo = 1;
      else if (c.reps === 2) c.intervalo = nivel === "ok" ? 3 : 2;
      else c.intervalo = Math.round(c.intervalo * (nivel === "ok" ? c.facilidade : 1.3));
    }
    c.revisao = somarDias(hoje(), c.intervalo);
    c.historico = (c.historico || []).concat([{ d: hoje(), nota: nota }]).slice(-12);
    p.cartoes[id] = c;
    p.totais.frases += 1;
    dia(p).frases += 1;
    salvar();
  }
  function estadoCartao(id) {
    const p = perfil();
    const c = p && p.cartoes[id];
    if (!c) return "novo";
    if (c.intervalo >= 14) return "dominado";
    if (c.revisao <= hoje()) return "revisar";
    return "aprendendo";
  }
  function filaDoDia(limiteNovos) {
    const p = perfil(); if (!p) return [];
    const todos = todosBlocos().concat(p.blocosPessoais);
    const vencidos = todos.filter(function (b) { const c = p.cartoes[b.id]; return c && c.revisao <= hoje(); });
    vencidos.sort(function (a, b) { return p.cartoes[a.id].revisao < p.cartoes[b.id].revisao ? -1 : 1; });
    const novos = todos.filter(function (b) { return !p.cartoes[b.id]; }).slice(0, limiteNovos == null ? 5 : limiteNovos);
    return vencidos.concat(novos);
  }
  function adicionarBlocoPessoal(en, pt, origem) {
    const p = perfil(); if (!p) return null;
    const ja = p.blocosPessoais.find(function (b) { return b.en.trim().toLowerCase() === en.trim().toLowerCase(); });
    if (ja) return ja;
    const b = { id: "bp" + Date.now().toString(36) + Math.floor(Math.random() * 1000), en: en, pt: pt || "", aula: "pessoal", aulaTitulo: "Minhas frases", origem: origem || "" };
    p.blocosPessoais.push(b);
    salvar();
    return b;
  }
  function contarDominados(p) {
    p = p || perfil();
    return Object.keys(p.cartoes).filter(function (k) { return p.cartoes[k].intervalo >= 14; }).length;
  }

  // ---------- conquistas ----------
  const CONQUISTAS = [
    { id: "primeira-conversa", titulo: "Primeira conversa", desc: "Termine uma conversa com a IA", teste: function (p) { return p.conversas.length >= 1; } },
    { id: "diario-3", titulo: "Diário em dia", desc: "Faça 3 diários falados", teste: function (p) { return p.totais.diarios >= 3; } },
    { id: "turnos-50", titulo: "Falador", desc: "Fale 50 vezes em conversas", teste: function (p) { return p.totais.turnos >= 50; } },
    { id: "seq-3", titulo: "3 dias seguidos", desc: "Pratique 3 dias sem parar", teste: function (p) { return sequencia(p) >= 3; } },
    { id: "seq-7", titulo: "Semana completa", desc: "Pratique 7 dias seguidos", teste: function (p) { return sequencia(p) >= 7; } },
    { id: "seq-30", titulo: "Um mês firme", desc: "Pratique 30 dias seguidos", teste: function (p) { return sequencia(p) >= 30; } },
    { id: "blocos-10", titulo: "10 blocos dominados", desc: "Leve 10 frases a 2 semanas de intervalo", teste: function (p) { return contarDominados(p) >= 10; } },
    { id: "blocos-30", titulo: "30 blocos dominados", desc: "Leve 30 frases a 2 semanas de intervalo", teste: function (p) { return contarDominados(p) >= 30; } },
    { id: "shadow-5", titulo: "Eco", desc: "Complete 5 diálogos no shadowing", teste: function (p) { return Object.keys(p.shadowing).filter(function (k) { return p.shadowing[k].vezes >= 1; }).length >= 5 || Object.values(p.shadowing).reduce(function (s, x) { return s + x.vezes; }, 0) >= 5; } },
    { id: "recontar-mais", titulo: "Mais rápido", desc: "Fale 20% mais palavras por minuto na última rodada do recontar", teste: function (p) { return p.recontar.some(function (r) { return r.ganho >= 20; }); } },
    { id: "fala-30", titulo: "30 minutos falando", desc: "Some 30 minutos de fala no total", teste: function (p) { return p.totais.segundosFala >= 1800; } },
    { id: "fala-120", titulo: "2 horas falando", desc: "Some 2 horas de fala no total", teste: function (p) { return p.totais.segundosFala >= 7200; } },
    { id: "nivel-5", titulo: "Nível 5", desc: "Chegue ao nível 5", teste: function (p) { return nivelDe(p.xp).nivel >= 5; } }
  ];
  function verificarConquistas(p) {
    const novas = [];
    CONQUISTAS.forEach(function (c) {
      if (!p.conquistas[c.id] && c.teste(p)) { p.conquistas[c.id] = hoje(); novas.push(c); }
    });
    return novas;
  }

  // ---------- configurações do aparelho (chave de IA etc.) ----------
  function config() { return Object.assign({ chave: "", modelo: "", velocidade: 0.9, sotaque: "en-US" }, ler("config", {})); }
  function salvarConfig(c) { gravar("config", Object.assign(config(), c)); }

  // ---------- cópia de segurança ----------
  function exportar() {
    const dump = { versao: 1, exportado: new Date().toISOString(), perfis: perfis(), dados: {}, aulasExtras: ler("aulasExtras", []) };
    perfis().forEach(function (p) { dump.dados[p.id] = ler("p:" + p.id, null); });
    return dump;
  }
  function importar(dump) {
    if (!dump || !Array.isArray(dump.perfis)) throw new Error("Arquivo de cópia inválido.");
    const lista = perfis();
    dump.perfis.forEach(function (p) {
      if (!lista.find(function (x) { return x.id === p.id; })) lista.push(p);
      if (dump.dados && dump.dados[p.id]) gravar("p:" + p.id, dump.dados[p.id]);
    });
    gravar("perfis", lista);
    (dump.aulasExtras || []).forEach(adicionarAula);
    cache = null;
  }
  function pedirPersistencia() {
    try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) { /* nada */ }
  }

  window.Dados = {
    hoje: hoje, somarDias: somarDias, diasEntre: diasEntre,
    aulas: aulas, todosBlocos: todosBlocos, blocoPorId: blocoPorId, adicionarAula: adicionarAula, removerAula: removerAula,
    perfis: perfis, perfil: perfil, criarPerfil: criarPerfil, entrar: entrar, sair: sair, excluirPerfil: excluirPerfil, renomearPerfil: renomearPerfil, salvar: salvar,
    dia: dia, sequencia: sequencia, bonusSequencia: bonusSequencia, nivelDe: nivelDe, nomeNivel: nomeNivel,
    ganharXP: ganharXP, aoGanhar: aoGanhar, registrarFala: registrarFala, marcarMissao: marcarMissao,
    revisarCartao: revisarCartao, estadoCartao: estadoCartao, filaDoDia: filaDoDia, adicionarBlocoPessoal: adicionarBlocoPessoal, contarDominados: contarDominados,
    CONQUISTAS: CONQUISTAS,
    config: config, salvarConfig: salvarConfig,
    exportar: exportar, importar: importar, pedirPersistencia: pedirPersistencia
  };
})();
