- [:hammer:] Titanium Alloy Forge:
   - Purpose: Produzir Titanium Alloy em batches a partir de minérios e ligantes; slot de molde determina formato de saída (ingot/rod/plate).
   - Operating Mode: Recebe até 2 insumos, consome energia por ciclo (3 ciclos padrão). Moldes definem output; falhas geram rejeitos que exigem reciclagem.
   - Tiers:
      - Basic: 1 batch / ciclo | 1 molde
      - Advanced: 2 batches / ciclo | 2 moldes
      - Expert: 4 batches / ciclo | 3 moldes
      - Ultimate: 8 batches / ciclo | 4 moldes
   - Possible Upgrades: Energy, Throughput, Yield, Durability (reduce reject).  
   - Referência: https://github.com/DoriosStudios/Ascendant-Technology/blob/main/Machine_To_Do.md

- [:gear:] Structural Titanium Press:
   - Purpose: Prensar Titanium Alloy + blank-frame → Structural Titanium Plate/Frame; die determina dimensão e resistência.
   - Operating Mode: Slot de die influenciando stats; consumo de energia por prensa; necessita manutenção periódica.
   - Tiers:
      - Basic: Press 1 → Plate (low res)
      - Advanced: Press 2 → Plate (med res)
      - Expert: Press 4 → Plate (high res)
      - Ultimate: Press 8 → Plate (max res, specialized dies)
   - Possible Upgrades: Pressure (reduz ciclos), Die Quality (aumenta resistência), Energy.  
   - Referência: https://github.com/DoriosStudios/Ascendant-Technology/blob/main/Machine_To_Do.md

- [:snowflake:] Cryogenic Distiller:
   - Purpose: Converter insumos frios (gelo especial, gás resfriado) em Criofluido com níveis de pureza estágios.
   - Operating Mode: Processo em colunas/stages; cada estágio consome energia e reduz impureza; output: criofluido puro/impuro + resíduos frios.
   - Tiers:
      - Basic: 1 stage | baixa pureza
      - Advanced: 2 stages | média pureza
      - Expert: 4 stages | alta pureza
      - Ultimate: 6 stages | extra-pure
   - Possible Upgrades: Purity Module, Heat Sink slot, Energy Efficiency.  
   - Referência: https://github.com/DoriosStudios/Ascendant-Technology/blob/main/Machine_To_Do.md

- [:flask:] Cryo Reservoir:
   - Purpose: Armazenar criofluido com isolamento; fornece fluxo por tick e sofre perda passiva (evaporação).
   - Operating Mode: Tanque com input/output; upgrade de isolamento reduz perda; telemetria para Network Center.
   - Tiers:
      - Basic: 8k mB | perda alta
      - Advanced: 16k mB | perda média
      - Expert: 32k mB | perda baixa
      - Ultimate: 64k mB | negligible loss
   - Possible Upgrades: Insulation, Passive Cooling, Auto-Refill (link to Distiller).  
   - Referência: https://github.com/DoriosStudios/Ascendant-Technology/blob/main/Machine_To_Do.md

- [:straight_ruler:] Cryo-Infused Pipes:
   - Purpose: Transportar criofluido com mínima perda, manter temperatura e evitar cristalização em altas densidades.
   - Operating Mode: Blocos de conduto com throughput/decay resistance; orientações influenciam latência; conectáveis a Reservoirs e máquinas.
   - Tiers:
      - Basic: 64 mB/t | decay low
      - Advanced: 128 mB/t | decay lower
      - Expert: 256 mB/t | decay minimal
      - Ultimate: 512 mB/t | decay none, long-range
   - Possible Upgrades: Throughput, Insulation, Anti-Crystal Coating.  
   - Referência: https://github.com/DoriosStudios/Ascendant-Technology/blob/main/Machine_To_Do.md

