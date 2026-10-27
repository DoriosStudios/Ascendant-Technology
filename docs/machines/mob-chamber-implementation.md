# Mob Chamber — implementação por etapas

Atualizado em 18/10/2026. A transferência dos componentes compartilháveis passou a ser responsabilidade desta implementação.

## Etapas

| Etapa | Entrega | Estado |
| --- | --- | --- |
| 1 | Componentes no UtilityCraft, família de titânio no AT e invalidação compartilhada | Implementada; teste no Bedrock pendente |
| 2 | Controller, Core, Essence Module e validação específica da estrutura | Implementada; casco retangular fechado com dimensões variáveis e posicionamento livre dos componentes |
| 3 | Operações em lote, energia, loot, XP, bloqueio e persistência | Implementada; teste de operação no Bedrock pendente |
| 4 | UI com placeholder, assets exclusivos, guia e teste no Bedrock | UI e guia implementados; arte frontal exclusiva e validação nativa pendentes |

## Responsabilidades e dependências

- Dorios Core: detecção, ativação, bounds, portas, entidade controladora e desativação.
- UtilityCraft: somente os três módulos genéricos (Processing, Speed, Efficiency) e as três Cells (Energy, Fluid, Gas), além da infraestrutura Dorios Core já existente.
- Ascendant Technology: casings/ports de titânio, Mob Chamber Controller, Mob Chamber Core, Essence Module, funcionamento e UI próprios.
- Heavy Machinery: casings/ports de aço, netherita, estanho e bronze, Power Condenser Units, Controller Case, Control Panel, cristais de Darloonite, `utilitycraft:multiblock_machine` e componentes específicos de suas máquinas.

AT e Heavy Machinery declaram dependência dos packs BP/RP do UtilityCraft 3.6.0. As três entregas precisam ser distribuídas de forma coordenada: o Heavy atualizado deixa de definir os componentes transferidos. O AT não depende de Heavy Machinery.

Os seis IDs compartilhados são preservados para que máquinas e estruturas existentes continuem referenciando os mesmos blocos. As receitas desses seis blocos agora usam apenas ingredientes do UtilityCraft base. O Mob Chamber usa `at:mob_chamber_machine` e suas receitas usam Expert Chip e Refined Aetherium Crystal; ele não requer Heavy Machinery.

## Etapa 1 implementada

- Seis blocos compartilhados no UtilityCraft: Processing/Speed/Efficiency Modules e Energy/Fluid/Gas Cells, com receitas, registros no Crafter, atlas, catálogo e traduções.
- Casings/ports de aço e netherita, Power Condenser Units, Control Panel, cristais de Darloonite e entidade genérica permanecem no Heavy Machinery.
- Entidade específica `at:mob_chamber_machine` no Ascendant Technology, com inventário de 40 slots, famílias de I/O e eventos exigidos pelo Dorios Core. O grupo legado `inventory_36` permanece definido com 40 slots e os índices 0–35 não mudam; a atualização de entidades já salvas ainda precisa de verificação no Bedrock.
- Dez blocos de titânio no AT: casing, tijolos, dois vidros, bloco de placas, sinalização, ventilação e ports de energia/fluidos/itens.
- Nove receitas de crafting de titânio e uma de vidro temperado por infusão. O Crafter recebe as mesmas receitas.
- Nomes dos PNGs de item/fluid port de titânio normalizados; as imagens permanecem as existentes.
- Listeners das três cópias envolvidas do Dorios Core passam a invalidar a estrutura quando casing ou componente interno é quebrado ou explodido. O caminho de desativação permanece o compartilhado.

## Contrato da estrutura do Chamber

O Mob Chamber segue o formato do detector compartilhado do Heavy Machinery: um casco retangular de titânio completamente fechado, com largura, altura e profundidade independentes. Não existe dimensão fixa específica do Chamber. O Controller pode ocupar qualquer posição do casco, incluindo faces, arestas, cantos, piso e teto; não precisa estar centralizado. Ports também ocupam posições livres do casco. Exigir pelo menos um port de energia, um de fluidos e um de itens. Um mesmo item port atende entrada/saída; ports separados permitem roteamento independente.

