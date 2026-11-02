# Tela Limpa

Tela inicial sem propaganda para TV Samsung Tizen (feita para a Crystal UHD
BU8000, 2022). Em vez do Smart Hub cheio de anúncios, a TV mostra só o que
interessa:

- **Relógio e data**
- **Clima de Blumenau/SC**: temperatura atual, condição e máx/mín do dia
  ([Open-Meteo](https://open-meteo.com/), sem chave de API)
- **Próximos 3 jogos do São Paulo**, com campeonato e onde passa (agenda do
  [ge](https://ge.globo.com/sp/futebol/times/sao-paulo/agenda-de-jogos-do-sao-paulo/))
- **Atalhos** para YouTube, Plex e PS5 (entrada HDMI)
- **Modo ambiente** em tela cheia, com dois estilos:
  - *Paisagens*: fotos do dia do Bing, com legenda em português, trocando a cada 20 s
  - *Obra de arte*: pinturas em domínio público do Wikimedia Commons, uma por minuto

É um app web empacotado (`.wgt`): HTML, CSS e JavaScript puro, sem
dependências nem build de front-end.

## Controle remoto

**Tela principal**

| Tecla | Ação |
|---|---|
| ← → | Escolhe o atalho |
| OK | Abre o atalho |
| ↑ | Entra no modo ambiente |
| Voltar | Esconde o app |

**Modo ambiente**

| Tecla | Ação |
|---|---|
| ← → | Imagem anterior / próxima |
| ↑ | Abre o seletor *Paisagens / Obra de arte* (← → escolhe, OK ou ↓ fecha) |
| ↓, OK ou Voltar | Volta para a tela principal |

**PS5 (HDMI)**: Voltar sai da entrada HDMI e volta para a Tela Limpa. Se a TV
não liberar a troca de entrada pelo app, ligar o PS5 com o Anynet+ (HDMI-CEC)
ativo já troca sozinho.

## Arquivos

| Arquivo | O que é |
|---|---|
| `config.xml` | Manifesto Tizen: id `TLimpa0001.TelaLimpa`, perfil `tv-samsung`, privilégios (internet, abrir apps, teclas do controle, janela de TV/HDMI) |
| `index.html` | Estrutura das duas telas (principal e ambiente) |
| `main.js` | Navegação pelo controle, clima, jogos, atalhos, HDMI e modo ambiente |
| `style.css` | Layout fixo em 1920×1080; animações só com `transform`/`opacity` para rodar leve na TV |
| `artes.json` | Lista de pinturas do modo *Obra de arte* (gerada pelo `gerar_artes.py`) |
| `gerar_artes.py` | Script que gera o `artes.json` a partir do Wikimedia Commons (não vai no pacote da TV) |
| `icon.png` | Ícone do app |

## Instalar na TV

Pré-requisitos: [Tizen Studio](https://developer.samsung.com/smarttv/develop/getting-started/setting-up-sdk/installing-tv-sdk.html)
com a extensão de TV Samsung e um certificado Samsung criado no Certificate
Manager.

1. **Ative o modo desenvolvedor na TV**: em *Apps*, digite `12345` no
   controle, ligue *Developer mode* e informe o IP do computador. Reinicie a TV.
2. **Conecte** (troque pelo IP da TV):

   ```bash
   # IP genérico de exemplo: troque pelo IP da sua TV
   sdb connect 192.168.1.50
   ```

3. **Empacote e instale** a partir desta pasta (o `-e` deixa o
   `gerar_artes.py` fora do pacote):

   ```bash
   tizen build-web -e gerar_artes.py -- .
   ```

   ```bash
   tizen package -t wgt -s <perfil-do-certificado> -- .buildResult
   ```

   ```bash
   tizen install -n TelaLimpa.wgt -- .buildResult
   ```

Também dá para fazer tudo pelo Tizen Studio: importar a pasta como projeto web
e usar *Run As > Tizen Web Application*.

## Personalizar

Tudo fica no topo de `main.js` e em `index.html`:

- **Cidade do clima**: latitude/longitude em `CLIMA_URL` e o nome em `.cidade` no `index.html`.
- **Time**: `JOGOS_URL` (página de agenda do ge do time) e o título em `#jogos h2`.
- **Atalhos**: o `data-app` de cada botão é o appId do app na TV. Para descobrir os
  ids, use `python samsung_tv.py apps` (na pasta acima desta).
- **Tempo de troca** das imagens: `FOTO_TEMPO` e `ARTE_TEMPO`.

## Renovar as obras de arte

O `artes.json` vem empacotado com o app. Para gerar uma lista nova (pinturas
"featured" do Wikimedia Commons, proporção perto de 16:9 e ao menos 1920 px de
largura), rode nesta pasta e reinstale o app (só usa a biblioteca padrão do
Python, não precisa instalar nada):

```bash
python gerar_artes.py
```

`--so-limpar` reaplica os filtros no `artes.json` atual sem consultar o Commons.

## Limitações

- A agenda de jogos é lida de um JSON embutido no HTML do ge; se o site mudar,
  essa parte para de funcionar e mostra "Não consegui carregar os jogos.".
- O layout é fixo em 1920×1080 e pensado só para a TV, não para navegador.
- Precisa de internet para clima, jogos e imagens.
