# AT machine upgrades — implementação

Status: implementado no AT; validação automatizada em `npm run audit:upgrades`. A verificação visual e de automação dentro do Minecraft ainda precisa ser feita.

## Decisão arquitetural vigente

A instrução final substitui o plano original: **não modificar UtilityCraft, DoriosLib ou DoriosCore**.

Os cinco novos itens usam `ascendant:machine_upgrade`. Suas definições ficam em `BP/scripts/ATCore/machinery/upgradeEffects.js` e não são enviadas ao registro compartilhado. O instalador próprio (`upgradeInstaller.js`) reconhece somente as máquinas AT declaradas em `upgradeProfiles.js`.

`atMachine.js` estende a classe Machine existente: resolve os cinco efeitos, aplica capacidades e finaliza cada atualização. Não modifica protótipos nem arquivos do núcleo. Os scripts em `BP/scripts/features/machines` importam essa classe e usam `registerATMachine`.

## Uso e níveis

Os upgrades ocupam qualquer slot de upgrade existente. É necessário retirar outro upgrade para liberar espaço. Usar o item na máquina instala uma unidade; agachado instala as unidades disponíveis até o limite de oito. Uma pilha já instalada tem prioridade. Pilhas duplicadas do mesmo tipo não somam níveis.

| Upgrade | ID após `utilitycraft:` | Efeito no nível N (1–8) |
|---|---|---|
| Multi Processing | `multi_processing_upgrade` | 1 + N slots por ciclo |
| Energy Capacity | `energy_capacity_upgrade` | capacidade base × (1 + 0,5N) |
| Liquid Capacity | `liquid_capacity_upgrade` | capacidade de cada tanque de líquido × (1 + 0,5N) |
| Gas Capacity | `gas_capacity_upgrade` | capacidade de cada tanque de gás × (1 + 0,5N) |
| Resource Efficiency | `resource_efficiency_upgrade` | 5N% de chance de preservar cada requisito |

As capacidades chegam a 5× e a preservação chega a 40%. Os upgrades de capacidade não alteram taxas de transferência ou eficiência energética.

## Capacidade e persistência

A capacidade desejada parte dos valores originais de cada bloco. Retirar um upgrade mantém o conteúdo excedente, bloqueia novo preenchimento e reduz o limite conforme o conteúdo é consumido. O cálculo usa `max(capacidade desejada, conteúdo)` e é atualizado após a operação. Valores inalterados ficam em cache, com limpeza quando a entidade desaparece.

Na recolocação, o AT amplia temporariamente a configuração usada pela API de spawn para restaurar todo o conteúdo salvo no item. Isso evita o corte que a restauração compartilhada normalmente faria na capacidade base; depois, o limite volta a acompanhar os upgrades presentes.

## Processamento de múltiplos slots

- Arc-Press Forge: quatro slots de entrada;
- Centrifugal Siever: quatro slots de entrada;
- Industrial Crucible: seis slots de entrada;
- Pulverizer: quatro slots de entrada.

A máquina mantém um único ciclo de progresso. Sem Multi Processing, somente o primeiro slot válido entra no ciclo; cada melhoria instalada adiciona outro slot, até o tamanho do grid. Ao terminar, todos os slots selecionados são processados juntos. Quando as receitas têm durações diferentes, o ciclo usa a duração da receita mais lenta.

Stack e Multi Processing alteram dimensões diferentes do mesmo ciclo: Stack aumenta a quantidade processada em cada slot, enquanto Multi Processing aumenta a quantidade de slots selecionados. Os dois efeitos podem ser combinados. Energia é cobrada de acordo com a quantidade de slots ativos, sem acelerar o ciclo compartilhado.

Cryo Stabilizer, Industrial Burner, Impact Crusher e Cryo Freezer mantêm seu paralelismo nativo e não aceitam Multi Processing. Compactor e Decompactor continuam tratando seus grids como ingredientes de uma única receita.

Dual Siever mantém seus modos próprios. Grids de ingredientes agrupados, como Compactor e Arc Press Forge, continuam sendo uma única operação.

## Economia de recursos

`resourceCost(machine, total, perCraft)` faz um sorteio independente para cada requisito de cada craft concluído. Um requisito de quatro itens economiza os quatro quando o sorteio é favorável. Catalisadores, líquidos e gases são sorteados separadamente. Não há sorteio por mB ou desconto antecipado na validação: todos os custos originais precisam estar disponíveis.

