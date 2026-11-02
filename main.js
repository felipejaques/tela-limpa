// Tela Limpa: atalhos para YouTube, Plex e PS5, clima e jogos do São Paulo, sem propaganda.
var TECLA = { ESQ: 37, CIMA: 38, DIR: 39, BAIXO: 40, OK: 13, VOLTAR: 10009 };

// Blumenau - SC
var CLIMA_URL = 'https://api.open-meteo.com/v1/forecast?latitude=-26.9194&longitude=-49.0661' +
  '&current=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min' +
  '&timezone=America%2FSao_Paulo&forecast_days=1';
var JOGOS_URL = 'https://ge.globo.com/sp/futebol/times/sao-paulo/agenda-de-jogos-do-sao-paulo/';
// Fotos do dia do Bing (quase sempre paisagens), com legenda em português.
// O arquivo guarda as últimas ~15; idx=0 e idx=8 trazem 8 cada.
var FOTOS_URLS = [0, 8].map(function (idx) {
  return 'https://www.bing.com/HPImageArchive.aspx?format=js&n=8&mkt=pt-BR&idx=' + idx;
});
var FOTO_TEMPO = 20000; // troca automática a cada 20 s
// Pinturas no formato da TV, escolhidas pelo gerar_artes.py e empacotadas com o app.
var ARTES_URL = 'artes.json';
var ARTE_TEMPO = 60000; // um quadro por minuto, como numa galeria

var botoes = Array.prototype.slice.call(document.querySelectorAll('.atalho'));
var foco = 0;

function aviso(texto) {
  var el = document.getElementById('aviso');
  el.textContent = texto;
  clearTimeout(aviso.t);
  aviso.t = setTimeout(function () { el.textContent = ''; }, 6000);
}

// Troca só a classe do botão que perde e do que ganha o foco: nada de
// percorrer a lista nem recalcular o layout a cada seta.
function focar(i) {
  var novo = (i + botoes.length) % botoes.length;
  botoes[foco].classList.remove('foco');
  botoes[novo].classList.add('foco');
  foco = novo;
}

function baixar(url, ok, erro) {
  var xhr = new XMLHttpRequest();
  xhr.open('GET', url);
  xhr.timeout = 15000;
  xhr.onload = function () {
    // Arquivos do próprio app (artes.json) podem responder com status 0.
    if ((xhr.status >= 200 && xhr.status < 300) || (xhr.status === 0 && xhr.responseText)) ok(xhr.responseText);
    else if (erro) erro(new Error('HTTP ' + xhr.status));
  };
  xhr.onerror = xhr.ontimeout = function () { if (erro) erro(new Error('sem conexão')); };
  xhr.send();
}

function abrirApp(appId, nome) {
  try {
    tizen.application.launch(appId, null, function (e) {
      aviso('Não consegui abrir ' + nome + ': ' + e.message);
    });
  } catch (e) {
    aviso('Não consegui abrir ' + nome + ': ' + e.message);
  }
}

// --- PS5 --------------------------------------------------------------------
// Mostra a primeira entrada HDMI conectada em tela cheia.
// Se a API não estiver liberada, a troca fica por conta do Anynet+ (HDMI-CEC).
function abrirPS5() {
  try {
    tizen.systeminfo.getPropertyValue('VIDEOSOURCE', function (fontes) {
      var hdmi = (fontes.connected || []).filter(function (f) { return f.type === 'HDMI'; });
      if (!hdmi.length) {
        aviso('Nenhum HDMI ligado. Ligue o PS5: com Anynet+ a TV troca sozinha.');
        return;
      }
      tizen.tvwindow.setSource(hdmi[0], function () {
        tizen.tvwindow.show(function () {
          document.body.classList.add('hdmi');
          abrirPS5.ativo = true;
        }, function (e) { aviso('Erro ao mostrar HDMI: ' + e.message); },
        ['0px', '0px', '1920px', '1080px'], 'MAIN');
      }, function (e) { aviso('Erro ao trocar para HDMI: ' + e.message); });
    }, function (e) { aviso('Erro ao ler entradas: ' + e.message); });
  } catch (e) {
    aviso('Troca de entrada indisponível. Ligue o PS5: com Anynet+ a TV troca sozinha.');
  }
}