- [:chip:] Hyper Processing Unit (HPU):
   - Purpose: Módulo plugável que multiplica ciclos lógicos (throughput) de máquinas compatíveis.
   - Operating Mode: Instala em slot HPU de máquina; define multiplier (x2/x4/x8); consome criofluido e energia por ciclo extra; sem crio → degradação + corrupção de output.
   - Tiers:
      - Basic: x2 | low extra-consume
      - Advanced: x4 | med extra-consume
      - Expert: x8 | high extra-consume
      - Ultimate: x16 | extreme consume, requires multi-frame
   - Possible Upgrades: Energy Cap, Stability Damping, Heat Profile (require Titanium Frame).  
   - Referência: https://github.com/DoriosStudios/Ascendant-Technology/blob/main/Machine_To_Do.md

- [:shield:] Cryo Stabilizer:
   - Purpose: Mitigar heat/instability gerados por HPUs; consome criofluido para reduzir chance de corrupção.
   - Operating Mode: Anexo local ou cluster-mode; modo automático prioriza máquinas ativas com HPU; alocação percentual configurável.
   - Tiers:
      - Basic: -10% heat | low crio cost
      - Advanced: -25% heat | med crio cost
      - Expert: -45% heat | high crio cost
      - Ultimate: -70% heat | very high crio cost
   - Possible Upgrades: Auto-Priority, Burst Mode (high mitigation, high cost), Remote Sync.  
   - Referência: https://github.com/DoriosStudios/Ascendant-Technology/blob/main/Machine_To_Do.md

- [:thermometer:] Thermal Dissipator:
   - Purpose: Dissipar calor (passivo/ativo). Arrays aumentam dissipation rate; ativo usa energia para boost.
   - Operating Mode: Slot thermal-link; passivo scaled com Titanium Frame; ativo consome energia por tick para aumentar dissipation.
   - Tiers:
      - Basic: 5 units/tick passive
      - Advanced: 12 units/tick passive / +active
      - Expert: 30 units/tick passive / +active
      - Ultimate: 70 units/tick passive / +active
   - Possible Upgrades: Fan Boost, Radiator Plating (Titanium), Smart Link (Network Center).  
   - Referência: https://github.com/DoriosStudios/Ascendant-Technology/blob/main/Machine_To_Do.md

- [:control_knobs:] Overclock Controller:
   - Purpose: Painel UI para definir perfis por máquina/cluster: target cycles, max instability, resource priority.
   - Operating Mode: Define regras que enviam sinais ao Load Balancer; possui fail-safe thresholds e cooldowns.
   - Tiers:
      - Basic: perfil por máquina
      - Advanced: perfil por cluster + logging
      - Expert: automações + telemetry export
      - Ultimate: AI optimizer (heuristic batching)
   - Possible Upgrades: Remote Control, Telemetry Buffer, Emergency Override.  
   - Referência: https://github.com/DoriosStudios/Ascendant-Technology/blob/main/Machine_To_Do.md

- [:electric_plug:] Flux Regulator / Load Balancer:
   - Purpose: Distribuir energia e criofluido entre máquinas; implementa weighted round-robin e emergency shedding.
   - Operating Mode: Inputs multi-source, outputs multi-target; regras por tag; smoothing window para evitar oscillation.
   - Tiers:
      - Basic: small cluster balancing
      - Advanced: multi-cluster balancing + priority
      - Expert: predictive smoothing + peak shaving
      - Ultimate: grid-level balancing (multi-node)
   - Possible Upgrades: Throughput, Latency Reduction, Emergency Scheduler.  
   - Referência: https://github.com/DoriosStudios/Ascendant-Technology/blob/main/Machine_To_Do.md

- [:microscope:] Precision Calibrator:
   - Purpose: Reduz variação de outputs / aumenta yield em máquinas de processamento (menos rejeitos).
   - Operating Mode: Anexo que melhora rendimento por receita; consome energia e aplica degradação por uso que requer manutenção.
   - Tiers:
      - Basic: +3% yield
      - Advanced: +8% yield
      - Expert: +15% yield
      - Ultimate: +30% yield
   - Possible Upgrades: Durability, Auto-Repair, Recipe-Specific Tuning.  
   - Referência: https://github.com/DoriosStudios/Ascendant-Technology/blob/main/Machine_To_Do.md

