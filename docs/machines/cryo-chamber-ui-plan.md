# Cryo Chamber — plano de integração da UI

Status: implementado em 2026-10-07; aceitação em uma carga fresca do Bedrock ainda pendente.

## Modelo adotado

Usar o [card de botões padrão do AT](../ui-button-card.md): formato do Catalyst
Weaver, fundo `tab_top_<cor>`, altura de 27 pixels, linha de 18 pixels,
offset interno `[0, 4]` e expansão para a esquerda. Cor de referência: **aqua**,
já utilizada no fundo principal do Cryo Chamber.

Reutilizar `at_common.button_card`, `at_common.card_tab` e
`at_core.button_card_row`. O arquivo da máquina define a linha, ícones, cores,
grupos e páginas. Não criar outra implementação de card ou alterar o núcleo
para compensar o posicionamento desta tela.

## Composição

- Card principal com três abas: **Congelamento**, **Cryofluid** e **Estabilização**.
- Congelamento como seleção inicial, índice 0; geração no índice 1 e estabilização no 2.
- Grupo exclusivo `cryo_chamber_pages`, com nomes de controles exclusivos.
- Energia, inventário, hotbar, upgrades e I/O compartilhados; água aparece em congelamento e geração; cryofluid aparece em geração e estabilização.
- Status lateral acompanha o processo selecionado usando os textos existentes.
- Upgrades, I/O e informações continuam nos controles laterais do UtilityCraft.
- Ícones provisórios de assets já disponíveis e tooltips localizados para as abas.
- Slots de cada processo instanciados uma única vez, dentro da página correspondente.
- O processo continua executando quando sua página está oculta.

Uma quarta aba de receitas é uma extensão posterior. Ainda não existe um livro
específico do Cryo Chamber registrado em `RP/ui/recipes`; sua implementação
deve consumir as fontes de estabilização, freezing e geração de cryogen.
Não reservar novos slots de container para navegação local da UI.

## Contratos atuais a preservar

Fonte de comportamento: `BP/scripts/features/machines/cryoChamber.js`.

| Função | Índices do container |
| --- | --- |
| Energia | 0 |
| Estabilizador: texto / progresso / entrada / saída | 1 / 2 / 3 / 23 |
| Resfriamento: grade / texto | 4–12 / 21 |
| Água: display | 13 |
| Cryofluid: display | 14 |
| Gerador: titânio / lápis / texto | 15 / 16 / 22 |
| Upgrades | 17–20 |
| I/O de itens / líquidos | 24–29 / 30–35 |

Os displays continuam bloqueados e os dois tanques usam I/O líquido. O inventário
ativo tem 36 posições: os slots de recipientes foram eliminados da UI, do tick
e do I/O de itens. Máquinas antigas de 36/37/38 slots passam pela migração
anterior e depois pelo mapeamento novo; recipientes antigos saem no mundo.
Configurações de faces de I/O de itens com índices antigos podem voltar ao padrão
e exigir nova seleção após a migração.

O título de ativação continua `entity.utilitycraft:cryo_chamber.name`, resolvido
em `RP/ui/chest_screen.json` para `cryo_chamber.utility_panel`. O título de teste
também aponta atualmente para esse painel. O arquivo
`cryo_chamber_sections_test.json` não está registrado em `_ui_defs.json`;
serve como referência local, não como prova de uma composição ativa.

## Implementação

A UI ativa em `RP/ui/cryo_chamber.json` usa três páginas vinculadas ao card aqua.
Congelamento mostra a grade 3 × 3 sobre `frozen_panel_ls` em 176 × 166.
Geração e estabilização mantêm o painel aqua nas mesmas dimensões. Um único display
lateral acompanha a página selecionada; energia, inventário e controles de
upgrades/I/O permanecem compartilhados. Os ícones das abas são provisórios.

O inventário e a hotbar usam `dark_cyan_cell`, derivada da célula cyan com
brilho ligeiramente reduzido. Os índices foram compactados com a retirada
dos dois slots de recipientes; nenhum processo usa esses itens agora.

## Verificação

O script `tools/preview-button-card.cjs` cobre as três páginas em larguras de
480 e 360 pixels, seleção das abas, painel congelado de 176 × 166,
alinhamento do card, ausência dos recipientes e as 27 + 9 células. O teste
`tools/test-cryo-chamber-layout.cjs` cobre a migração dos inventários antigos.
A prévia não substitui uma carga fresca no Bedrock: conferir content log,
cliques nas abas, slots, processamento, tanques, upgrades, I/O e entrada por
mouse, controle e toque. O protótipo `cryo_chamber_sections_test.json` segue
sem registro e não participa da tela ativa.