function fecharPS5() {
  try { tizen.tvwindow.hide(function () {}); } catch (e) {}
  document.body.classList.remove('hdmi');
  abrirPS5.ativo = false;
}

// --- Modo ambiente: imagens em tela cheia ----------------------------------
// ↑ faz a tela principal descer e revela imagens em tela cheia: paisagens (foto
// do dia do Bing) ou obras de arte (artes.json). Duas camadas .foto se alternam
// para o efeito de esmaecer entre as imagens.
var listas = { fotos: [], arte: [] };
var atual = { fotos: -1, arte: -1 };
var camadas = document.querySelectorAll('#paisagem .foto');
var camadaAtiva = 0;
var fotosCarregadasEm = 0;
var legenda = document.getElementById('paisagem-legenda');
var timerLegenda = null;

function embaralhar(lista) {
  for (var i = lista.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1)), t = lista[i];
    lista[i] = lista[j];
    lista[j] = t;
  }
  return lista;
}

function carregarFotos(pronto) {
  var vistas = {}, lista = [], faltam = FOTOS_URLS.length;
  FOTOS_URLS.forEach(function (url) {
    baixar(url, function (txt) {
      JSON.parse(txt).images.forEach(function (im) {
        if (vistas[im.urlbase]) return;
        vistas[im.urlbase] = true;
        lista.push({
          url: 'https://www.bing.com' + im.urlbase + '_1920x1080.jpg',
          legenda: im.copyright.replace(/\s*\(©.*\)\s*$/, '')
        });
      });
      if (--faltam === 0) terminar();
    }, function () { if (--faltam === 0) terminar(); });
  });
  function terminar() {
    if (lista.length) { listas.fotos = lista; fotosCarregadasEm = Date.now(); }
    pronto();
  }
}

// Recarrega a lista uma vez por dia; nas outras vezes, segue de onde parou.
function garantirFotos(pronto) {
  if (listas.fotos.length && Date.now() - fotosCarregadasEm < 24 * 60 * 60 * 1000) return pronto();
  legenda.textContent = 'Carregando paisagens…';
  carregarFotos(function () {
    if (!listas.fotos.length) legenda.textContent = 'Não consegui carregar as fotos.';
    pronto();
  });
}

// Obras do Wikimedia Commons já filtradas para 16:9 e 1920 px; ordem aleatória.
function garantirObras(pronto) {
  if (listas.arte.length) return pronto();
  legenda.textContent = 'Carregando obras…';
  baixar(ARTES_URL, function (txt) {
    listas.arte = embaralhar(JSON.parse(txt).map(function (o) {
      var autor = [o.artista, o.ano].filter(Boolean).join(', ');
      return { url: o.url, legenda: o.titulo + (autor ? ' — ' + autor : '') };
    }));
    pronto();
  }, function () {
    legenda.textContent = 'Não consegui carregar as obras.';
    pronto();
  });
}

// Na arte a legenda aparece por alguns segundos e some, deixando só a pintura.
function mostrarLegenda() {
  ambiente.classList.remove('info-oculta');
  clearTimeout(timerLegenda);
  if (modo === 'arte') timerLegenda = setTimeout(function () { ambiente.classList.add('info-oculta'); }, 8000);
}

// Baixa a imagem antes de mostrar, para a troca ser suave e sem tela preta.
function mostrar(i) {
  var m = modo, lista = listas[m];
  if (!lista.length) return;
  atual[m] = (i + lista.length) % lista.length;
  var f = lista[atual[m]];
  var img = new Image();
  img.onload = function () {
    if (modo !== m || lista[atual[m]] !== f) return; // o usuário já passou para outra
    camadaAtiva = 1 - camadaAtiva;
    camadas[camadaAtiva].style.backgroundImage = 'url("' + f.url + '")';
    camadas[camadaAtiva].classList.add('ativa');
    camadas[1 - camadaAtiva].classList.remove('ativa');
    legenda.textContent = f.legenda;
    mostrarLegenda();
  };
  img.src = f.url;
  // Já deixa a próxima no cache do navegador.
  new Image().src = lista[(atual[m] + 1) % lista.length].url;
}

