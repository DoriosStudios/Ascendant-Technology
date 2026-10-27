"""Build the visual review gallery and geometry summary from captured previews."""
import collections
import hashlib
import html
import json
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "docs/previews/ui-polish"


def read(path):
    return json.loads(path.read_text(encoding="utf-8-sig"))


def geometry(path):
    nodes = read(path)["nodes"]
    frames = [n for n in nodes if n.get("type") == "image"
              and n["box"]["w"] >= 100 and n["box"]["h"] >= 160]
    main = next((n for n in reversed(frames) if n["name"] in
                 ["screen", "cryo_chamber_main", "freezer_screen", "bg"]), None)
    if main is None:
        main = next((n for n in frames if n["name"] == "bg_image"), None)
    if main is None:
        main = next((n for n in frames if n["name"] == "background"
                     and n["box"]["w"] >= 176), None)
    side = next((n for n in frames if n["name"] in ["background", "display"]
                 and n["box"]["w"] <= 150 and n is not main), None)
    closes = [n for n in nodes if n.get("type") == "button"
              and n["name"] in ["close", "close_button"]]
    gap = None if main is None or side is None else round(
        main["box"]["x"] - side["box"]["x"] - side["box"]["w"], 2)
    top = None if main is None or side is None else round(
        main["box"]["y"] - side["box"]["y"], 2)
    return {"gap": gap, "top_delta": top, "closes": len(closes)}