Cobertura: entradas consumidas, catalisadores, XP, líquidos de receita, gases, lava, vapor, sementes, blocos colocados e desgaste de rede de pesca. No Impact Crusher, o consumo térmico também pode ser preservado por evento de aquecimento/resfriamento.

Energia permanece sob o Energy Upgrade. Transferências I/O, enchimento/esvaziamento de recipientes e movimentação de originais já devolvidos pelas máquinas de clonagem não são consumo de matéria-prima. Transformações de equipamento no próprio slot mantêm a identidade do objeto; seus reagentes consumidos e XP recebem economia.

Nas conversões de resfriamento no próprio slot, uma posição vazia é reservada para cada entrada que pode ser preservada. Sem espaço, a operação espera: o original nunca é sobrescrito nem jogado fora. Essa regra vale para Cryo Freezer e para o grid de resfriamento do Cryo Chamber.

Receitas reversíveis também recebem economia, conforme a abrangência solicitada. Por isso, conversões repetidas podem gerar excedentes de materiais, mantendo o custo energético de cada operação.

## Conteúdo

Todos os cinco itens têm receita no UtilityCraft Workbench e no Catalyst Weaver, usando Base Upgrade, quatro Steel Plates, dois Redstone Blocks, corante e um ingrediente específico:

| Upgrade | Corante | Ingrediente específico |
|---|---|---|
| Multi Processing | vermelho | Aetherium Block |
| Energy Capacity | amarelo | Diamond Block |
| Liquid Capacity | ciano | Expert Fluid Tank |
| Gas Capacity | verde-lima | Expert Gas Tank |
| Resource Efficiency | verde | Refined Aetherium Crystal |

Ícones: a textura de Multi Processing fornecida foi mantida. Os outros quatro têm fontes determinísticas em `tools/generate-capacity-upgrade-icons.mjs`. Catálogo, atlas de itens, idiomas e painéis de receitas do Catalyst Weaver incluem os novos itens. As receitas de Workbench também têm os espelhos habituais de Digitizer/Assembler na configuração do próprio AT.

## Mapa de manutenção

1. `upgradeEffects.js`: níveis, compatibilidade, seleção de slot e sorteio de economia; sem APIs do jogo.
2. `upgradeProfiles.js`: slots e capacidades originais das 31 máquinas. A auditoria compara com os JSONs de bloco para impedir divergência.
3. `upgradeInstaller.js`: instalação local, prioridade de pilha, limite e rejeição de máquinas não AT.
4. `atMachine.js`: integração de runtime, cache, capacidade e restauração.
5. `ATCore/processing/processEngine.js`: ciclo compartilhado, cobrança por slot e processamento nativo em lanes.
6. `ATCore/processing/cryoCoolingGrid.js`: conversão no próprio slot com reserva e restauração em falhas.
7. `ATCore/processing/commitProcess.js`: commit com restauração usado pelo Catalyst Weaver.
8. `features/machines/*.js`: custos explícitos dos requisitos; não aplicar economia dentro dos métodos compartilhados de transferência.
9. `tools/audit-machine-upgrades.mjs`: níveis, capacidades, instalação, paralelismo, recursos e falhas de commit.

## Verificação manual no jogo

Validações automatizadas: bundle completo do AT, auditoria dos upgrades, auditorias de Compactador/Descompactador, Aetherium/Power Beacons e DoriosLib. A auditoria antiga de DoriosCore não executa porque o repositório não contém `types/DoriosCore/API_INVENTORY.md`. A comparação por hash confirmou que os 11.160 arquivos existentes protegidos de UtilityCraft, DoriosCore e DoriosLib permaneceram intactos.

- instalar cada tipo em todos os slots compatíveis, tanto pela tela como usando o item;
- comparar máquinas sem upgrades e com pilhas de 1/3/8 unidades;
- confirmar nomes, ícones e os cinco novos botões no Catalyst Weaver em mouse e toque;
- retirar upgrades com buffers acima da capacidade base, consumir recursos, quebrar e recolocar;
- testar I/O externo enquanto a capacidade está diminuindo;
- testar Cryo Freezer cheio e depois liberar posições para entradas preservadas;
- combinar Stack e Multi Processing nos quatro grids compatíveis;
- misturar receitas de durações e outputs diferentes no mesmo grid;
- confirmar que as quatro máquinas com paralelismo nativo não perderam rendimento;
- medir tempo de atualização de uma base grande antes/depois, especialmente com múltiplos slots ativos.