// --- Modo ambiente: seletor e troca de estilo -------------------------------
// ↑ faz a tela principal descer. No topo aparece o seletor Paisagens / Obra de
// arte; ← → escolhe (já mostrando o estilo), OK ou ↓ fecha o seletor.
var ambiente = document.getElementById('paisagem');
var opcoes = Array.prototype.slice.call(document.querySelectorAll('#seletor .opcao'));
var modo = 'fotos';
var timerAmbiente = null;
var timerSeletor = null;

function seletorAberto() { return ambiente.classList.contains('seletor-aberto'); }

function atualizarDica() {
  document.getElementById('paisagem-dica').textContent = seletorAberto()
    ? '← → escolher estilo · OK confirmar'
    : '← → trocar · ↑ estilo · ↓ voltar';
}

function abrirSeletor() {
  ambiente.classList.add('seletor-aberto');
  atualizarDica();
  // Fecha sozinho se ninguém mexer.
  clearTimeout(timerSeletor);
  timerSeletor = setTimeout(fecharSeletor, 8000);
}

function fecharSeletor() {
  clearTimeout(timerSeletor);
  ambiente.classList.remove('seletor-aberto');
  atualizarDica();
}

function avancar(passo) {
  mostrar(atual[modo] + passo);
  clearInterval(timerAmbiente);
  timerAmbiente = setInterval(function () { avancar(1); }, modo === 'fotos' ? FOTO_TEMPO : ARTE_TEMPO);
}

function comecarModo() {
  clearInterval(timerAmbiente);
  ambiente.classList.toggle('modo-arte', modo === 'arte');
  opcoes.forEach(function (o) { o.classList.toggle('foco', o.dataset.modo === modo); });
  var esperado = modo;
  (modo === 'fotos' ? garantirFotos : garantirObras)(function () {
    if (modo === esperado) avancar(1);
  });
}

function escolherModo(passo) {
  var i = opcoes.map(function (o) { return o.dataset.modo; }).indexOf(modo);
  modo = opcoes[(i + passo + opcoes.length) % opcoes.length].dataset.modo;
  comecarModo();
  abrirSeletor(); // reinicia o tempo para fechar sozinho
}

function entrarPaisagem() {
  document.body.classList.add('paisagem');
  comecarModo();
  abrirSeletor();
}

function sairPaisagem() {
  document.body.classList.remove('paisagem');
  fecharSeletor();
  clearInterval(timerAmbiente);
}

function acionar() {
  var b = botoes[foco];
  if (b.dataset.app) abrirApp(b.dataset.app, b.querySelector('.nome').textContent);
  else abrirPS5();
}

document.addEventListener('keydown', function (e) {
  if (abrirPS5.ativo) {
    if (e.keyCode === TECLA.VOLTAR) fecharPS5();
    return;
  }
  if (document.body.classList.contains('paisagem')) {
    if (seletorAberto()) {
      switch (e.keyCode) {
        case TECLA.ESQ: escolherModo(-1); break;
        case TECLA.DIR: escolherModo(1); break;
        case TECLA.OK:
        case TECLA.BAIXO: fecharSeletor(); break;
        case TECLA.VOLTAR: sairPaisagem(); break;
      }
    } else {
      switch (e.keyCode) {
        case TECLA.ESQ: avancar(-1); break;
        case TECLA.DIR: avancar(1); break;
        case TECLA.CIMA: abrirSeletor(); break;
        case TECLA.BAIXO:
        case TECLA.VOLTAR:
        case TECLA.OK: sairPaisagem(); break;
      }
    }
    e.preventDefault();
    return;
  }
  switch (e.keyCode) {
    case TECLA.ESQ: focar(foco - 1); e.preventDefault(); break;
    case TECLA.DIR: focar(foco + 1); e.preventDefault(); break;
    case TECLA.CIMA: entrarPaisagem(); e.preventDefault(); break;
    case TECLA.OK: acionar(); break;
    case TECLA.VOLTAR:
      try { tizen.application.getCurrentApplication().hide(); } catch (err) {}
      break;
  }
});

// --- Relógio ----------------------------------------------------------------
function doisDigitos(n) { return ('0' + n).slice(-2); }

