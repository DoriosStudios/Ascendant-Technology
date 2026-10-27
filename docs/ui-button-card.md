# Card de botões

`at_common.button_card` é a composição de aparência; `at_core.button_card`
cuida do layout. O Catalyst Weaver já usa o novo card nas telas normal e de
receitas, mantendo os nomes `machine_view_toggle_button` e `recipes_toggle_button`.

## Padrão para novas integrações

O modelo de referência é o card do Catalyst Weaver, com as variantes coloridas
`tab_top_<cor>` corrigidas. Esse é o padrão adotado para futuras recriações,
incluindo o [plano do Cryo Chamber](machines/cryo-chamber-ui-plan.md).

- Fundo com o formato 12x11 e nine-slice de 4 pixels do `TabTopBackRightMostDark`.
- Card de 27 pixels de altura, linha interna de 18 pixels e offset interno `[0, 4]`.
- Célula de botão `[26, 18]`, face `[25, 18]` e espaçamento de 1 pixel entre faces.
- Expansão para a esquerda; fechamento centralizado na célula de 18 pixels.
- Cores e ícones configuráveis; preservar todos os estados de seleção e hover.
- Na composição principal, posicionar a base do card 4 pixels abaixo do topo
  do painel. `$card_offset` depende da âncora do painel: `[0, 4]` nos três
  consumidores novos, `[21, 4]` no Catalyst. O default mecânico do núcleo
  continua `[0, 2]`; a integração deve explicitar o ajuste da sua composição.
- Usar `tab_top_<cor>` para os fundos novos. `background_<cor>` continua
  disponível para compatibilidade, mas não é a referência visual de novas tabs.

As páginas e seus slots pertencem ao arquivo da máquina; o núcleo compartilha
o layout e a aparência dos botões. Novas integrações não devem alterar defaults
globais para compensar offsets específicos de uma máquina.

O layout segue o toolbar de `inventory_screen.json` do vanilla 1.26.30.5:
imagem dimensionada pelo conteúdo (`100%cm`) e uma linha horizontal de tamanho
intrínseco. A âncora direita fica fixa; cada botão acrescentado aumenta a largura
para a esquerda. Não existe uma contagem ou um limite de botões no componente.
O card do UtilityCraft em `ui/recipes/core.json` serviu de referência para as
dimensões, os ícones e a troca de páginas. Os controles são composições explícitas,
sem `modifications` herdadas.

## Uso

Defina a linha de botões e passe sua referência ao card. Cada tab recebe um nome
de controle único, um índice e o mesmo `$toggle_name` para formar um grupo radio.

```json
{
    "namespace": "example",
    "buttons@at_core.button_card_row": {
        "controls": [
            { "main_tab@at_common.card_tab": {
                "$toggle_name": "example_pages",
                "$card_tab_index": 0,
                "$card_icon": "textures/ui/inventory_icon",
                "$card_tooltip": "ui.utilitycraft:machine_view.machine"
            } },
            { "recipes_tab@at_common.card_tab": {
                "$toggle_name": "example_pages",
                "$card_tab_index": 1,
                "$card_icon": "textures/ui/recipe_book_icon",
                "$card_tooltip": "ui.utilitycraft:recipes_panel.name",
                "$card_unchecked_texture": "textures/ui/button_card/button_blue",
                "$card_checked_texture": "textures/ui/button_card/button_blue_pressed",
                "$card_unchecked_hover_texture": "textures/ui/button_card/button_blue_hover",
                "$card_checked_hover_texture": "textures/ui/button_card/button_blue_pressed_hover"
            } }
        ]
    },
    "card@at_common.button_card": {
        "$card_buttons_ref": "example.buttons",
        "$card_background_texture": "textures/ui/button_card/tab_top_brown",
        "$card_selected_tab": 0,
        "$card_offset": [0, 4]
    },
    "main_page": {
        "type": "panel",
        "bindings": [
            {
                "binding_type": "view",
                "source_control_name": "main_tab",
                "source_property_name": "#toggle_state",
                "target_property_name": "#visible",
                "resolve_sibling_scope": false
            }
        ]
    }
}
```

