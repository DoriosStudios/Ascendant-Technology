# Subglobal UI Organization Guide

Este guia documenta como organizar os arquivos de UI entre os subpacks "Single UIs" e "Tabs UI".

## Estrutura de Subpacks

### Single UIs
**Localização:** `RP/subpacks/single_uis/ui/`

Interfaces que utilizam uma única tela sem toggles ou abas. Exemplos:
- `singularity_fabricator.json` - Interface simples
- `catalyst_weaver.json` - Interface com energia e fluidos
- `ascane_engine.json` - Enchantment Station (interface única)
- `energizer.json` - Simple energy interface
- `duplicator.json` - Interface com entrada/saída/energia
- `synthesis_crucible.json` - Interface única
- `vaporworks_processor.json` - Processor simples
- `overclock_relay.json` - Relay simples
- `overclock_tower.json` - Tower simples
- `liquifier.json` - Liquifier simples
- `residue_processor.json` - Processador simples
- `grid_export.json` - Grid export interface
- E outras interfaces sem navegação por abas

### Tabs UI
**Localização:** `RP/subpacks/tabs_ui/ui/`

Interfaces que utilizam sistema de abas/tabs para navegação entre diferentes seções:
- `cryo_chamber_sections_test.json` - Interface com abas para seções de cryo
- (futuras interfaces com tabs a serem adicionadas)

## Como Usar

1. **Para adicionar uma UI ao subpack Single UIs:**
   - Copie o arquivo JSON da UI de `RP/ui/` para `RP/subpacks/single_uis/ui/`
   - Atualize referências de path se necessário
   - Remova de `RP/ui/` (opcional, mas recomendado para evitar duplicação)

2. **Para adicionar uma UI ao subpack Tabs UI:**
   - Copie o arquivo JSON da UI de `RP/ui/` para `RP/subpacks/tabs_ui/ui/`
   - Se usar componentes de abas, garanta que estejam disponíveis via `ascendant_common.json`
   - Remova de `RP/ui/` (opcional, mas recomendado para evitar duplicação)

## Arquivos Comuns (Mantém em RP/ui/)

Os seguintes arquivos devem permanecer em `RP/ui/` pois são referenciados por ambos os subpacks:
- `ascendant_common.json` - Componentes comuns (botões, painéis, toggles, etc)
- `machineryCommon.json` - Componentes de maquinário
- `_ui_defs.json` - Definições de UI globais
- `chest.json` - Componentes genéricos de baú
- `common.json` - Componentes base (se existir)

## Estrutura Final Esperada

```
RP/
├── ui/                           # Arquivos comuns compartilhados
│   ├── ascendant_common.json
│   ├── machineryCommon.json
│   ├── _ui_defs.json
│   ├── chest.json
│   └── ...
└── subpacks/
    ├── single_uis/
    │   └── ui/
    │       ├── singularity_fabricator.json
    │       ├── catalyst_weaver.json
    │       ├── ascane_engine.json
    │       └── ... (outras UIs simples)
    └── tabs_ui/
        └── ui/
            ├── cryo_chamber_sections_test.json
            └── ... (futuras UIs com tabs)
```

## Notas Técnicas

- Os manifestos (BP/manifest.json e RP/manifest.json) já foram ajustados com as definições de subpacks
- Cada subpack pode ser selecionado independentemente no Minecraft ao adicionar o addon
- Arquivos em `RP/subpacks/*/ui/` substituem/complementam os arquivos em `RP/ui/`