- [:construction:] Titanium Machine Frame:
   - Purpose: Frame estrutural que altera parâmetros base da máquina (HPU compat, resistência térmica, slots adicionais).
   - Operating Mode: Item instalado na montagem da máquina; define limites máximos dos módulos aceitos.
   - Tiers:
      - Basic: +resistência leve | 1 HPU slot
      - Advanced: +resistência média | 2 HPU slots
      - Expert: alta resistência | 3 HPU slots
      - Ultimate: máxima resistência | 4 HPU slots + passive dissipation
   - Possible Upgrades: Reinforcement, Insulated Coating, Slot Expansion.  
   - Referência: https://github.com/DoriosStudios/Ascendant-Technology/blob/main/Machine_To_Do.md

- [:repeat:] Redundancy Node:
   - Purpose: Replicar estados críticos de máquinas (rollback parcial) para minimizar perda por corrupção/instability.
   - Operating Mode: Node ligado em cluster; mantém history window; em falha, restaura estado parcial conforme retention.
   - Tiers:
      - Basic: 5s retention
      - Advanced: 30s retention
      - Expert: 2min retention
      - Ultimate: 10min retention + checkpointing
   - Possible Upgrades: Storage, Compression, Fast-Restore.  
   - Referência: https://github.com/DoriosStudios/Ascendant-Technology/blob/main/Machine_To_Do.md

- [:ledger:] Batch Orchestrator / Recipe Scheduler:
   - Purpose: Agendar/enfileirar receitas entre máquinas, agrupar jobs para otimizar energia/criofluido e reduzir picos.
   - Operating Mode: Recebe jobs com prioridade; exporta plano ao Overclock Controller; pode agrupar por insumo para otimizar.
   - Tiers:
      - Basic: single-factory batching
      - Advanced: multi-factory orchestration
      - Expert: economic optimizer (minimiza cost)
      - Ultimate: predictive scheduling (telemetry-based)
   - Possible Upgrades: Batch Size, Cooldown Optimizer, Energy Minimizer.  
   - Referência: https://github.com/DoriosStudios/Ascendant-Technology/blob/main/Machine_To_Do.md

- [:warning:] Instability Meter:
   - Purpose: Medir instabilidade acumulada (0–100) em cluster e emitir triggers quando thresholds alcançados.
   - Operating Mode: Sensor ligado à Network Center; thresholds configuráveis; triggers automáticas para shedding.
   - Tiers:
      - Basic: visual readout
      - Advanced: thresholds + alarms
      - Expert: auto-trigger to Load Balancer
      - Ultimate: predictive alerts + historic logging
   - Possible Upgrades: Sensitivity, Remote Alerts, Auto-Mitigate.  
   - Referência: https://github.com/DoriosStudios/Ascendant-Technology/blob/main/Machine_To_Do.md

- [:recycle:] Residue Recycler:
   - Purpose: Processar resíduos (distiller residues, processing rejects) para recuperar parte dos insumos.
   - Operating Mode: Input residuos → output fraction de materiais + subprodutos; rendimento dependente do Precision Calibrator.
   - Tiers:
      - Basic: 10% recovery
      - Advanced: 20% recovery
      - Expert: 30% recovery
      - Ultimate: 50% recovery
   - Possible Upgrades: Recovery Module, Energy Efficiency, Catalyst Boost.  
   - Referência: https://github.com/DoriosStudios/Ascendant-Technology/blob/main/Machine_To_Do.md