Permanece o limite técnico compartilhado `MAX_SIZE = 99` de alcance por eixo na busca do Dorios Core; isso não é uma dimensão fixa imposta pelo Mob Chamber. A validação final continua síncrona, de modo que cascos extremamente grandes podem tornar a montagem lenta e ainda exigem ensaio de desempenho no Bedrock.

Todos os componentes internos têm posicionamento livre. A validação conta componentes e não impõe coordenadas ao Core.

O scanner do Dorios Core também mantém `componentsById`, sem confundir IDs homônimos de outros addons com os componentes legados do UtilityCraft. A validação final do Chamber usa adaptadores por ID completo (`COMPONENT_ADAPTERS` e `EXTERNAL_COMPONENT_ADAPTERS` em `config.js`), que definem o papel e, para Cells, a capacidade energética ou de XP por bloco. Nenhum ID externo é habilitado por padrão. `EXTERNAL_SHELL_IDS` permite casings simples com a tag de titânio; portas externas continuam bloqueadas até existir um contrato de estado ativo e I/O. Testes locais cobrem colisão de nomes e adaptadores sintéticos, mas não substituem teste nativo com um addon externo real.

Requisitos internos: exatamente um Mob Chamber Core e pelo menos uma Energy Cell, uma Fluid Cell e um Processing Module. Esses quatro blocos determinam o espaço interno mínimo; não há exigência de 3×3×3. Essence Modules desbloqueiam slots: um slot base e mais um por módulo, até oito slots. Módulos além dos sete úteis são aceitos na estrutura, mas ignorados para capacidade, com aviso ao ativar. Speed e Efficiency Modules são limitados somente pelo volume disponível. Posições restantes contêm ar.

Exemplo compacto válido: casco de 3×4×4 (ou qualquer permutação das dimensões), com quatro espaços internos. São 44 blocos na superfície: 40 casings de titânio, um Controller e um port de cada tipo (energia, fluido, item). Dentro, colocar Core, Energy Cell, Fluid Cell e Processing Module em qualquer ordem. Estruturas maiores admitem módulos adicionais e espaço vazio. Um tamanho menor só é inválido quando não há espaço para os quatro componentes obrigatórios ou não se consegue fechar o casco.

Quebrar qualquer módulo/célula/componente ou parte necessária do casco desativa a máquina e exige novo scan. Desmontagem e quebra do Controller seguem o comportamento compartilhado dos multiblocks.

## Etapa 2 implementada

- Blocos `utilitycraft:mob_chamber_controller`, `utilitycraft:mob_chamber_core` e `utilitycraft:essence_module`, com catálogo, nomes em dez idiomas e três receitas iniciais no workbench e no Crafter.
- Corpo dos três blocos em titânio. As faces frontais usam aliases de assets existentes do UtilityCraft, explicitamente provisórios (`*_preview`). Não são a arte final exclusiva.
- Interação com wrench reutiliza criação da entidade e descoberta de bounds do Dorios Core. Um scan final síncrono valida novamente todo o volume detectado depois dos passos assíncronos de detecção/partículas, antes de ativar ports ou alterar capacidades.
- O scan exige um Core e as três categorias mínimas de componentes. Rejeita água, Gas Cells, Power Condenser Units, componentes de outras máquinas e Controllers adicionais. Essence Modules excedentes não invalidam a máquina. Os componentes permitidos podem ocupar qualquer posição interna, independentemente das dimensões do casco.
- Atributos em `at:mob_chamber_stats`: contagens brutas, slots de essência, capacidade simultânea, intervalo, eficiência e capacidade do tanque. Não usa `computeMachineStats` nem `processFactory` genéricos, e não há multiplicador de XP.
- Inventário de 40 slots e placeholder bloqueado no slot 3. Protocolo: `at:mob_chamber:v1|eN|pNN`, por exemplo `at:mob_chamber:v1|e8|p02`. O escritor só altera esse slot; não substitui botões nem sobrescreve um item real encontrado nele. O consumidor JSON UI foi integrado na etapa 4.
- O preview da etapa 2 inicialmente mantinha operações e I/O fechados. A etapa 3 os habilitou com filtros de essências/slots e saída exclusiva de loot/XP. A energia continua usando a infraestrutura compartilhada.
- Reduzir a capacidade de Fluid Cells abaixo do conteúdo armazenado impede ativação, antes de `setCap` poder truncar esse conteúdo.

