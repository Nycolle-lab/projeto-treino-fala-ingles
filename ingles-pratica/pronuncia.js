// Avaliação de pronúncia.
// Modo "local": grava a voz, roda no próprio navegador um modelo que ouve os SONS (fonemas) que você produziu,
// sem tentar adivinhar palavras, e compara com a pronúncia de referência do dicionário CMU.
// Modo "rapido": usa o reconhecimento de voz do Chrome (texto) e compara palavras.
// Nenhum áudio é salvo: a gravação fica na memória só até a avaliação terminar.
(function () {
  "use strict";

  const TRANSFORMERS = "https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.3.1/dist/transformers.min.js";
  const MODELO = "robg/speako-phoneme-recognizer";
  const DICIONARIO_COMPLETO = "https://cdn.jsdelivr.net/npm/cmu-pronouncing-dictionary@3.0.0/index.js";
  const SIMBOLOS = ["aɪ", "aʊ", "eɪ", "oʊ", "ɔɪ", "b", "d", "f", "g", "h", "i", "j", "k", "l", "m", "n", "p", "s", "t", "u", "v", "w", "z", "æ", "ð", "ŋ", "ɑ", "ə", "ɛ", "ɝ", "ɪ", "ɹ", "ɾ", "ʃ", "ʊ", "ʤ", "ʧ", "θ"];
  const VOGAIS = new Set(["aɪ", "aʊ", "eɪ", "oʊ", "ɔɪ", "i", "u", "æ", "ɑ", "ə", "ɛ", "ɝ", "ɪ", "ʊ"]);

  // ---------- modo ----------
  function modo() { return (Dados.config().pronuncia) || "local"; }
  function microfoneDisponivel() { return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia); }
  function disponivel() { return modo() === "local" ? microfoneDisponivel() : Voz.disponivel; }

  // ---------- modelo ----------
  let asr = null;
  let carregando = null;
  function carregarModelo(aoProgresso) {
    if (asr) return Promise.resolve(asr);
    if (carregando) return carregando;
    carregando = (async function () {
      const t = await import(TRANSFORMERS);
      const arquivos = {};
      const p = await t.pipeline("automatic-speech-recognition", MODELO, {
        dtype: "q8",
        device: "wasm",
        progress_callback: function (ev) {
          if (!aoProgresso) return;
          if (ev.status === "progress" && ev.total) {
            arquivos[ev.file] = { carregado: ev.loaded, total: ev.total };
            let c = 0, tot = 0;
            Object.keys(arquivos).forEach(function (k) { c += arquivos[k].carregado; tot += arquivos[k].total; });
            aoProgresso({ fase: "baixando", pct: Math.round(100 * c / tot), mb: Math.round(tot / 1048576) });
          } else if (ev.status === "ready") aoProgresso({ fase: "pronto" });
        }
      });
      asr = p;
      Dados.salvarConfig({ modeloBaixado: true });
      return p;
    })();
    carregando.catch(function () { carregando = null; });
    return carregando;
  }
  function modeloPronto() { return !!asr; }
  function modeloJaBaixado() { return !!Dados.config().modeloBaixado; }

  // ---------- gravação (16 kHz, mono, só na memória) ----------
  function gravar(opcoes) {
    opcoes = opcoes || {};
    let parar = function () {};
    const promessa = new Promise(function (resolve, reject) {
      navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true } }).then(function (stream) {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        let ctx;
        try { ctx = new Ctx({ sampleRate: 16000 }); } catch (e) { ctx = new Ctx(); }
        const fonte = ctx.createMediaStreamSource(stream);
        const proc = ctx.createScriptProcessor(4096, 1, 1);
        const pedacos = [];
        let falou = false, silencioDesde = 0, terminou = false;
        const inicio = Date.now();
        proc.onaudioprocess = function (ev) {
          const d = ev.inputBuffer.getChannelData(0);
          pedacos.push(new Float32Array(d));
          let soma = 0; for (let i = 0; i < d.length; i++) soma += d[i] * d[i];
          const rms = Math.sqrt(soma / d.length);
          if (opcoes.aoVolume) opcoes.aoVolume(Math.min(1, rms * 8));
          const agora = Date.now();
          if (rms > 0.02) { falou = true; silencioDesde = 0; }
          else if (falou) { if (!silencioDesde) silencioDesde = agora; if (agora - silencioDesde > 1300) fim(); }
          if (agora - inicio > (opcoes.maxMs || 12000)) fim();
          if (!falou && agora - inicio > 7000) fim();
        };
        fonte.connect(proc); proc.connect(ctx.destination);
        function fim() {
          if (terminou) return; terminou = true;
          proc.disconnect(); fonte.disconnect();
          stream.getTracks().forEach(function (tr) { tr.stop(); });
          const total = pedacos.reduce(function (s, p) { return s + p.length; }, 0);
          const audio = new Float32Array(total);
          let o = 0; pedacos.forEach(function (p) { audio.set(p, o); o += p.length; });
          const taxa = ctx.sampleRate;
          ctx.close();
          if (!falou) { reject(new Error("Não ouvi nada. Fale logo depois de tocar no botão, perto do microfone.")); return; }
          resolve({ audio: taxa === 16000 ? audio : reamostrar(audio, taxa, 16000), segundos: (Date.now() - inicio) / 1000 });
        }
        parar = fim;
      }).catch(function () { reject(new Error("O navegador bloqueou o microfone. Libere o microfone para este site.")); });
    });
    return { parar: function () { parar(); }, promessa: promessa };
  }
  function reamostrar(dados, de, para) {
    const fator = de / para, n = Math.floor(dados.length / fator), out = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const ini = Math.floor(i * fator), fimI = Math.min(dados.length, Math.floor((i + 1) * fator));
      let s = 0; for (let k = ini; k < fimI; k++) s += dados[k];
      out[i] = s / Math.max(1, fimI - ini);
    }
    return out;
  }
  function cortarSilencio(audio) {
    const janela = 320; let ini = 0, fim = audio.length;
    const energia = function (a) { let s = 0; for (let k = a; k < Math.min(audio.length, a + janela); k++) s += audio[k] * audio[k]; return Math.sqrt(s / janela); };
    while (ini < audio.length && energia(ini) < 0.01) ini += janela;
    while (fim > ini && energia(fim - janela) < 0.01) fim -= janela;
    ini = Math.max(0, ini - 3200); fim = Math.min(audio.length, fim + 3200);
    return audio.subarray(ini, fim);
  }

  // ---------- dicionário ----------
  let dicCompleto = null;
  const ARPA = { AA: "ɑ", AE: "æ", AH: "ə", AO: "ɑ", AW: "aʊ", AY: "aɪ", B: "b", CH: "ʧ", D: "d", DH: "ð", EH: "ɛ", ER: "ɝ", EY: "eɪ", F: "f", G: "g", HH: "h", IH: "ɪ", IY: "i", JH: "ʤ", K: "k", L: "l", M: "m", N: "n", NG: "ŋ", OW: "oʊ", OY: "ɔɪ", P: "p", R: "ɹ", S: "s", SH: "ʃ", T: "t", TH: "θ", UH: "ʊ", UW: "u", V: "v", W: "w", Y: "j", Z: "z", ZH: "ʃ" };
  function deArpa(s) { return s.split(" ").map(function (p) { const m = p.match(/^([A-Z]+)(\d)?$/); return (ARPA[m[1]] || "") + (m[2] === "0" ? "~" : ""); }).join(" "); }
  function normalizarPalavra(w) { return w.toLowerCase().replace(/[’‘`]/g, "'").replace(/^[^\p{L}']+|[^\p{L}']+$/gu, ""); }
  async function variantes(palavra) {
    const w = normalizarPalavra(palavra);
    if (!w || /[^a-z']/.test(w)) return null; // nomes com acento, números etc. ficam de fora
    if (window.PRONUNCIAS && window.PRONUNCIAS[w]) return window.PRONUNCIAS[w];
    if (!dicCompleto) {
      try { dicCompleto = (await import(DICIONARIO_COMPLETO)).dictionary; } catch (e) { dicCompleto = {}; }
    }
    const v = [];
    [w, w + "(2)", w + "(3)", w + "(4)"].forEach(function (k) { if (dicCompleto[k]) v.push(deArpa(dicCompleto[k])); });
    return v.length ? v : null;
  }

  // ---------- comparação de fonemas ----------
  function tokenizar(texto) {
    const out = [];
    const s = String(texto || "").replace(/[|\s]+/g, "");
    let i = 0;
    while (i < s.length) {
      const dois = s.slice(i, i + 2);
      if (SIMBOLOS.indexOf(dois) >= 0) { out.push(dois); i += 2; }
      else if (SIMBOLOS.indexOf(s[i]) >= 0) { out.push(s[i]); i += 1; }
      else i += 1;
    }
    return out;
  }
  const PARECIDOS = [["ɪ", "i"], ["ʊ", "u"], ["ɾ", "t"], ["ɾ", "d"], ["ɝ", "ɹ"], ["ə", "ɝ"], ["ɑ", "ə"], ["ɛ", "æ"], ["eɪ", "ɛ"], ["oʊ", "ɑ"], ["z", "s"]];
  function parecido(a, b) { return PARECIDOS.some(function (p) { return (p[0] === a && p[1] === b) || (p[1] === a && p[0] === b); }); }
  // custo de trocar o esperado (e) pelo ouvido (o)
  function custo(e, o) {
    const fon = e.f;
    if (fon === o) return 0;
    if (e.atono && VOGAIS.has(o) && (fon === "ə" || fon === "ɪ" || o === "ə" || o === "ɪ")) return 0.2; // vogal átona reduzida é normal
    if (parecido(fon, o)) return 0.45;
    if (VOGAIS.has(fon) && VOGAIS.has(o)) return 0.8;
    return 1;
  }
  function alinhar(ref, ouv) {
    const n = ref.length, m = ouv.length;
    const D = Array.from({ length: n + 1 }, function () { return new Float32Array(m + 1); });
    const del = function (e) { return e.atono ? 0.6 : 1; };
    for (let i = 1; i <= n; i++) D[i][0] = D[i - 1][0] + del(ref[i - 1]);
    for (let j = 1; j <= m; j++) D[0][j] = j * 0.7;
    for (let i = 1; i <= n; i++) for (let j = 1; j <= m; j++) {
      D[i][j] = Math.min(D[i - 1][j - 1] + custo(ref[i - 1], ouv[j - 1]), D[i - 1][j] + del(ref[i - 1]), D[i][j - 1] + 0.7);
    }
    // caminho
    const pares = []; let i = n, j = m;
    while (i > 0 || j > 0) {
      if (i > 0 && j > 0 && Math.abs(D[i][j] - (D[i - 1][j - 1] + custo(ref[i - 1], ouv[j - 1]))) < 1e-4) { pares.unshift({ ref: i - 1, ouv: j - 1 }); i--; j--; }
      else if (i > 0 && Math.abs(D[i][j] - (D[i - 1][j] + del(ref[i - 1]))) < 1e-4) { pares.unshift({ ref: i - 1, ouv: null }); i--; }
      else { pares.unshift({ ref: null, ouv: j - 1 }); j--; }
    }
    return { custo: D[n][m], pares: pares };
  }
  function montarRef(palavras, escolha) {
    const ref = [];
    palavras.forEach(function (p, k) {
      if (!p.variantes) return;
      p.variantes[escolha[k]].split(" ").forEach(function (x) {
        ref.push({ f: x.replace("~", ""), atono: x.indexOf("~") >= 0, palavra: k });
      });
    });
    return ref;
  }

  async function analisar(frase, ipaOuvido) {
    const pedacos = frase.split(/\s+/).filter(Boolean);
    const palavras = await Promise.all(pedacos.map(async function (p) {
      const lacuna = /_{2,}/.test(p);
      return { texto: p, variantes: lacuna ? null : await variantes(p), lacuna: lacuna };
    }));
    const ouv = tokenizar(ipaOuvido);
    const escolha = palavras.map(function () { return 0; });
    // escolhe a melhor variante de cada palavra (ex.: "to" como /tu/ ou /tə/)
    for (let k = 0; k < palavras.length; k++) {
      if (!palavras[k].variantes || palavras[k].variantes.length < 2) continue;
      let melhor = escolha[k], melhorCusto = Infinity;
      for (let v = 0; v < palavras[k].variantes.length; v++) {
        escolha[k] = v;
        const c = alinhar(montarRef(palavras, escolha), ouv).custo;
        if (c < melhorCusto - 1e-6) { melhorCusto = c; melhor = v; }
      }
      escolha[k] = melhor;
    }
    const ref = montarRef(palavras, escolha);
    const al = alinhar(ref, ouv);
    palavras.forEach(function (p) { p.fonemas = []; p.extras = []; });
    let ultimaPalavra = 0;
    const ultimoDaPalavra = {};
    ref.forEach(function (e, idx) { ultimoDaPalavra[e.palavra] = idx; });
    let ultimoRef = -1;
    al.pares.forEach(function (par) {
      if (par.ref == null) {
        // sons depois de uma palavra completa, quando a próxima é uma lacuna (___), pertencem à lacuna
        const proxima = palavras[ultimaPalavra + 1];
        if (ultimoRef === ultimoDaPalavra[ultimaPalavra] && proxima && proxima.lacuna) return;
      }
      if (par.ref != null) {
        const e = ref[par.ref];
        ultimaPalavra = e.palavra; ultimoRef = par.ref;
        const o = par.ouv != null ? ouv[par.ouv] : null;
        const c = o == null ? (e.atono ? 0.6 : 1) : custo(e, o);
        palavras[e.palavra].fonemas.push({ esperado: e.f, ouvido: o, atono: e.atono, nivel: c <= 0.2 ? "ok" : c < 0.6 ? "mid" : "bad" });
      } else if (palavras[ultimaPalavra]) palavras[ultimaPalavra].extras.push(ouv[par.ouv]);
    });
    let somaP = 0, somaN = 0;
    palavras.forEach(function (p) {
      if (!p.variantes) { p.nota = null; p.nivel = null; return; }
      const pts = p.fonemas.reduce(function (s, f) { return s + (f.nivel === "ok" ? 1 : f.nivel === "mid" ? 0.6 : 0); }, 0);
      const den = p.fonemas.length + Math.min(2, p.extras.length) * 0.5;
      p.nota = den ? Math.round(100 * pts / den) : 0;
      p.nivel = p.nota >= 85 ? "ok" : p.nota >= 60 ? "mid" : "bad";
      somaP += pts; somaN += den;
    });
    const nota = somaN ? Math.round(100 * somaP / somaN) : 0;
    return {
      fonte: "local", nota: nota, nivel: nota >= 85 ? "ok" : nota >= 65 ? "mid" : "bad",
      palavras: palavras, ouvidoIPA: ouv.join(" "), esperadoIPA: ref.map(function (e) { return e.f; }).join(" "),
      dicas: dicas(palavras)
    };
  }

  // ---------- dicas para quem fala português ----------
  const DICA_SOM = {
    "θ": "Som de \"th\" em think: ponta da língua entre os dentes, soprando. Não troque por t, f ou s.",
    "ð": "Som de \"th\" em the: língua entre os dentes, com a voz vibrando. Não troque por d.",
    "h": "O h inicial é um sopro, parecido com o r de \"rato\". Não deixe mudo.",
    "ɹ": "O r americano: dobre a ponta da língua para trás, sem encostar no céu da boca.",
    "æ": "Abra bem a boca, num som entre é e a, como em \"cat\".",
    "ɪ": "Um i curto e relaxado, quase ê, como em \"sit\". Não estique.",
    "i": "Um i longo e sorrindo, como em \"eat\".",
    "ʊ": "Um u curto e relaxado, como em \"good\".",
    "u": "Um u longo, com os lábios arredondados, como em \"food\".",
    "ŋ": "No final \"ng\", o som fica no fundo da boca. Não pronuncie o g no final.",
    "l": "No l do fim da palavra, a língua encosta no céu da boca. Ele não vira u.",
    "m": "Feche os lábios no m do final da palavra.",
    "n": "Termine o n com a língua encostada atrás dos dentes.",
    "t": "Pronuncie o t limpo. Antes de i ele não vira \"tchi\".",
    "d": "Pronuncie o d limpo. Antes de i ele não vira \"dji\".",
    "z": "O z é um s com a voz vibrando, como em \"is\" e \"does\".",
    "ɝ": "O \"er\" americano, como em \"work\": um r longo com a língua dobrada para trás.",
    "v": "Morda levemente o lábio de baixo e vibre, como em \"very\".",
    "w": "Comece com os lábios arredondados, como um u rápido."
  };
  function dicas(palavras) {
    const contagem = {};
    let epentese = 0, finalCortado = 0;
    palavras.forEach(function (p) {
      if (!p.variantes) return;
      p.fonemas.forEach(function (f) { if (f.nivel === "bad" && !f.atono) contagem[f.esperado] = (contagem[f.esperado] || 0) + 1; });
      if (p.extras.some(function (x) { return x === "i" || x === "ɪ" || x === "ə"; })) epentese++;
      const ult = p.fonemas[p.fonemas.length - 1];
      if (ult && !VOGAIS.has(ult.esperado) && ult.ouvido == null) finalCortado++;
    });
    const out = [];
    Object.keys(contagem).sort(function (a, b) { return contagem[b] - contagem[a]; }).forEach(function (f) {
      if (DICA_SOM[f] && out.length < 2) out.push({ som: f, texto: DICA_SOM[f] });
    });
    if (epentese) out.push({ som: "+i", texto: "Não acrescente um i no fim das palavras: \"club\", não \"clubi\"." });
    if (finalCortado && out.length < 3) out.push({ som: "fim", texto: "Pronuncie o último som das palavras, mesmo quando for uma consoante." });
    return out.slice(0, 3);
  }

  // ---------- tentativa completa ----------
  // Retorna { parar, promessa }. aoEstado recebe "baixando" (com pct), "ouvindo", "analisando".
  function tentar(frase, opcoes) {
    opcoes = opcoes || {};
    if (modo() !== "local") return tentarRapido(frase);
    let gravacao = null, cancelado = false;
    const promessa = (async function () {
      if (!asr) {
        if (opcoes.aoEstado) opcoes.aoEstado({ fase: "carregando" });
        await carregarModelo(function (p) { if (opcoes.aoEstado) opcoes.aoEstado(p.fase === "baixando" ? { fase: "baixando", pct: p.pct, mb: p.mb } : { fase: "carregando" }); });
      }
      if (cancelado) throw new Error("Cancelado.");
      if (opcoes.aoEstado) opcoes.aoEstado({ fase: "ouvindo" });
      gravacao = gravar({ aoVolume: opcoes.aoVolume });
      const g = await gravacao.promessa;
      if (opcoes.aoEstado) opcoes.aoEstado({ fase: "analisando" });
      const r = await asr(cortarSilencio(g.audio));
      const res = await analisar(frase, r.text || "");
      res.segundos = g.segundos;
      res.qtdPalavras = frase.split(/\s+/).length;
      return res;
    })();
    return { parar: function () { cancelado = true; if (gravacao) gravacao.parar(); }, promessa: promessa };
  }
  function tentarRapido(frase) {
    const e = Voz.ouvir({ continuo: false });
    const promessa = e.promessa.then(function (r) {
      const av = Voz.avaliar(frase, r.alternativas);
      const palavras = [];
      let k = 0;
      frase.split(/\s+/).filter(Boolean).forEach(function (p) {
        const qtd = Voz.palavras(p).length;
        let ok = true; for (let q = 0; q < qtd; q++) if (!av.marca[k + q]) ok = false;
        k += qtd;
        const lacuna = /_{2,}/.test(p);
        palavras.push({ texto: p, nota: lacuna || !qtd ? null : ok ? 100 : 0, nivel: lacuna || !qtd ? null : ok ? "ok" : "bad", fonemas: [] });
      });
      return { fonte: "rapido", nota: av.nota, nivel: av.nivel, palavras: palavras, texto: av.texto, dicas: [], segundos: r.segundosFala, qtdPalavras: Voz.palavras(r.texto).length };
    });
    return { parar: e.parar, promessa: promessa };
  }

  // ---------- desenho do resultado ----------
  const ROTULO = { ok: "Correto", mid: "Adequado", bad: "Precisa melhorar" };
  function pintarFrase(el, r, h, aoTocar) {
    el.innerHTML = "";
    r.palavras.forEach(function (p, k) {
      if (k) el.appendChild(document.createTextNode(" "));
      const span = h("span", { class: "w" + (p.nivel === "ok" ? " ok" : p.nivel === "mid" ? " meio" : p.nivel === "bad" ? " miss" : ""), text: p.texto });
      if (p.fonemas && p.fonemas.length && aoTocar) {
        span.setAttribute("role", "button"); span.setAttribute("tabindex", "0"); span.style.cursor = "pointer";
        span.addEventListener("click", function () { aoTocar(p); });
      }
      el.appendChild(span);
    });
  }
  function detalhePalavra(p, h) {
    return h("div", { class: "detalhe-palavra" },
      h("div", { class: "between" }, h("b", { text: p.texto }), h("span", { class: "small muted num", text: p.nota + "%" })),
      h("div", { class: "fonemas" }, p.fonemas.map(function (f) {
        return h("span", { class: "fonema " + f.nivel, title: f.ouvido ? "Esperado " + f.esperado + ", ouvido " + f.ouvido : "Esperado " + f.esperado + ", não ouvido" },
          h("b", { text: f.esperado }), h("small", { text: f.nivel === "ok" ? "✓" : f.ouvido ? f.ouvido : "–" }));
      })),
      p.extras && p.extras.length ? h("div", { class: "small muted", text: "Sons a mais: " + p.extras.join(" ") }) : null,
      h("div", { class: "small muted", text: "Em cima, o som esperado. Embaixo, o que o modelo ouviu (✓ = certo, – = faltou)." }));
  }
  function cartao(r, h) {
    const box = h("div", { class: "resultado " + r.nivel },
      h("div", { class: "veredito" }, h("span", { text: ROTULO[r.nivel] }), h("span", { class: "num", text: r.nota + "%" })));
    if (r.fonte === "local") {
      const total = r.palavras.reduce(function (s, p) { return s + (p.fonemas ? p.fonemas.length : 0); }, 0);
      const certos = r.palavras.reduce(function (s, p) { return s + (p.fonemas ? p.fonemas.filter(function (f) { return f.nivel === "ok"; }).length : 0); }, 0);
      box.appendChild(h("div", { class: "small", text: certos + " de " + total + " sons corretos. Toque numa palavra colorida para ver som por som." }));
      r.dicas.forEach(function (d) { box.appendChild(h("div", { class: "dica" }, h("span", { class: "som", text: d.som }), h("span", { text: d.texto }))); });
    } else {
      box.appendChild(h("div", { class: "small", text: "O Chrome entendeu: \"" + r.texto + "\"" }));
    }
    return box;
  }

  window.Pronuncia = {
    modo: modo, disponivel: disponivel, carregarModelo: carregarModelo, modeloPronto: modeloPronto, modeloJaBaixado: modeloJaBaixado,
    tentar: tentar, pintarFrase: pintarFrase, detalhePalavra: detalhePalavra, cartao: cartao,
    _analisar: analisar, _tokenizar: tokenizar
  };
})();
