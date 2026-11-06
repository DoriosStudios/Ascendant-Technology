# Station Structural Migration Plan (Draft)

Objetivo: padronizar todas as máquinas para usar configuração aninhada via script (estilo `station.*`), com defaults centralizados por máquina e override por `settings.machine.<namespace>`.

Status: planejamento para execução em sessão futura.

## 1) Motivação

- Evitar configuração espalhada em múltiplos `const *_CONFIG` por arquivo.
- Unificar padrão de leitura/configuração dinâmica.
- Habilitar tuning de balanceamento sem editar lógica interna.
- Reduzir regressões ao reutilizar utilitários comuns.

## 2) Escopo (mapeado no repositório)

Scripts de máquinas:

- `BP/scripts/machinery/machines/absolute_container.js`
- `BP/scripts/machinery/machines/catalyst_weaver.js`
- `BP/scripts/machinery/machines/cryo_chamber.js`
- `BP/scripts/machinery/machines/duplicator.js`
- `BP/scripts/machinery/machines/energizer.js`
- `BP/scripts/machinery/machines/enchantment_station.js` (já migrando)
- `BP/scripts/machinery/machines/laser_barrier.js`
- `BP/scripts/machinery/machines/liquifier.js`
- `BP/scripts/machinery/machines/network_center.js`
- `BP/scripts/machinery/machines/residue_processor.js`
- `BP/scripts/machinery/machines/singularity_fabricator.js`
- `BP/scripts/machinery/machines/tabs_test_machine.js`
- `BP/scripts/machinery/machines/vaporworks_processor.js`

Blocos (settings em JSON):

- `BP/blocks/machinery/machines/*.json`

## 3) Princípio arquitetural

Cada máquina deve ter:

1. `MACHINE_DEFAULT` (objeto aninhado imutável)
2. `let machineCfg = MACHINE_DEFAULT`
3. resolução dinâmica em runtime a partir de `settings.machine.<namespace>`
4. uso da config apenas via `machineCfg.*` dentro da lógica

Padrão de namespace sugerido (no JSON):

- `settings.machine.station` (enchantment station)
- `settings.machine.liquifier`
- `settings.machine.energizer`
- etc.

Obs.: manter fallback para campos legados (`settings.machine.energy_cost`, `dynamic_rate`, etc.) até finalizar a migração completa.

## 4) Reuso de código (comum)

Criar utilitário compartilhado para evitar duplicação de merge/cache em cada máquina.

Arquivo sugerido:

- `BP/scripts/machinery/AscendantMachinery/config_runtime.js`

Funções sugeridas:

- `isPlainObject(value)`
- `deepMergeObjects(base, override)`
- `createCachedConfigResolver(defaultConfig)`
  - retorna resolver com cache (chave por `JSON.stringify(override)` quando possível)
- `readMachineScopedConfig(settings, scopeName, defaultConfig, resolverState)`

Integração com o que já existe:

- Continuar usando `applyDynamicRecipeRate` de `core.js` onde já é adequado.
- Não duplicar lógica de cálculo de rate se já houver helper no core.

## 5) Convenção de estrutura (por máquina)

Template recomendado:

- `machineCfg.slots.*`
- `machineCfg.energy.*`
- `machineCfg.time.*`
- `machineCfg.progress.*`
- `machineCfg.io.*` (fluid/gas/items)
- `machineCfg.recipes.*` (quando aplicável)
- `machineCfg.balance.*` (multiplicadores específicos)

Regra: evitar novas constantes soltas para valores tunáveis; manter no objeto aninhado.

## 6) Fases de migração

### Fase A — Infra de Config Runtime

- adicionar utilitário compartilhado de merge/cache
- adicionar typedefs genéricos para config aninhada reutilizável
- validar sem alterar comportamento

### Fase B — Máquinas com `dynamic_rate` já ativo

Prioridade (menor risco de padrão inconsistente):

- `enchantment_station.js` (baseline)
- `liquifier.js`
- `residue_processor.js`
- `energizer.js`
- `catalyst_weaver.js`

### Fase C — Máquinas complexas (multi-etapas)

- `duplicator.js`
- `singularity_fabricator.js`
- `cryo_chamber.js`

### Fase D — Máquinas simples/utilitárias

- `network_center.js`
- `laser_barrier.js`
- `vaporworks_processor.js`
- `absolute_container.js`
- `tabs_test_machine.js`

### Fase E — JSON alignment

- adicionar seções `machine.<namespace>` nos blocos correspondentes
- manter compatibilidade com os campos atuais até fechamento da migração

## 7) Tipagens (typedef.js)

Diretriz:

- manter `MachineSettings` compatível
- adicionar tipagens específicas por namespace, apenas onde usado
- evitar “tipagem gigante” sem adoção real

Pacote mínimo de tipos genéricos:

- `MachineScopedConfig<TScopeName, TShape>` (conceitual/documental)
- `DynamicRateSettings`
- `EnergyTuningSettings`
- `TimeTuningSettings`

Tipos por máquina (incremental):

- `LiquifierSettings`, `EnergizerSettings`, `ResidueProcessorSettings`, etc.

## 8) Critérios de aceitação

Para cada máquina migrada:

1. Sem regressão funcional visível
2. Sem erros de diagnóstico
3. Configuração via `settings.machine.<namespace>` aplicada em runtime
4. Fallback legado preservado (durante período de transição)
5. Nenhum tunable principal fora de `machineCfg.*`

## 9) Estratégia de teste por fase

- validar diagnósticos dos arquivos alterados
- smoke test em mundo local (place, power, input, output, break)
- testar cenários com e sem override de config
- testar `dynamic_rate` ligado/desligado quando aplicável

## 10) Riscos e mitigação

Risco: quebra de compatibilidade com JSON antigos

- Mitigação: fallback para campos legacy durante a transição

Risco: divergência de fórmula após migração

- Mitigação: snapshot dos cálculos antigos e comparação antes/depois

Risco: objetos muito profundos difíceis de manter

- Mitigação: convenção fixa de seções e nomes curtos/consistentes

## 11) Backlog sugerido da próxima sessão

1. Criar `config_runtime.js` compartilhado
2. Migrar `liquifier.js` para `machineCfg`
3. Migrar `residue_processor.js` para `machineCfg`
4. Migrar `energizer.js` para `machineCfg`
5. Ajustar `typedef.js` somente para os 3 arquivos migrados
6. Rodar validação e checklist de regressão

## 12) Nota de governança

- Não refatorar estilo/arquitetura fora do escopo da migração de config.
- Evitar mudanças de gameplay não planejadas durante fases A/B.
- Alterações de balanceamento (ex.: inflação 8x–16x) devem ficar explícitas em `machineCfg.balance`/`machineCfg.energy.inflation`.