function relogio() {
  var d = new Date();
  var hora = doisDigitos(d.getHours()) + ':' + doisDigitos(d.getMinutes());
  document.getElementById('relogio').textContent = hora;
  document.getElementById('paisagem-hora').textContent = hora;
  var data = d.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
  document.getElementById('data').textContent = data.charAt(0).toUpperCase() + data.slice(1);
}

// --- Clima ------------------------------------------------------------------
// Códigos WMO do Open-Meteo.
function descreverTempo(c) {
  if (c === 0) return 'Céu limpo';
  if (c <= 2) return 'Parcialmente nublado';
  if (c === 3) return 'Nublado';
  if (c <= 48) return 'Neblina';
  if (c <= 57) return 'Garoa';
  if (c <= 67) return 'Chuva';
  if (c <= 77) return 'Neve';
  if (c <= 82) return 'Pancadas de chuva';
  return 'Tempestade';
}

function atualizarClima() {
  baixar(CLIMA_URL, function (txt) {
    var d = JSON.parse(txt);
    document.getElementById('temp').textContent = Math.round(d.current.temperature_2m) + '°';
    document.getElementById('tempo').textContent = descreverTempo(d.current.weather_code);
    document.getElementById('minmax').textContent =
      'Máx ' + Math.round(d.daily.temperature_2m_max[0]) + '°  ·  Mín ' + Math.round(d.daily.temperature_2m_min[0]) + '°';
  }, function () {
    document.getElementById('tempo').textContent = 'Clima indisponível';
  });
}

// --- Jogos do São Paulo -----------------------------------------------------
// A página de agenda do ge traz os jogos num JSON embutido ("jogos":[...]),
// com as plataformas de transmissão de cada partida.
function extrairArray(txt, chave) {
  var i = txt.indexOf('"' + chave + '":[');
  if (i < 0) return null;
  var ini = txt.indexOf('[', i), nivel = 0, emTexto = false;
  for (var j = ini; j < txt.length; j++) {
    var c = txt[j];
    if (emTexto) {
      if (c === '\\') j++;
      else if (c === '"') emTexto = false;
    } else if (c === '"') emTexto = true;
    else if (c === '[' || c === '{') nivel++;
    else if (c === ']' || c === '}') {
      nivel--;
      if (nivel === 0) return JSON.parse(txt.slice(ini, j + 1));
    }
  }
  return null;
}

var DIAS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

function atualizarJogos() {
  baixar(JOGOS_URL, function (html) {
    var jogos = extrairArray(html, 'jogos') || [];
    var lista = document.getElementById('jogos-lista');
    lista.innerHTML = '';
    jogos.slice(0, 3).forEach(function (g) {
      var p = g.data_realizacao.split('-');
      var dia = new Date(+p[0], +p[1] - 1, +p[2]);
      var canais = ((g.transmissoes || {}).plataformas || [])
        .map(function (t) { return t.nome; })
        .filter(function (n) { return n !== 'Cartola'; }); // Cartola é o fantasy, não transmite

      var card = document.createElement('div');
      card.className = 'jogo';
      card.innerHTML =
        '<div class="quando"></div><div class="times"></div><div class="camp"></div><div class="canais"></div>';
      card.querySelector('.quando').textContent =
        DIAS[dia.getDay()] + ', ' + doisDigitos(dia.getDate()) + '/' + doisDigitos(dia.getMonth() + 1) +
        ' · ' + (g.hora_realizacao || '').slice(0, 5).replace(':', 'h');
      card.querySelector('.times').textContent =
        g.equipe_mandante.nome_popular + ' x ' + g.equipe_visitante.nome_popular;
      card.querySelector('.camp').textContent = (g.campeonato || {}).nome || '';
      card.querySelector('.canais').textContent = canais.length ? canais.join(' · ') : 'Transmissão a definir';
      lista.appendChild(card);
    });
    if (!jogos.length) lista.textContent = 'Sem jogos marcados.';
  }, function () {
    document.getElementById('jogos-lista').textContent = 'Não consegui carregar os jogos.';
  });
}

relogio();
setInterval(relogio, 10000);
atualizarClima();
setInterval(atualizarClima, 30 * 60 * 1000);
atualizarJogos();
setInterval(atualizarJogos, 60 * 60 * 1000);
botoes[0].classList.add('foco');
