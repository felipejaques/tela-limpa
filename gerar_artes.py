#!/usr/bin/env python3
"""
gerar_artes.py — monta artes.json com pinturas para o modo
"Obra de arte" da Tela Limpa.

Fonte: "Featured pictures of paintings" do Wikimedia Commons (seleção curada,
domínio público, alta resolução). Ficam só as obras no formato da TV
(proporção perto de 16:9) e com pelo menos 1920 px de largura, para ocupar a
tela cheia cortando pouco ou nada.

Uso (rode de novo quando quiser renovar a lista e reinstale o app):
    python gerar_artes.py
"""
import html
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

API = "https://commons.wikimedia.org/w/api.php"
RAIZ = "Category:Featured pictures of paintings"
SAIDA = os.path.join(os.path.dirname(os.path.abspath(__file__)), "artes.json")
PROPORCAO = (1.5, 2.05)  # 16:9 = 1.78; nessa faixa o corte na tela fica abaixo de ~15%
PROFUNDIDADE = 2         # categoria raiz > país/museu > artista/acervo
LARGURA_MIN = 1920
UA = {"User-Agent": "TelaLimpa/1.0 (app pessoal de TV; gerar_artes.py)"}


def api(**p):
    """Chama a API com pausa entre pedidos e espera quando o Commons pede (429)."""
    p.update(format="json", origin="*", maxlag="5")
    req = urllib.request.Request(API + "?" + urllib.parse.urlencode(p), headers=UA)
    for espera in (5, 15, 30, 60):
        time.sleep(1)
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                return json.load(r)
        except urllib.error.HTTPError as e:
            if e.code != 429:
                raise
            print(f"  limite do Commons, esperando {espera}s…")
            time.sleep(espera)
    raise RuntimeError("Commons continua limitando; tente mais tarde.")


def miniatura(url):
    """Endereço da versão com 1920 px de largura (o Commons gera sob demanda)."""
    url = url.split("?", 1)[0]  # a API acrescenta ?utm_source=…, que quebra a miniatura
    nome = url.rsplit("/", 1)[1]
    return url.replace("/commons/", "/commons/thumb/", 1) + f"/{LARGURA_MIN}px-{nome}"


def subcategorias(cat):
    r = api(action="query", list="categorymembers", cmtitle=cat, cmtype="subcat", cmlimit="500")
    return [c["title"] for c in r["query"]["categorymembers"]]


def arquivos(cat):
    """Arquivos da categoria com tamanho, endereço e metadados."""
    cont = {}
    while True:
        r = api(action="query", generator="categorymembers", gcmtitle=cat, gcmtype="file",
                gcmlimit="50", prop="imageinfo", iiprop="url|size|extmetadata",
                iiextmetadatafilter="ObjectName|Artist|DateTimeOriginal", **cont)
        yield from (r.get("query") or {}).get("pages", {}).values()
        if "continue" not in r:
            return
        cont = r["continue"]


def texto(meta, chave):
    """Tira HTML e espaços extras dos metadados do Commons."""
    bruto = (meta.get(chave) or {}).get("value", "")
    limpo = html.unescape(re.sub(r"<[^>]+>", " ", bruto))
    return re.sub(r"\s+", " ", limpo).strip()


def ano(s):
    m = re.search(r"\b(1[0-9]{3}|20[0-9]{2})\b", s)
    return m.group(1) if m else ""


def limpar_titulo(t):
    """Tira o lixo que o Commons deixa nos títulos: marcações QS do Wikidata,
    "Original –", e a data/técnica depois do nome ("…, 1893, oil on canvas")."""
    m = re.search(r'(?:title|label) QS:\w+,\w+:"([^"]+)"', t)
    if m:
        t = m.group(1)
    t = re.sub(r"\s*(label|title) QS:.*$", "", t)
    t = re.sub(r"^(English|German|French|Dutch|Italian|Spanish):\s*", "", t)
    t = re.sub(r"^(Original|File)\s*[–-]\s*", "", t)
    t = re.split(r",\s*(?:c\.\s*|ca\.\s*)?1[0-9]{3}|\s*\(1[0-9]{3}", t)[0]
    return t.strip(" ,.–-") or "Sem título"


def e_pintura(o):
    """Fotos de lugares (igrejas, murais, ruas) também caem nessas categorias.
    Pinturas em domínio público são de antes de 1950; fotos recentes, não."""
    return o["ano"] != "" and int(o["ano"]) < 1950


def limpar(obras):
    for o in obras:
        o["titulo"] = limpar_titulo(o["titulo"])
        if "?" in o["url"]:  # listas antigas, geradas antes da correção em miniatura()
            original = o["url"].split("?", 1)[0].replace("/commons/thumb/", "/commons/", 1)
            o["url"] = miniatura(original)
    return [o for o in obras if e_pintura(o)]


def main():
    # --so-limpar: reaplica a limpeza no artes.json existente, sem consultar o Commons.
    if "--so-limpar" in sys.argv:
        with open(SAIDA, encoding="utf-8") as f:
            obras = limpar(json.load(f))
        with open(SAIDA, "w", encoding="utf-8") as f:
            json.dump(obras, f, ensure_ascii=False, indent=1)
        print(f"{len(obras)} obras após a limpeza")
        return

    cats, nivel = [RAIZ], [RAIZ]
    for _ in range(PROFUNDIDADE):
        nivel = [s for c in nivel for s in subcategorias(c) if s not in cats]
        cats += nivel
    print(f"{len(cats)} categorias")
    obras, vistas = [], set()
    for cat in cats:
        for pg in arquivos(cat):
            if pg["title"] in vistas or not pg.get("imageinfo"):
                continue
            vistas.add(pg["title"])
            ii = pg["imageinfo"][0]
            r = ii["width"] / ii["height"]
            if not (PROPORCAO[0] <= r <= PROPORCAO[1]) or ii["width"] < LARGURA_MIN:
                continue
            meta = ii.get("extmetadata") or {}
            titulo = texto(meta, "ObjectName") or pg["title"][5:].rsplit(".", 1)[0]
            obras.append({
                "url": miniatura(ii["url"]),
                "titulo": titulo[:120],
                "artista": texto(meta, "Artist")[:80],
                "ano": ano(texto(meta, "DateTimeOriginal")),
            })
        print(f"{cat[9:]}: {len(obras)} obras até agora")
    obras = limpar(obras)
    with open(SAIDA, "w", encoding="utf-8") as f:
        json.dump(obras, f, ensure_ascii=False, indent=1)
    print(f"\n{len(obras)} obras salvas em {SAIDA}")


if __name__ == "__main__":
    main()