### Lifecycle verificado no código

Quebrar/explodir casing ou componente interno usa `DeactivationManager.deactivateMultiblock`: mantém entidade, inventário e recursos, remove links/estado ativo e exige novo scan. Quebrar o Controller usa `handleBreakController`, como os Controllers atuais do Heavy Machinery: desativa e remove a entidade depois de dois ticks.

Esse último caminho **não** chama `MultiblockMachine.onDestroy`, que é o helper separado responsável por drops de inventário e lore de recursos. O Chamber não introduz uma política diferente de recuperação nessa etapa. Portanto, não usar o preview como armazenamento de itens; eventual alteração de recuperação deve ser discutida no lifecycle compartilhado, não adicionada silenciosamente só ao Chamber.

## Etapa 3 e UI implementadas

- Seleção round-robin por slot habilitado; uma essência ocupada representa uma morte, independentemente da quantidade empilhada. Repetir o mesmo tipo em outros slots gera mortes adicionais.
- Tick próprio de um tick e contador persistente de progresso. Não usa scheduler/rate de fábricas nem drenagem progressiva. Sem essência válida, zera o intervalo; sem energia no momento da operação, mantém o temporizador pronto.
- Custo confirmado arredondado para cima em DE inteiros. Speed afeta somente o intervalo; Efficiency reduz o custo restante. Quando módulos são reconfigurados, o loot pendente continua igual e o custo é recalculado com a eficiência atual.
- Loot e XP do lote são sorteados uma vez, simulados integralmente contra as 27 saídas e o tanque, e aplicados numa seção síncrona com cobrança única. Uma falha de espaço bloqueia sem consumo/execução parcial.
- Staging em entidades auxiliares privadas `utilitycraft:mob_chamber_staging`, com páginas de 54 slots nativos, fora da UI e sem famílias de I/O. O Controller persiste IDs das páginas, número de stacks, perfis, essências selecionadas, XP e cursor. ItemStacks mantêm metadados nativos sem uma serialização incompleta de itens. Lotes maiores que 54 stacks usam mais páginas, não saídas visíveis.
- Unload/reload não sorteia novamente o lote. Páginas não carregadas/ausentes bloqueiam; dados malformados ficam preservados para recuperação. O commit não contém `await`; snapshots permitem rollback de exceções ordinárias, mas isso não é uma garantia contra encerramento abrupto do processo durante uma gravação de mundo.
- Tirar/trocar uma essência que já integra um lote pendente pausa a execução até restaurar os catalisadores/capacidade necessários. Alterar essências não permite reroll gratuito de um lote bloqueado.
- `inputFilter` opcional no DoriosLib Containers de AT/UtilityCraft/Heavy: whitelist de IDs e limite de slots, aplicados inclusive a overrides de ports e `targetSlots` explícitos. Sem esse campo, políticas anteriores permanecem iguais. No Chamber, só essências válidas entram em slots habilitados; só 9–35 saem como itens. XP só sai do tanque 0; não há entrada de fluidos.
- JSON UI registrada pelo título e pelo placeholder, com oito layouts de essências e saídas fixas 3×9. Energia, XP, progresso e informações mantêm seus índices/itens; o placeholder não substitui nenhum botão para comunicar o layout.
- Slots desabilitados recebem filler bloqueado para evitar inserção manual/quick-move invisível. Um rescan que reduzir slots ocupados pede remoção prévia das essências, sem apagar itens.

## Contrato das operações

- Cada essência selecionada representa uma morte independente, com loot e XP próprios. A essência permanece como catalisador.
- Capacidade simultânea: um processamento por Processing Module. A operação seleciona no máximo o menor valor entre capacidade, slots desbloqueados e slots válidos ocupados.
- Quando existem mais essências que capacidade, selecionar slots em round-robin. Essências repetidas representam mortes adicionais daquela entidade.
- Tempo em segundos: `10 × 0,95^speedModules`. Converter para ticks respeitando a resolução do jogo, sem arredondar a duração para zero.
- Eficiência: multiplicar o custo da operação por `0,975^efficiencyModules`.
- O temporizador mede intervalo entre operações. A energia é retirada integralmente no momento em que uma operação pode ser executada.
- Processing Modules ampliam a quantidade de mortes; não multiplicam a recompensa de XP de cada morte.
- Saída com 27 slots, três fileiras de nove. Se loot ou XP do lote não couber integralmente, parar em clog e não executar parcialmente nem consumir energia adicional.
- Um resultado já sorteado e bloqueado permanece estável até haver espaço, inclusive após unload/reload. A persistência usa inventários privados paginados; os 27 slots de saída não são reduzidos para staging. A proposta anterior de 18 slots ocultos foi descartada.

