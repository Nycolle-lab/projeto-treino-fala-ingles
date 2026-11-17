// Voz: ler em voz alta (síntese), ouvir (reconhecimento) e avaliar a pronúncia por palavra.
// O áudio nunca é salvo. O reconhecimento do Chrome transforma a fala em texto e só o texto fica.
(function () {
  "use strict";

  // ---------- falar ----------
  let vozIngles = null;
  function escolherVoz() {
    if (!("speechSynthesis" in window)) return;
    const sotaque = (window.Dados && Dados.config().sotaque) || "en-US";
    const vozes = speechSynthesis.getVoices();
    vozIngles = vozes.find(function (v) { return v.lang === sotaque && /google|natural|samantha|daniel/i.test(v.name); })
      || vozes.find(function (v) { return v.lang === sotaque; })
      || vozes.find(function (v) { return /^en/i.test(v.lang); }) || null;
  }
  if ("speechSynthesis" in window) { escolherVoz(); speechSynthesis.onvoiceschanged = escolherVoz; }

  function falar(texto, velocidade) {
    return new Promise(function (resolve) {
      if (!("speechSynthesis" in window)) { resolve(); return; }
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(texto.replace(/_{2,}/g, "something"));
      u.lang = (window.Dados && Dados.config().sotaque) || "en-US";
      u.rate = velocidade || (window.Dados ? Dados.config().velocidade : 0.9);
      if (vozIngles) u.voice = vozIngles;
      u.onend = resolve; u.onerror = resolve;
      speechSynthesis.speak(u);
    });
  }
  function calar() { if ("speechSynthesis" in window) speechSynthesis.cancel(); }

  // ---------- ouvir ----------
  const Reconhecedor = window.SpeechRecognition || window.webkitSpeechRecognition || null;
  const ERROS = {
    "not-allowed": "O navegador bloqueou o microfone. Libere o microfone para este site nas configurações do Chrome.",
    "service-not-allowed": "O navegador bloqueou o reconhecimento de voz. Libere o microfone para este site.",
    "no-speech": "Não ouvi nada. Fale logo depois de tocar no botão, perto do microfone.",
    "audio-capture": "Não encontrei um microfone.",
    "network": "O reconhecimento de voz precisa de internet."
  };

  // Junta os resultados, corrigindo a repetição que o Chrome do Android às vezes produz.
  function juntar(results) {
    const partes = [];
    for (let i = 0; i < results.length; i++) {
      const t = results[i][0].transcript.trim();
      if (!t) continue;
      const ult = partes[partes.length - 1];
      if (ult && t.toLowerCase().indexOf(ult.toLowerCase()) === 0) partes[partes.length - 1] = t;
      else if (ult && ult.toLowerCase().indexOf(t.toLowerCase()) === 0) { /* ignora repetição menor */ }
      else partes.push(t);
    }
    return partes.join(" ");
  }

  // Sessão de escuta. opcoes: { continuo, aoParcial(texto) }
  // Retorna { parar(), promessa } — a promessa resolve com { texto, alternativas, segundos }.
  function ouvir(opcoes) {
    opcoes = opcoes || {};
    if (!Reconhecedor) return { parar: function () {}, promessa: Promise.reject(new Error("Este navegador não reconhece voz. Use o Google Chrome.")) };
    let rec = null;
    let parado = false;
    let finais = "";
    let alternativas = [];
    let inicio = 0;
    let falando = 0;
    let resolver, rejeitar;
    const promessa = new Promise(function (res, rej) { resolver = res; rejeitar = rej; });

    function iniciar() {
      rec = new Reconhecedor();
      rec.lang = (window.Dados && Dados.config().sotaque) || "en-US";
      rec.interimResults = true;
      rec.maxAlternatives = opcoes.continuo ? 1 : 5;
      rec.continuous = !!opcoes.continuo;
      const anterior = finais;
      rec.onresult = function (ev) {
        const finaisSessao = [];
        let parcial = "";
        for (let i = 0; i < ev.results.length; i++) {
          if (ev.results[i].isFinal) finaisSessao.push(ev.results[i]);
          else parcial += ev.results[i][0].transcript;
        }
        const textoFinal = juntar(finaisSessao);
        finais = (anterior + " " + textoFinal).trim();
        if (!opcoes.continuo && finaisSessao.length) {
          alternativas = [];
          const r = finaisSessao[finaisSessao.length - 1];
          for (let k = 0; k < r.length; k++) alternativas.push(r[k].transcript);
        }
        if (opcoes.aoParcial) opcoes.aoParcial((finais + " " + parcial).trim());
      };
      rec.onerror = function (ev) {
        if (ev.error === "no-speech" && opcoes.continuo && !parado) return; // continua tentando
        if (ev.error === "aborted") return;
        parado = true;
        rejeitar(new Error(ERROS[ev.error] || ("Não consegui ouvir (" + ev.error + ").")));
      };
      rec.onend = function () {
        if (!parado && opcoes.continuo) { try { iniciar(); } catch (e) { terminar(); } return; }
        terminar();
      };
      rec.start();
    }
    function terminar() {
      const segundos = (Date.now() - inicio) / 1000;
      falando = Math.min(segundos, Math.max(1, palavras(finais).length * 0.6));
      if (!finais) { rejeitar(new Error(ERROS["no-speech"])); return; }
      resolver({ texto: finais, alternativas: alternativas.length ? alternativas : [finais], segundos: segundos, segundosFala: falando });
    }
    inicio = Date.now();
    try { iniciar(); } catch (e) { rejeitar(e); }
    return {
      parar: function () { parado = true; try { rec && rec.stop(); } catch (e) { terminar(); } },
      promessa: promessa
    };
  }

  // ---------- avaliar ----------
  const NUMEROS = { "0": "zero", "1": "one", "2": "two", "3": "three", "4": "four", "5": "five", "6": "six", "7": "seven", "8": "eight", "9": "nine", "10": "ten", "11": "eleven", "12": "twelve", "15": "fifteen", "20": "twenty", "30": "thirty" };
  const CONTRACOES = {
    "i'm": "i am", "you're": "you are", "he's": "he is", "she's": "she is", "it's": "it is", "we're": "we are", "they're": "they are",
    "i've": "i have", "you've": "you have", "we've": "we have", "i'll": "i will", "you'll": "you will", "i'd": "i would", "you'd": "you would",
    "don't": "do not", "doesn't": "does not", "didn't": "did not", "can't": "cannot", "won't": "will not", "isn't": "is not", "aren't": "are not",
    "wasn't": "was not", "weren't": "were not", "haven't": "have not", "couldn't": "could not", "wouldn't": "would not", "shouldn't": "should not",
    "what's": "what is", "where's": "where is", "that's": "that is", "there's": "there is", "let's": "let us", "how's": "how is"
  };
  function palavras(texto) {
    const limpo = String(texto || "").toLowerCase().replace(/[’‘`]/g, "'").replace(/_{2,}/g, " ").replace(/[^a-z0-9' ]+/g, " ");
    const saida = [];
    limpo.split(/\s+/).filter(Boolean).forEach(function (w) {
      w = w.replace(/^'+|'+$/g, "");
      if (!w) return;
      if (NUMEROS[w]) w = NUMEROS[w];
      const exp = CONTRACOES[w];
      (exp ? exp.split(" ") : [w]).forEach(function (x) { saida.push(x); });
    });
    for (let i = 0; i < saida.length - 1; i++) if (saida[i] === "can" && saida[i + 1] === "not") saida.splice(i, 2, "cannot");
    return saida;
  }
  function alinhar(alvo, ouvido) {
    const n = alvo.length, m = ouvido.length;
    const t = Array.from({ length: n + 1 }, function () { return new Array(m + 1).fill(0); });
    for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) t[i][j] = alvo[i] === ouvido[j] ? 1 + t[i + 1][j + 1] : Math.max(t[i + 1][j], t[i][j + 1]);
    const marca = new Array(n).fill(false);
    let i = 0, j = 0;
    while (i < n && j < m) {
      if (alvo[i] === ouvido[j]) { marca[i] = true; i++; j++; }
      else if (t[i + 1][j] >= t[i][j + 1]) i++;
      else j++;
    }
    return marca;
  }
  // Frases com ___ aceitam qualquer palavra no lugar da lacuna.
  function avaliar(fraseEn, alternativas) {
    const temLacuna = /_{2,}/.test(fraseEn);
    const alvo = palavras(fraseEn);
    let melhor = null;
    alternativas.forEach(function (alt) {
      const ouvido = palavras(alt);
      const marca = alinhar(alvo, ouvido);
      const acertos = marca.filter(Boolean).length;
      let extras = Math.max(0, ouvido.length - acertos);
      if (temLacuna) extras = Math.max(0, extras - 3);
      const nota = alvo.length ? Math.max(0, Math.min(100, Math.round(100 * (acertos - 0.5 * extras) / alvo.length))) : 0;
      if (!melhor || nota > melhor.nota) melhor = { nota: nota, marca: marca, texto: alt, alvo: alvo };
    });
    melhor.nivel = melhor.nota >= 90 ? "ok" : melhor.nota >= 60 ? "mid" : "bad";
    melhor.faltou = melhor.alvo.filter(function (_, i) { return !melhor.marca[i]; });
    return melhor;
  }

  window.Voz = {
    disponivel: !!Reconhecedor,
    falar: falar, calar: calar, ouvir: ouvir, avaliar: avaliar, palavras: palavras
  };
})();