def sheets(folder, group, files):
    for start in range(0, len(files), 8):
        batch = files[start:start + 8]
        canvas = Image.new("RGB", (960, 290 * ((len(batch) + 1) // 2)), "#202830")
        draw = ImageDraw.Draw(canvas)
        for i, path in enumerate(batch):
            x, y = i % 2 * 480, i // 2 * 290
            draw.text((x + 8, y + 3), path.stem, fill="white")
            with Image.open(path) as image:
                image.thumbnail((480, 270))
                canvas.paste(image, (x, y + 20))
        canvas.save(OUT / f"{folder}-{group}-{start // 8}.png")


def main():
    cases, metrics, counts, missing = [], {}, {}, collections.Counter()
    for folder, locale in [("final-en", "en_US"), ("final-pt", "pt_BR")]:
        report = read(OUT / folder / "report.json")
        counts[locale] = len(report["cases"])
        for case in report["cases"]:
            machine, mode = case["name"].split("--", 1)
            cases.append({"machine": machine, "mode": mode, "locale": locale,
                          "image": f"{folder}/{case['name']}.png"})
            missing.update(w for w in case["renderWarnings"] if w.startswith("Missing texture:"))
        for group in ["main", "recipes", "info", "io", "upgrade", "special"]:
            modes = [group] if group != "special" else ["generation_tab", "stabilization_tab",
                     "alchemy_aplifying_tab", "progression", "stats", "station_disenchant_tab"]
            files = sorted(p for p in (OUT / folder).glob("*.png")
                           if p.stem.split("--", 1)[1] in modes)
            sheets(folder, group, files)
    for path in sorted((OUT / "final-en").glob("*--main.json")):
        machine = path.stem.split("--")[0]
        metrics[machine] = {"before": geometry(OUT / "before" / path.name), "after": geometry(path)}
    digest = hashlib.sha256((ROOT.parent / "UtilityCraft/RP/ui/ui_core.json").read_bytes()).hexdigest()
    summary = {"counts": counts, "machines": len(metrics), "geometry": metrics,
               "missing_textures": dict(missing), "uc_core_sha256": digest}
    (OUT / "measurements.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")
    table = ["| Tela | Vão antes → depois | Desnível final | Fechar antes → depois |",
             "| --- | ---: | ---: | ---: |"]
    for machine, data in metrics.items():
        a, b = data["before"], data["after"]
        gap = "—" if b["gap"] is None else f"{a['gap']} → {b['gap']} px"
        top = "—" if b["top_delta"] is None else f"{b['top_delta']} px"
        table.append(f"| {machine} | {gap} | {top} | {a['closes']} → {b['closes']} |")
    review = f"""# Polimento visual das UIs do Ascendant Technology

[Abrir a galeria comparativa](index.html) · [Medições](measurements.json)

Revisão de **{len(metrics)} rotas de tela**, incluindo as duas telas técnicas `at_testing` e `manual`.
Foram capturados **{counts['en_US']} estados em inglês** e **{counts['pt_BR']} em português**, em
480×270 pixels de UI (PNG ampliado 2×). As capturas incluem abas, informações, upgrades,
I/O, receitas selecionadas e fim de rolagem onde esses estados existem.

## Alterações

- Displays laterais alinhados com as molduras principais; vão de 2 px e correção do desnível do Dual Siever.
- Apenas um fechamento da tela por máquina, priorizando a aba de receitas/seções. Fechamentos de popups continuam independentes.
- Botões laterais das mesas alinhados; ajuda com fundo escuro, texto legível e rolagem dentro da moldura.
- Legendas de I/O com largura delimitada e altura automática. Catalyst Weaver e Cryo Chamber têm mais espaço para seus modos adicionais.
- Título claro no Cryo Freezer e no Network Center; aba de estatísticas da Refining Table mantém o tema roxo.
- Inventário do Cryo Freezer com células dark cyan e grade nativa completa, como no Cryo Chamber.
- Tutorial da Alchemical Station em escala 0,6; cards de receitas de 34 px, com ícones mais próximos dos títulos.
- Liquifier usa `textures/static/images/liquified_aetherium` e `dark_matter`, imagens quadradas de 16×16 fornecidas pelo UC.
- Caminhos atuais das faces do Seismic Breaker no I/O. O upgrade dimensional do Catalyst usa o ícone existente de alcance como placeholder; sua textura específica não está nos packs.

## Livros de receitas

**Cryo Chamber não tem aba nem livro de receitas.** Seus três modos originais permanecem.

Os livros compartilhados usam `uc.recipe_toggle`, `uc.recipe_panel` e `uc.recipe_slot_overlay`:
grade selecionável e uma receita por vez, adaptada ao espaço lateral de 104×166. Os cards ficam apenas na Alchemical Station.

| Máquina | Receitas |
| --- | ---: |
| Singularity Fabricator | 10 |
| Energizer | 6 |
| Cryo Freezer | 14 |
| Cryo Stabilizer | 6 |
| Industrial Crucible | 10 |
| Vaporworks Processor | 3 |
| Cryofluid Synthesizer | 16 |

O gerador lê os registros existentes. Uma entrada futura de Darloonite carregada continua
omitida porque seu item/ícone não está presente; nenhum registro de fabricação foi alterado.

## Validação e limites

`test-ui-rebuild.mjs` e `test-common-ui-regressions.cjs` verificam resolução dos componentes,
slots, ações nativas, estados de toggle, rolagem e a flag de fechamento. AT Core e UC Core
permanecem inalterados; os ajustes compartilhados são de apresentação em AT Common.

UC Core SHA-256: `{digest}`.

Este é o renderer local Bedrock UI Preview, com dados simulados e uma fonte bitmap aproximada.
O Network Center usa textos ilustrativos: não há produtor de seus labels no BP consultado.
Seu conteúdo dinâmico real ainda precisa de conferência em jogo. A tela técnica `manual`
mantém seu vão/desnível original de 1 px; não é uma máquina funcional revisada.
As texturas vanilla ausentes no mirror reduzido foram carregadas no cache temporário, a partir
do repositório oficial Mojang/bedrock-samples. Os avisos de prototypes `common.checked/unchecked`
já apareciam na base do preview; não são referências novas do AT. A captura não comprova
fontes nativas, foco, mouse, toque ou gamepad no runtime. Falta uma abertura nova das telas
no Minecraft e leitura do content log para aceitar esses comportamentos em jogo.

## Molduras e fechamentos

O vão usa as caixas externas das molduras, com conferência adicional de pixels nos pares corrigidos.
O desnível compara o topo do display com o topo do painel principal. Traços indicam telas sem esse par.

""" + "\n".join(table) + "\n"
    (OUT / "review.md").write_text(review, encoding="utf-8")
    page = """<!doctype html><html lang="pt-BR"><meta charset="utf-8"><title>AT — revisão de UI</title>
<style>body{margin:24px;background:#1b242d;color:#eee;font:16px system-ui}header{position:sticky;top:0;background:#1b242d;padding:12px 0}select{padding:8px;margin:4px;background:#35414d;color:white;border:1px solid #667787}main{display:grid;grid-template-columns:1fr 1fr;gap:16px}img{width:100%;image-rendering:pixelated}small{color:#bac6cf}a{color:#94ccff}figure{margin:0}figcaption{margin:12px 0} @media(max-width:900px){main{grid-template-columns:1fr}}</style>
<h1>Ascendant Technology — polimento da UI</h1><p><a href="review.md">Relatório</a> · <a href="measurements.json">Medições</a></p>
<header><select id="machine"></select><select id="mode"></select><select id="locale"><option value="en_US">English</option><option value="pt_BR">Português</option></select></header>
<p><small>Preview com dados simulados; fonte aproximada. A imagem anterior é em inglês. Clique para abrir em tamanho integral.</small></p>
<main><figure><figcaption>Antes</figcaption><a id="oldlink"><img id="old"></a></figure><figure><figcaption>Depois</figcaption><a id="newlink"><img id="new"></a></figure></main>
<script>const cases=DATA;const m=document.querySelector('#machine'),s=document.querySelector('#mode'),l=document.querySelector('#locale');
for(const name of [...new Set(cases.map(c=>c.machine))].sort())m.add(new Option(name,name));m.value='alchemical_station';
function render(){const c=cases.find(c=>c.machine===m.value&&c.mode===s.value&&c.locale===l.value);if(!c)return;document.querySelector('#new').src=c.image;document.querySelector('#newlink').href=c.image;const old='before/'+c.machine+'--'+c.mode+'.png';const img=document.querySelector('#old');img.onerror=()=>{img.onerror=null;img.src='before/'+c.machine+'--main.png';document.querySelector('#oldlink').href=img.src};img.src=old;document.querySelector('#oldlink').href=old}
function modes(){const prev=s.value;s.innerHTML='';for(const mode of [...new Set(cases.filter(c=>c.machine===m.value).map(c=>c.mode))])s.add(new Option(mode,mode));if([...s.options].some(o=>o.value===prev))s.value=prev;render()}m.onchange=modes;s.onchange=render;l.onchange=render;modes();</script></html>""".replace("DATA", json.dumps(cases))
    (OUT / "index.html").write_text(page, encoding="utf-8")
    print(json.dumps({"cases": counts, "screens": len(metrics), "missing": dict(missing)}))


if __name__ == "__main__":
    main()