### Custo energético confirmado

Confirmado pelo usuário em 13/10/2026: custo-base de **64.000 DE por morte**, com custo da operação igual a `soma dos custos individuais × 2^(mortesSimultâneas−1) × 0,975^efficiencyModules`.

Com a base uniforme, a fórmula é `64.000 × N × 2^(N−1) × 0,975^efficiencyModules`, em que `N` é o número de mortes efetivamente processadas simultaneamente na operação. Antes da eficiência, lotes de 1–4 mortes custam **64.000 / 256.000 / 768.000 / 2.048.000 DE**. A alternativa de aplicar somente `custoBase × 2^(N−1)` ao lote foi descartada.

## Loot e XP

`LootTableManager.generateLootFromEntityType` recebe o `EntityType` obtido com `EntityTypes.get`. Uma lista vazia é um resultado válido e nunca causa reroll. Ausência/erro da API aciona o mapa local das 18 essências. Não são criadas entidades de mob para obter drops; as entidades auxiliares servem exclusivamente para armazenar ItemStacks. Não há hooks de bônus de extensões.

A API por tipo não expõe parâmetro de killer/player nem variante. Por precaução, Blaze, Guardian, Spider, Wither Skeleton e Zombie usam o mapa local para preservar pools condicionados a morte por jogador; isso é uma decisão conservadora, não uma falha comprovada da API em runtime. Slime/Magma também usam o mapa por tamanho. Os demais perfis usam a API primeiro. Uma futura verificação nativa pode ampliar o uso da API com contexto correto.