- [:package:] Modular Catalyst Slot (elemento):
   - Purpose: Slot de módulos (efficiency chips, stability dampers, throughput caps) para personalização sem criar múltiplas variantes.
   - Operating Mode: Máquinas recebem N slots; módulos ocupam slot e aplicam modificador linear com penalidade empilhamento.
   - Tiers:
      - Basic: 1 slot
      - Advanced: 2 slots
      - Expert: 3 slots
      - Ultimate: 4 slots
   - Possible Upgrades: Slot Expansion, Module Sync, Negative Interaction Guard.  
   - Referência: https://github.com/DoriosStudios/Ascendant-Technology/blob/main/Machine_To_Do.md

- [:sparkles:] Residue Processor (implementação direta do To-Do):
   - Purpose: Processar e refinar subprodutos industriais em materiais reutilizáveis.
   - Operating Mode: Recebe resíduos → aplica recipe table → output variado; efficiency depende de calibrator e tier do processor.
   - Tiers:
      - Basic: low throughput
      - Advanced: med throughput
      - Expert: high throughput
      - Ultimate: batch-mode high throughput
   - Possible Upgrades: Speed, Yield, Energy.  
   - Referência: https://github.com/DoriosStudios/Ascendant-Technology/blob/main/Machine_To_Do.md

- [:test_tube:] Liquifier (implementação direta do To-Do):
   - Purpose: Converter sólidos/mixtures em líquidos (ex.: matérias para criar criofluido base ou dark matter precursors).
   - Operating Mode: Recipes por input; saída líquida armazenável em Reservoirs; controle por pressure/temperature.
   - Tiers:
      - Basic: single-conversion
      - Advanced: continuous conversion
      - Expert: multi-recipe
      - Ultimate: integrated with Distiller
   - Possible Upgrades: Purity Control, Throughput, Energy.  
   - Referência: https://github.com/DoriosStudios/Ascendant-Technology/blob/main/Machine_To_Do.md

- [:dna:] Catalyst Weaver (implementação direta do To-Do):
   - Purpose: Infundir catalisadores em matrizes (prepara insumos para Cloner / Duplicator / Energizer).
   - Operating Mode: Slot catalyst + base material → weave cycle → output catalyst-infused item.
   - Tiers:
      - Basic: single weave
      - Advanced: double weave
      - Expert: complex weave
      - Ultimate: macro-weave
   - Possible Upgrades: Weave Speed, Stability, Efficiency.  
   - Referência: https://github.com/DoriosStudios/Ascendant-Technology/blob/main/Machine_To_Do.md

- [:repeat_one:] Cloner:
   - Purpose: Clonar entidades/itens ou acelerar replicação (uso restrito, alto custo).
   - Operating Mode: Recebe template + energy + catalyst → clonation attempt; chance de corruption sem Stability/Cryo.
   - Tiers:
      - Basic: low success, low speed
      - Advanced: med success, med speed
      - Expert: high success, high speed
      - Ultimate: specialized templates support
   - Possible Upgrades: Success Rate, Energy Cap, Anti-Corrupt Module.  
   - Referência: https://github.com/DoriosStudios/Ascendant-Technology/blob/main/Machine_To_Do.md

- [:spark:] Energizer:
   - Purpose: Converter insumos em energia-temporary or energy-stores (buffers) para alimentar bursts (HPU peaks).
   - Operating Mode: Pode gerar energia steady ou burst; integrável a Flux Regulator e Reservoirs.
   - Tiers:
      - Basic: small buffer
      - Advanced: mid buffer + limited burst
      - Expert: large buffer + controlled bursts
      - Ultimate: grid integration
   - Possible Upgrades: Buffer Size, Discharge Rate, Efficiency.  
   - Referência: https://github.com/DoriosStudios/Ascendant-Technology/blob/main/Machine_To_Do.md