Para adicionar botões, acrescente controles à linha. Repita o binding de página
com o nome da tab correspondente. Instâncias independentes precisam de nomes
de controles e grupos distintos. Uma linha também aceita `at_common.card_button`;
seu `$pressed_button_name` precisa apontar para um evento atendido pela tela.
O fechamento usa `common.light_close_button` e o evento nativo da tela, com
âncoras centrais, offset zero e área de clique do tamanho da célula de fechamento.

As duas composições do Catalyst Weaver usam o mesmo grupo e a mesma página
inicial (0); a seleção corrente vem do estado nativo, não de defaults divergentes.

## Parâmetros

| Controle | Parâmetros | Padrão |
| --- | --- | --- |
| Card | `$card_buttons_ref` | Linha vazia `at_core.button_card_row` |
| Card | `$card_background_texture` | Vanilla `textures/ui/TabTopBackRightMostDark` |
| Card | `$card_show_background` | `true`; oculta apenas a imagem do fundo |
| Card | `$card_show_close`, `$card_close_ref` | `true`, `common.light_close_button` |
| Card | `$card_size`, `$card_offset` | `["100%c", 27]`, `[0, 2]` |
| Card | `$card_content_size`, `$card_content_offset` | `["default", 18]`, `[0, 4]` |
| Card | `$card_padding_size`, `$card_close_cell_size` | `[4, "100%"]` por lado, `[18, "100%"]` |
| Botão/tab | `$card_cell_size`, `$card_button_size` | `[26, 18]`, `[25, 18]`; diferença de 1 px entre células |
| Botão/tab | `$card_icon`, `$card_icon_size`, `$card_icon_offset`, `$card_icon_color` | Sem ícone, `[19, 13]`, `[0, 0]`, branco |
| Botão/tab | `$card_tooltip` | Texto/chave localizada, opcional |
| Botão/tab | Quatro `$card_*_texture` mostrados no exemplo | Cinza; texturas independentes por estado |
| Tab | `$card_tab_index`, `$card_selected_tab`, `$toggle_name` | 0, 0, `button_card_tabs` |
| Botão de ação | `$pressed_button_name` | `button.noop` |

As âncoras padrão são `top_right` → `bottom_right`, como no toolbar vanilla. `offset` posiciona o canto
inferior direito acima da tela da máquina. Para outra posição, sobrescreva as
âncoras nativas. Ao alterar a altura ou o tamanho dos botões, ajuste também a
altura do conteúdo. A largura padrão é `26 × número de botões + 26` com fechamento,
ou `26 × número de botões + 8` sem ele.

Os defaults de altura e posição ficam em `button_card`, no `RP/ui/at_core.json`:
`$card_size` controla o card/fundo inteiro, `$card_offset` move o card e
`$card_content_offset` posiciona a linha interna de botões. A altura de 27 px e
o deslocamento de 2 px posicionam o card inteiro 2 px acima do ajuste anterior.
Um `offset` nativo definido na instância tem precedência sobre `$card_offset`.
O Catalyst Weaver define esse ajuste em `view_top_bar`, no seu arquivo de UI,
com `"$card_offset": [21, 4]`; ajuste ali para mover somente o card dessa máquina.

Passe os tamanhos como vetores completos, como no vanilla; por exemplo,
`"$card_size": ["100%c", 32]` e `"$card_content_size": ["default", 22]`.
Os antigos parâmetros escalares `$card_height`, `$card_content_height`,
`$card_padding` e `$card_close_cell_width` foram substituídos por esses vetores.
Variáveis numéricas dentro de componentes de `size` eram interpretadas como
texto sem unidade pelo Bedrock, causando `Dangling number`.

Os defaults de textura ficam no botão/tab, antes dos controles visuais filhos.
Assim, todos os estados encontram as cores no escopo ancestral, incluindo hover
e estados desabilitados; as sobrescritas por botão continuam disponíveis.

Seleção, hover/foco e estados desabilitados usam os estados nativos do toggle.
Os estados desabilitados mantêm o ícone e a seleção, com alpha 0,5. O ícone e as
texturas podem ser diferentes para cada botão; `$card_icon_color` permite tint.

## Paleta e texturas

Os novos PNGs estão em `RP/textures/ui/button_card`. Os nomes de paleta são:
`default`, `aqua`, `black`, `blue`, `brown`, `dark`, `gray`, `green`, `light_blue`,
`light_gray`, `lime`, `magenta`, `orange`, `pink`, `purple`, `red`, `white`, `yellow`.

