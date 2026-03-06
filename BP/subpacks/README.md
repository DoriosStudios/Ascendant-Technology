# Behavior Pack - Subpacks Structure

## Overview

Os subpacks do Behavior Pack são estruturas vazias que servem como organizadores lógicos para o Resource Pack correspondente.

## Estrutura

```
BP/
└── subpacks/
    ├── single_uis/
    │   └── (vazio - organiza logicamente B.P. com Single UIs)
    └── tabs_ui/
        └── (vazio - organiza logicamente B.P. com Tabs UIs)
```

## Notas

- Os subpacks do BP não contêm dados funcionais; servem apenas para manter a estrutura paralela com o RP.
- Toda a lógica de máquinas permanece em `BP/scripts/`, `BP/functions/`, etc.
- Os subpacks garantem que quando um usuário seleciona "Single UIs", ele recebe apenas aquelas interfaces no RP.
- O BP não possui restrições de funcionalidade entre subpacks - todas as máquinas funcionam independentemente da UI selecionada.