- [:gem:] Aetherium Condenser (novo com Aetherium):
   - Purpose: Processar Aetherium líquido/fragments → Aetherium shards/ingots; mantém propriedades interdimensionais para itens especiais.
   - Operating Mode: Recebe aetherium inputs + energy → condenser cycles → outputs shard/ingot depending on template; suporte para stabilizers.
   - Tiers:
      - Basic: shard output only
      - Advanced: small ingots
      - Expert: stabilized ingots
      - Ultimate: infusion-ready ingots
   - Possible Upgrades: Spatial Stabilizer, Yield, Anti-Void Coating.  
   - Referência: https://github.com/DoriosStudios/Ascendant-Technology/blob/main/Machine_To_Do.md

- [:droplet:] Dark Matter Crucible (novo com Dark Matter):
   - Purpose: Manipular Dark Matter líquido para forjas e infusão (ex.: duplicator, materialization).
   - Operating Mode: Requer containment (Titanium Frame), enorme energy input, gera heavy byproducts; somente líquidos manuseados.
   - Tiers:
      - Basic: containment small | high risk
      - Advanced: containment med | risk reduced
      - Expert: containment high | safer operations
      - Ultimate: secure reactor (automation allowed)
   - Possible Upgrades: Containment Strength, Energy Handling, Purification.  
   - Referência: https://github.com/DoriosStudios/Ascendant-Technology/blob/main/Machine_To_Do.md

- [:crystal_ball:] Interdimensional Gem Forge (Gema Interdimensional):
   - Purpose: Forjar Gema Interdimensional a partir de shards entre-dimensões + aetherium residues; output: gema (item único).
   - Operating Mode: Processo multi-stage; exige Cryo/ Dark Matter balancing + catalyst; falha = perda parcial dos shards.
   - Tiers:
      - Basic: attempts (low success)
      - Advanced: guided forging (med success)
      - Expert: stable forging (high success)
      - Ultimate: attuned gem (special effects)
   - Possible Upgrades: Success Booster, Dimensional Anchors, Fail-Safe Rollback (Redundancy Node).  
   - Referência: https://github.com/DoriosStudios/Ascendant-Technology/blob/main/Machine_To_Do.md

- [:wrench:] Hyper Processing Upgrade (HPU module variants):
   - Purpose: Variações de HPU adaptadas a classes (throughput-focused / stability-focused / balanced).
   - Operating Mode: Instalar HPU variant altera tradeoffs (ex.: x4 throughput com +instability vs x2 throughput com -instability).
   - Tiers:
      - Speed HPU: higher multiplier, higher instability
      - Stable HPU: lower multiplier, reduced instability
      - Balanced HPU: mid multiplier, mid instability
      - Cluster HPU: multi-slot sync (requires Titanium Frame)
   - Possible Upgrades: Cryo Efficiency Chip, Auto-Damp, Linked Redundancy.  
   - Referência: https://github.com/DoriosStudios/Ascendant-Technology/blob/main/Machine_To_Do.md

- [:gear:] Advanced Machine Frame:
   - Purpose: Structural base required for high-tier machines and modules.
   - Operating Mode: Passive component installed during crafting or machine upgrade.
   - Additional Fields:
     - Variants: Steel / Titanium / Aetherium-Reinforced.
     - Determines max upgrade slots, H.P.U compatibility and thermal tolerance.

- [:zap:] Hyper Processing Upgrade (H.P.U):
   - Purpose: Allow machines to execute multiple logical cycles per tick.
   - Operating Mode: Installed in compatible machines. Multiplies operations, energy consumption and instability generation.
   - Additional Fields:
     - Requires Cryofluid to operate.
     - Without sufficient Cryofluid, output degradation and corruption may occur.
     - Multipliers: x2 / x4 / x8 (machine-dependent).

- [:snowflake:] Cryogenic Processing Unit:
   - Purpose: Handle Cryofluid production, buffering and thermal stabilization.
   - Operating Mode: Multi-function machine that distills Cryofluid and supplies it to connected machines.
   - Additional Fields:
     - Cryofluid purity affects stabilization efficiency.
     - Passive loss over time if not actively cooled.
     - Integrates directly with Network Center.