O fallback é um mapa compacto próprio de faixas/probabilidades, não uma cópia dos arquivos vanilla. Referência factual: [Mojang bedrock-samples, commit 46ba6ea](https://github.com/Mojang/bedrock-samples/tree/46ba6ea985fb5a92d79a9419198f10dda14c199d/behavior_pack/loot_tables/entities). Contrato da API: [Microsoft LootTableManager](https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/loottablemanager?view=minecraft-bedrock-stable).

Illager usa a distribuição do Mechanical Spawner: Pillager 45, Vindicator 35, Witch 15 e Evoker 1. Sortear cada morte independentemente.

Slime e Magma Cube sorteiam tamanho por morte: 50% pequeno (1), 30% médio (2) e 20% grande (4). XP equivale ao tamanho. Apenas Slime pequeno dá Slime Ball; Magma pequeno não dá Magma Cream. Não são simuladas mortes recursivas dos filhos que nasceriam ao dividir um Slime/Magma maior.

XP vem de mapa vanilla separado, com min/max e sorteio por morte. Perfis adultos, sem equipamento virtual: animais passivos sorteiam 1–3, hostis usam a recompensa-base vanilla (5 ou 10), e Slime/Magma usam 1/2/4. Não são inventados bônus de equipamento nem variantes baby ausentes do processamento. Fonte: [componentes vanilla de experiência](https://github.com/Mojang/bedrock-samples/tree/46ba6ea985fb5a92d79a9419198f10dda14c199d/behavior_pack/entities). Inserção direta no tanque: 1 ponto de XP = 1 mB. Cada Fluid Cell fornece 256.000 mB. Não há orbes nem multiplicador de XP por Processing Module.

## UI e inventário

Contrato visível: slot 0 energia, 1 informações, 2 temporizador, 3 placeholder, 4–7 e 36–39 essências, 8 XP e 9–35 loot. São 40 slots lógicos; staging é separado. A ordem descontínua mantém intocados os índices antigos de XP e loot.

O título do container seleciona o wrapper Mob Chamber. Um `utilitycraft:ui_filler` bloqueado no slot 3 comunica o estado JS → JSON UI e seleciona a variante interna. O marcador versionado informa slots desbloqueados e capacidade simultânea. Oito layouts exibem de 1 a 8 essências, mantendo os 27 slots de loot na mesma posição. Nenhum botão é substituído para transportar estado.

Os slots de UI e qualquer armazenamento pendente ficam fora do I/O. Ports de entrada enxergam somente essências habilitadas; ports de saída enxergam somente os 27 outputs e o tanque de XP correspondente.

## Assets ainda pendentes

As dez texturas da família de titânio foram reaproveitadas. Módulos genéricos e células agora vêm do UtilityCraft.

Ainda precisam ser produzidas/aprovadas as faces exclusivas do Mob Chamber Controller, Mob Chamber Core e Essence Module; estados ativos/flipbooks são opcionais. A UI funcional reutiliza molduras, slots e indicadores existentes, sem exigir PNG novo. Guia mínimo de montagem está neste documento. Não tratar a frente provisória como arte final desses componentes. Essências e placeholder já possuem assets no UtilityCraft.

No preview da etapa 2, as faces frontais ainda usam aliases provisórios; `processing_module_north` e `efficiency_module_north` vêm do UtilityCraft. O Controller aponta temporariamente para o `titanium_case` do AT, sem depender da textura do Heavy Machinery. Os corpos usam o casing/bloco de placas de titânio existente.

## Verificação

- Teste direcionado da propriedade dos seis componentes: `node --test tools/test-multiblock-foundation.cjs`, no UtilityCraft.
- Chamber e I/O: `node --experimental-vm-modules --test tools/test-mob-chamber-foundation.mjs tools/test-container-input-filter.mjs`, no AT. Os testes incluem detector real do Core em múltiplas dimensões e posições do Controller, requisitos, atributos, UI/placeholder, lotes, custos, XP, rollback, clog, reload/paginação, limpeza de staging e restrições de I/O nas três cópias do DoriosLib.
- Regressões do núcleo: `node --test tests/multiblock-entities.cjs`, no Heavy Machinery; `DORIOS_TEST_CORE` permite exercitar as cópias de UtilityCraft e AT com o mesmo teste.
- Bundles dos entrypoints e verificação dos diffs dos arquivos tocados.
- Dentro do Bedrock: carregar UtilityCraft sozinho, UtilityCraft + AT, UtilityCraft + Heavy e os três juntos; conferir ausência de IDs duplicados, crafting, texturas e quebra/explosão de componentes de uma estrutura ativa.

O usuário confirmou a montagem do preview 5×5×5 no Bedrock. O novo casco de dimensões variáveis, as operações e a UI ainda precisam de recarga e teste no jogo: montar formatos compactos e alongados, testar essências repetidas/diferentes, falta de energia, clog de loot/XP, unload/reload bloqueado, I/O e quebra de componentes. Checks locais e export de desenvolvimento não substituem essa validação.

As verificações de 13/10 foram feitas antes da redução de propriedade para seis blocos e não comprovam o estado atual. Repetir os testes direcionados e um novo export de desenvolvimento para cada pack afetado antes da aceitação no Bedrock; nenhum arquivo de export deve ser editado manualmente.

### Como testar a versão funcional

Recarregar o mundo com os development packs atualizados e usar wrench no Controller existente para atualizar slots/tanque/I/O. Inserir essências nos slots exibidos; usar mais Processing Modules para processar mais slots de uma vez. Alimentar energia e esperar o intervalo. Conferir uma única queda de energia por operação, loot nas três fileiras e XP líquido. Para testar clog, encher todas as saídas ou o tanque e confirmar que o lote só é liberado integralmente depois de retirar recursos, sem reroll nem cobrança durante a espera.

## Branch do UtilityCraft

Em 13/10/2026, o checkout do UtilityCraft passou de `multi-cables` para `main`. A main foi atualizada com `origin/main` e recebeu o histórico de `origin/agent/universal-cable-networking` por merge, preservando commits existentes. Mudanças locais de redes e da transferência foram reaplicadas. Conflitos de acréscimos no final dos dez arquivos de idioma foram resolvidos mantendo os dois conjuntos de textos.

O stash `Safety backup before UtilityCraft main migration and Mob Chamber step 2` permanece como backup. Nenhum push nem reescrita de commits publicados foi feito. A transferência e demais alterações locais continuam no working tree da main.
