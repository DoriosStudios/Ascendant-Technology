# Progressão atual — Ascendant Technology 0.9.2

Verificada no código em 2026-10-01, incluindo o trabalho local ainda sem commit. Este documento descreve a versão atual; [Roadmap.md](../Roadmap.md) e [o mapa de eras](../extras/progression_ptbr.md) também contêm conteúdo futuro. Para pendências e testes, veja [o relatório da versão](release/0.9.2-readiness.md).

## Caminho principal

```text
UtilityCraft: energia, Workbench e processamento básico
    ↓
Titanium + Tungsten → Superior Machine Case
    ├─ máquinas superiores: expansão horizontal
    └─ Cryo Chamber → Cryofluid
                         ↓
Cristais/Shards + Netherite + pós de Titanium, Tungsten e Ender Pearl
                         ↓ Catalyst Weaver
                  Aetherium metálico
                         ↓
Absolute Chips, equipamentos, geradores Absolute,
Liquifier, Energizer, armazenamento e logística avançada
```

A principal porta antes do metal é a infraestrutura criogênica. Não é necessário fabricar cada máquina superior em sequência. Existem máquinas com requisitos próprios fora dessa rota; Compactor e Decompactor são utilidades de processamento, não uma era obrigatória.

## Entradas e obtenção

| Etapa | Requisitos efetivos | Fonte principal |
|---|---|---|
| Titanium/Tungsten | Mineração ou peneiramento, processamento e energia UC | `BP/scripts/config/recipes/added/{sieve,furnace,crusher,press}.js` |
| Superior Machine Case | Quatro Titanium Blocks, quatro Tungsten Ingots e Machine Case | `BP/recipes/blocks/machinery/components/superior_machine_case.json` |
| Cryo Chamber | Titanium Plates/Blocks, Packed Ice, Expert Fluid Tank, Superior Machine Case e dois Ultimate Chips | `BP/recipes/blocks/machinery/machines/cryo_chamber.json`; catálogo do Assembler corrigido para os mesmos chips |
| Catalyst Weaver | Infuser, quatro Steel Blocks, dois Ultimate Chips, Expert Fluid Tank e Superior Machine Case | `BP/recipes/blocks/machinery/machines/catalyst_weaver.json` |
| Cristais | Minérios de Aetherium; quatro Shards também formam um Crystal | Loot dos minérios e `added/press.js` |
| Shards | Endstone triturado, tier 5, chance-base 10%; deepslate triturado, tier 7, chance-base 0,5%; hammer no minério do End | `added/sieve.js` e `config/drops/registeredDrops.js` |
| Metal | Receita abaixo | `BP/scripts/config/recipes/catalystWeaver.js` |

As duas fontes de peneiramento não são equivalentes como entrada: a de tier 7 é tardia. A mineração natural e a rota do End evitam tratar essa receita como pré-requisito circular.

## Primeiro Aetherium Ingot

No Catalyst Weaver, por operação:

- Entrada: **1 Netherite Ingot**.
- Catalisadores consumidos: **8 Titanium Dust + 8 Tungsten Dust + 8 Ender Pearl Dust**.
- Material cristalino: **2 Aetherium Crystals ou 8 Aetherium Shards**.
- Fluido: **1.600 mB Cryofluid**.
- Energia: **12.000 DE**, velocidade configurada **0,5x**.

A alternativa de automação troca os dois pós metálicos por **16 Titanium & Tungsten Dust**. Misturar um Titanium Dust com um Tungsten Dust rende dois pós mistos. Não reduz o custo material da liga.

Netherite é consumido em cada operação. A economia de Netherite e a oferta sustentada de Ender Pearls/Cryofluid podem limitar a velocidade de expansão, mesmo sem uma receita inacessível.

## Criogenia

A Cryo Chamber consome diretamente uma receita de Titanium, uma receita de Lapis e água. Por exemplo, um Titanium Ingot + oito Lapis consomem 1.000 mB de água e rendem 800 mB Cryofluid por 1.600 DE. Raw Titanium e outras formas têm rendimentos próprios; não há uma taxa única para todo o catálogo.

O Cryofluid Synthesizer é construído a partir da Cryo Chamber. Usa créditos persistentes dos insumos: **4 pontos Titanium + 8 pontos Lapis + 1.000 mB de água → 1.000 mB Cryofluid**, por **6.000 DE**. Um Titanium Ingot vale oito pontos; um Lapis vale um ponto.

A Cryo Chamber precisa acomodar uma receita inteira. Seu tanque-base é 64.000 mB, até 320.000 mB com upgrades. O Titanium Block comprimido de tier 2 pede 729.000 mB de água com Lapis comum, portanto não cabe nessa máquina. Alimentar formas menores ou usar o Synthesizer evita essa paralisação; a simples presença de uma forma comprimida no catálogo não prova que a Chamber consegue consumi-la.

## Ramos depois do metal

- **Absolute Chip:** o Infuser combina Ultimate Chip com dois Aetherium Dust. O metal pode ser triturado para obter esse pó.
- **Liquifier:** o crafting já exige metal e Absolute Chips. Processa Aetherium e outros insumos em fluidos; não é necessário para produzir o primeiro ingot.
- **Refined Aetherium Crystal:** um Crystal + Amethyst Shard + 800 mB Dark Matter no Catalyst Weaver. Alimenta sistemas de refinamento e a parte de armazenamento. É um ramo separado da liga metálica.
- **Energizer:** a receita exige metal/Absolute Chips; o catálogo atual contém ferro energizado e Energy Upgrade. Não há receita de Nióbio.
- **Duplicator:** usa Liquified Aetherium e aplica restrições a cristais, blocos minerais, comprimidos e alvos reservados ao Fabricator.
- **Singularity Fabricator:** o catálogo atual contém dez cópias especiais com Dark Matter. Não foi encontrada receita de obtenção da máquina no pack/Assembler, inclusive na base 0.9.1. Isso precisa ser definido para acesso survival a essa ramificação.
- **Digital Storage/Bountiful Crops:** célula/parte e cultivos ampliam automação com os addons correspondentes; não são requisitos para o primeiro metal.
- **Conveyor Table:** obtida na bancada comum ou Assembler com três Copper Ingots, dois Redstone e Crafting Table. Permite fabricar os 15 conveyors/endpoints transferidos para ela no trabalho local.

## Compatibilidade e limite de conteúdo

O antigo `utilitycraft:refined_aetherium_shard` foi preservado como item de compatibilidade, fora do menu criativo, e pode ser convertido **1:1** para `utilitycraft:refined_aetherium_crystal` na bancada, Workbench ou Assembler. É uma conversão manual; ainda precisa ser testada com inventários reais de um mundo 0.9.1.

A cadeia futura **Nióbio → singularidades materiais → Kyarium** não existe como percurso jogável neste snapshot. Mob Temporal Chamber, Alchemical Station, Fluid Crystallizer e outras entradas do roadmap também não devem ser confundidas com funcionalidades entregues. O fim atual da progressão é a expansão e otimização da infraestrutura de Aetherium.