- [:fire:] Thermal Control Module:
   - Purpose: Reduce heat and instability generated by machines under stress.
   - Operating Mode: Attach-in module or adjacent block that dissipates heat per tick.
   - Additional Fields:
     - Passive mode uses structural materials (Titanium/Aetherium).
     - Active mode consumes energy for increased dissipation.
     - Reduces Cryofluid consumption indirectly.

- [:bar_chart:] Network Center:
   - Purpose: Centralized monitoring and control of machines and clusters.
   - Operating Mode: Displays real-time data and allows configuration of connected machines.
   - Additional Fields:
     - Shows energy, fluid, instability and throughput metrics.
     - Allows enabling/disabling H.P.U per machine.
     - API hooks for addons and client-side dashboards.

- [:arrows_counterclockwise:] Load Balancer:
   - Purpose: Distribute energy and fluids intelligently across machines.
   - Operating Mode: Automatically prioritizes machines based on demand and assigned weight.
   - Additional Fields:
     - Emergency shedding mode when resources drop critically.
     - Works with Network Center profiles.

- [:package:] Batch Processor:
   - Purpose: Execute recipes in grouped batches to reduce overhead and spikes.
   - Operating Mode: Queues compatible recipes and processes them sequentially or in parallel.
   - Additional Fields:
     - Optimizes energy and Cryofluid usage.
     - Reduces instability accumulation in large setups.

- [:hammer:] Alloy & Infusion Forge:
   - Purpose: Process advanced materials such as Titanium Alloys, Aetherium and Dark Matter infusions.
   - Operating Mode: Recipe-based processing using energy and optional fluids.
   - Additional Fields:
     - Supports Dark Matter infusion for special outputs.
     - Accepts molds to define output form (plates, shards, cores).

- [:droplet:] Dark Matter Condenser:
   - Purpose: Stabilize and refine Dark Matter liquid for industrial use.
   - Operating Mode: Converts unstable Dark Matter into usable forms for machines.
   - Additional Fields:
     - Required for Duplicator and high-tier infusions.
     - Excess instability causes efficiency loss or shutdown.

- [:crystal_ball:] Aetherium Crystallizer:
   - Purpose: Convert liquid Aetherium into shards or solid ingots.
   - Operating Mode: Slow crystallization process influenced by temperature and stability.
   - Additional Fields:
     - Produces higher quality shards with better cooling.
     - Shards used in upgrades, frames and magical components.

- [:diamond:] Interdimensional Infuser:
   - Purpose: Create and process Interdimensional Gems.
   - Operating Mode: Long-cycle infusion combining materials from multiple dimensions.
   - Additional Fields:
     - Requires inputs from Overworld, Nether and End.
     - Outputs gems used exclusively for equipment and special upgrades.
     - Emits high instability during operation.

- [:recycle:] Residue Recycler:
   - Purpose: Recover usable materials from machine byproducts and waste.
   - Operating Mode: Processes residues into partial returns of original materials.
   - Additional Fields:
     - Efficiency affected by machine tier and upgrades.
     - Reduces long-term operational cost.

- [:wrench:] Modular Upgrade Slot:
   - Purpose: Allow fine-tuned customization of machine behavior.
   - Operating Mode: Accepts small upgrade modules instead of full blocks.
   - Additional Fields:
     - Examples: Efficiency Chip, Stability Damper, Throughput Capacitor.
     - Diminishing returns when stacking similar modules.

- [:warning:] Instability Regulator:
   - Purpose: Manage and suppress instability in machine clusters.
   - Operating Mode: Monitors instability levels and applies corrective actions.
   - Additional Fields:
     - Can throttle H.P.U automatically.
     - Prevents cascading failures in large networks.

- [:floppy_disk:] Redundancy Node:
   - Purpose: Protect machines from data and process corruption.
   - Operating Mode: Periodically snapshots machine state.
   - Additional Fields:
     - Allows partial rollback after instability events.
     - Consumes energy continuously.