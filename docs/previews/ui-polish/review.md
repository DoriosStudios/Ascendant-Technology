> Atualização posterior: os tamanhos e a composição dos painéis I/O foram restaurados ao UC (Catalyst: 168×126). Os painéis laterais foram aproximados em 2 px. A galeria final-en/final-pt abaixo registra a versão anterior a essa correção; os previews pontuais atuais ficam em `io-rollback`.

# Polimento visual das UIs do Ascendant Technology

[Abrir a galeria comparativa](index.html) · [Medições](measurements.json)

Revisão de **39 rotas de tela**, incluindo as duas telas técnicas `at_testing` e `manual`.
Foram capturados **230 estados em inglês** e **230 em português**, em
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

UC Core SHA-256: `32bd978822bce066f05f1b88ac08baeb0a18ad8f63d4b4de7a222e1da1fcfd49`.

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

| Tela | Vão antes → depois | Desnível final | Fechar antes → depois |
| --- | ---: | ---: | ---: |
| absolute_container | — | — | 1 → 1 |
| abyssal_fisher | 2 → 2 px | 0 px | 1 → 1 |
| alchemical_station | 2 → 2 px | 0 px | 2 → 1 |
| arc_press_forge | -1 → 2 px | 0 px | 1 → 1 |
| arcane_enchanter | -1 → 2 px | 0 px | 1 → 1 |
| at_testing | — | — | 1 → 1 |
| catalyst_weaver | 0 → 2 px | 0 px | 2 → 1 |
| centrifugal_siever | -1 → 2 px | 0 px | 1 → 1 |
| compactor | -1 → 2 px | 0 px | 1 → 1 |
| cryo_chamber | 1 → 2 px | 0 px | 1 → 1 |
| cryo_freezer | -1 → 2 px | 0 px | 2 → 1 |
| cryo_stabilizer | -1 → 2 px | 0 px | 2 → 1 |
| cryofluid_synthesizer | -1 → 2 px | 0 px | 2 → 1 |
| decompactor | -1 → 2 px | 0 px | 1 → 1 |
| disenchanter | 0 → 2 px | 0 px | 1 → 1 |
| dual_siever | 0 → 2 px | 0 px | 1 → 1 |
| duplicator | -1 → 2 px | 0 px | 1 → 1 |
| enchantment_station | 2 → 2 px | 0 px | 2 → 1 |
| energizer | -1 → 2 px | 0 px | 2 → 1 |
| genetic_seed_synthesizer | -1 → 2 px | 0 px | 1 → 1 |
| impact_crusher | -2 → 2 px | 0 px | 1 → 1 |
| industrial_burner | -1 → 2 px | 0 px | 1 → 1 |
| industrial_crucible | -1 → 2 px | 0 px | 2 → 1 |
| laser_barrier | — | — | 1 → 1 |
| liquifier | -1 → 2 px | 0 px | 2 → 1 |
| manual | 1 → 1 px | 1 px | 1 → 1 |
| network_center | — | — | 1 → 1 |
| overclock_relay | -1 → 2 px | 0 px | 1 → 1 |
| overclock_tower | -1 → 2 px | 0 px | 1 → 1 |
| pattern_placer | -1 → 2 px | 0 px | 1 → 1 |
| power_beacon | — | — | 1 → 1 |
| pulverizer | -1 → 2 px | 0 px | 1 → 1 |
| refining_table | 2 → 2 px | 0 px | 2 → 1 |
| reinforcement_anvil | -1 → 2 px | 0 px | 1 → 1 |
| residue_processor | -1 → 2 px | 0 px | 2 → 1 |
| seismic_breaker | -1 → 2 px | 0 px | 1 → 1 |
| singularity_fabricator | -1 → 2 px | 0 px | 1 → 1 |
| vaporworks_processor | -1 → 2 px | 0 px | 2 → 1 |
| verdant_cultivator | -1 → 2 px | 0 px | 1 → 1 |