O fundo padrão usa `TabTopBackRightMostDark.png` do vanilla, com tamanho base
12 × 11 e nine-slice de 4 px. O UtilityCraft usa `toolbar_background.png`
(10 × 9), que tem outro acabamento inferior. Os fundos coloridos e os quatro
estados de botões por cor continuam disponíveis pelos mesmos parâmetros.

Para cada paleta existem `background_COR`, `button_COR`, `button_COR_pressed`,
`button_COR_hover` e `button_COR_pressed_hover`, todos com metadata nine-slice.
Os grids de pixels são novos: fundo de 10 × 9 e botão de 5 × 5. Preenchimento,
contorno e bevel vêm das entradas de painéis de `tools/colors.txt`; o hover
clareia o preenchimento em 20 unidades por canal. As bordas trocam de posição
no estado pressionado. Nenhuma textura existente é sobrescrita.

Para regenerar os assets no PowerShell:

```powershell
& tools/generate-button-card-textures.ps1
```

## Verificação

`node tools/preview-button-card.cjs` usa o vanilla indicado acima e o Dorios
Bedrock UI Preview instalado. Exercita cards com 2, 4, 8 e 12 botões em duas
larguras, cores/ícones diferentes, seleção, hover, botão de ação, fechamento
opcional e as duas composições do Catalyst Weaver. As imagens e o relatório
ficam em `docs/previews/button-card`.

Antes de aceitar a geometria, o script também verifica os problemas reportados
pelo Bedrock: variáveis numéricas em componentes de `size` e aliases de textura
que não existem no escopo ancestral. O preview sozinho aceita essas construções.

A prévia do Catalyst Weaver omite a lista extensa de receitas e a composição
oculta para respeitar o limite de expansão da ferramenta. Também completa, em
memória, o seletor de estados do preview com os dois estados nativos de hover
desabilitado que ele não reconhece. Seus dados de máquina são ilustrativos.
O preview não executa o Bedrock: confirmação de texto real, navegação por
controle/toque e ausência de erros exige carregar o pack/mundo e ler o content log.

## Cards nas máquinas

As definições locais ficam no início de `RP/ui/enchantment_station.json`,
`RP/ui/refining_table.json` e `RP/ui/alchemical_station.json`:
`button_card_buttons` define os ícones, cores e abas; `view_top_bar` define
o fundo e `$card_offset`. Os três cards principais usam `[0, 4]`, com a mesma
sobreposição de quatro pixels do Catalyst (cujo painel exige `[21, 4]`).

A Alchemical possui também `side_button_card_buttons` e `side_view_top_bar`,
com anchors `top_right`, offset `[-22, 0]` e sem botão de fechar.
O fundo está visível. A opção `$card_show_background` continua disponível no
núcleo para futuras integrações. Ela controla somente o alpha da imagem
original, com `propagate_alpha: false`: os botões continuam opacos e a
estrutura responsável pelo dimensionamento permanece a mesma.

Os novos fundos `textures/ui/button_card/tab_top_<cor>` têm o formato 12x11 e
o nine-slice de 4 pixels do `TabTopBackRightMostDark`. As texturas anteriores
`background_<cor>` e todos os estados coloridos de botões continuam disponíveis.


## Paletas e alinhamento das máquinas

A aparência padrão de `at_common.button_card` usa `tab_top_default` e os quatro
estados `button_default`. As interfaces com `common_panel` cinza usam essa paleta.
Alchemical Station usa brown; Refining Table usa purple; Cryo Chamber e Cryo
Freezer usam aqua. Enchantment Station usa fundo black com os botões default
matizados em teal por `$card_face_color: [0.3, 0.65, 0.62]`. O tint afeta somente
a superfície do botão, preservando as cores do ícone.

`at_common.machine_recipe_card` adapta as barras antigas de máquina/receitas ao
card AT, mantendo `machine_view_toggle_button`, `recipes_toggle_button` e o grupo
`machine_view_tabs`. Sua âncora é center → bottom_right, com `$card_offset`
`[88, -79]` para o painel 176×166; Impact Crusher usa `[111, -79]` por sua largura.
Os cards ancorados diretamente no topo direito usam `[0, 4]`. Esses valores
alinham o encontro das texturas com o painel principal; não alteram o offset
mecânico padrão do AT Core.
