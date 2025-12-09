import { Machine, Energy } from '../managers_extra.js'

const ENERGY_COST = 400
const SCAN_COOLDOWN_TICKS = 40 // scan every 2 seconds (20tps)
const MAX_VISITED = 4096 // safety cap to avoid runaway graphs
const MAX_LINES_SUMMARY = 3 // limitar detalhes para não poluir UI

/*
Slots (inventory_size: 6)
Painéis de exibição:
  [0] Output (Gasto):
      - Mostra o número de máquinas conectadas, baterias e demanda livre de energia.
  [1] Cálculos Gasto:
      - Exibe a capacidade total, energia ocupada e energia livre da rede.
  [2] Δ Energia (Resumo):
      - Apresenta o balanço energético: input, output, saldo e status do scan.
  [3] Input (Geração):
      - Indica o número de geradores, nós e cabos conectados à rede.
  [4] Cálculos Input:
      - Mostra energia armazenada, porcentagem do buffer e status geral (Stable, Deficit, Buffer Full).
[5] Exibição de energia (machine.displayEnergy usa slot 5).
Slots escondidos: nenhum.
*/

DoriosAPI.register.blockComponent('network_center', {
    beforeOnPlayerPlace(e, { params: settings }) {
        Machine.spawnMachineEntity(e, settings, () => {
            const machine = new Machine(e.block, settings, true)
            if (!machine?.entity) return
            machine.setEnergyCost(settings?.machine?.energy_cost ?? ENERGY_COST)
            machine.displayEnergy(5)
        })
    },

    onTick(e, { params: settings }) {
        if (!globalThis.worldLoaded) return
        const machine = new Machine(e.block, settings)
        if (!machine.valid) return

        const cost = settings?.machine?.energy_cost ?? ENERGY_COST
        machine.setEnergyCost(cost)

        const energy = machine.energy.get()
        if (energy <= 0) {
            machine.showWarning('No Network', false)
            machine.off()
            return
        }

        const spend = Math.min(energy, machine.rate, cost)
        if (spend > 0) {
            machine.energy.consume(spend)
            machine.addProgress(spend)
        }

        // Scan with cooldown
        const currentCd = Math.max(0, machine.entity.getDynamicProperty('nc:cooldown') ?? 0)
        if (currentCd > 0) {
            machine.entity.setDynamicProperty('nc:cooldown', currentCd - 1)
        } else {
            const summary = scanNetwork(machine)
            machine.entity.setDynamicProperty('nc:cooldown', SCAN_COOLDOWN_TICKS)
            renderPanels(machine, summary)
        }

        machine.displayEnergy(5)
        machine.on()
    },

    onPlayerBreak(e) {
        const dim = e.block.dimension
        const entity = dim.getEntitiesAtBlockLocation(e.block.location)[0]
        if (entity) {
            const inv = entity.getComponent('inventory')?.container
            if (inv) {
                for (let i = 0; i < Math.min(inv.size, 5); i++) {
                    inv.setItem(i, undefined)
                }
            }
        }
        Machine.onDestroy(e)
    }
})

function scanNetwork(machine) {
    const dim = machine.block.dimension
    const base = machine.block.location
    const offsets = [
        { x: 1, y: 0, z: 0 },
        { x: -1, y: 0, z: 0 },
        { x: 0, y: 1, z: 0 },
        { x: 0, y: -1, z: 0 },
        { x: 0, y: 0, z: 1 },
        { x: 0, y: 0, z: -1 },
    ]

    const queue = [base]
    const visited = new Set()

    const summary = {
        nodes: 0,
        cables: 0,
        generators: 0,
        machines: 0,
        batteries: 0,
        batteryStored: 0,
        batteryCap: 0,
        stored: 0,
        cap: 0,
        truncated: false,
        genTypes: new Map(),
        machineTypes: new Map(),
        batteryTypes: new Map(),
    }

    while (queue.length > 0) {
        if (visited.size > MAX_VISITED) {
            summary.truncated = true
            break
        }

        const pos = queue.shift()
        const key = `${pos.x}|${pos.y}|${pos.z}`
        if (visited.has(key)) continue
        visited.add(key)

        const block = dim.getBlock(pos)
        if (!block || !block.hasTag('dorios:energy')) continue

        // Traverse neighbors regardless to keep spanning
        for (const off of offsets) {
            queue.push({ x: pos.x + off.x, y: pos.y + off.y, z: pos.z + off.z })
        }

        if (block.typeId === 'utilitycraft:energy_cable') {
            summary.cables++
            continue
        }

        // Skip counting the center block as a node if desired
        const isCenter = pos.x === base.x && pos.y === base.y && pos.z === base.z

        const entity = dim.getEntitiesAtBlockLocation(pos)[0]
        const family = entity?.getComponent('minecraft:type_family')
        const isGenerator = family?.hasTypeFamily('dorios:energy_source')
        const isContainer = family?.hasTypeFamily('dorios:energy_container')
        const isMachine = block.hasTag('dorios:machine')
        const isBatteryTag = block.hasTag('dorios:battery')
        const countsAsBattery = isContainer || isBatteryTag
        const countsAsMachine = isMachine
        const countsAsGenerator = isGenerator && !countsAsBattery && !countsAsMachine

        if (!isCenter) {
            summary.nodes++
            const blockKey = block.typeId
            if (countsAsMachine) {
                summary.machines++
                incrementCount(summary.machineTypes, blockKey)
            } else if (countsAsBattery) {
                summary.batteries++
                incrementCount(summary.batteryTypes, blockKey)
            } else if (countsAsGenerator) {
                summary.generators++
                incrementCount(summary.genTypes, blockKey)
            }
        }

        if (entity) {
            const mgr = new Energy(entity)
            const stored = mgr.get()
            const cap = mgr.getCap()
            summary.stored += stored
            summary.cap += cap

            if (countsAsBattery && !countsAsMachine) {
                summary.batteryStored += stored
                summary.batteryCap += cap
            }
        }
    }

    return summary
}

function renderPanels(machine, summary) {
    const fillPct = summary.cap > 0 ? (summary.stored / summary.cap) * 100 : 0
    const free = Math.max(0, summary.cap - summary.stored)

    // Fluxo aproximado: diferença de energia entre scans / intervalo em ticks
    const prevStored = machine.entity.getDynamicProperty('nc:lastStored') ?? summary.stored
    const delta = summary.stored - prevStored
    const netPerTick = delta / SCAN_COOLDOWN_TICKS
    machine.entity.setDynamicProperty('nc:lastStored', summary.stored)

    let status = 'Stable'
    if (fillPct < 15) status = 'Deficit'
    else if (fillPct > 95) status = 'Buffer Full'
    else if (netPerTick > 0) status = 'Charging'
    else if (netPerTick < 0) status = 'Draining'

    const netText = Energy.formatEnergyToText(Math.abs(netPerTick))
    const inflowText = netPerTick > 0 ? netText : '0 DE'
    const outflowText = netPerTick < 0 ? netText : '0 DE'

    const topMachines = summarizeTopLines(summary.machineTypes)
    const topGens = summarizeTopLines(summary.genTypes)
    const topBats = summarizeTopLines(summary.batteryTypes)

    // Left side: Consumption
    const panelOutA = {
        title: '§cConsumption',
        lore: [
            `§7Machines: §f${summary.machines}`,
            ...topMachines,
            `§7Batteries: §f${summary.batteries}`,
            ...topBats,
            `§7Net Outflow: §f${outflowText}/t`
        ]
    }
    const panelOutB = {
        title: '§cStorage',
        lore: [
            `§7Stored: §f${Energy.formatEnergyToText(summary.stored)}`,
            `§7Capacity: §f${Energy.formatEnergyToText(summary.cap)}`,
            `§7Free: §f${Energy.formatEnergyToText(free)}`,
            `§7Bat. Cap: §f${Energy.formatEnergyToText(summary.batteryCap)}`
        ]
    }

    // Center: Balance
    const panelMid = {
        title: '§fEnergy',
        lore: [
            `§7Net: §f${netText}/t`,
            `§7Buffer: §f${fillPct.toFixed(1)}%%`,
            summary.truncated ? '§cNetwork truncated (too many nodes)' : '§7Scan §aOK'
        ]
    }

    // Right side: Inputs
    const panelInA = {
        title: '§aInput',
        lore: [
            `§7Generators: §f${summary.generators}`,
            ...topGens,
            `§7Nodes: §f${summary.nodes}`,
            `§7Cables: §f${summary.cables}`
        ]
    }
    const panelInB = {
        title: '§aFlow',
        lore: [
            `§7Net Inflow: §f${inflowText}/t`,
            `§7Status: §f${status}`
        ]
    }

    const contents = [panelOutA, panelOutB, panelMid, panelInA, panelInB]
    const withReset = (text = '') => text.startsWith('§r') ? text : `§r${text}`

    for (const panel of contents) {
        panel.title = withReset(panel.title)
        if (Array.isArray(panel.lore)) {
            panel.lore = panel.lore.map(withReset)
        }
    }
    const slots = [0, 1, 2, 3, 4]

    if (typeof machine.setLabels === 'function') {
        machine.setLabels(contents, slots)
    } else {
        // Fallback for older runtime: apply one by one
        for (let i = 0; i < contents.length; i++) {
            machine.setLabel(contents[i], slots[i])
        }
    }
}

function incrementCount(map, key) {
    if (!key) return
    const curr = map.get(key) || 0
    map.set(key, curr + 1)
}

function summarizeTopLines(map) {
    if (!map || map.size === 0) return []
    const sorted = [...map.entries()].sort((a, b) => b[1] - a[1])
    const limited = sorted.slice(0, MAX_LINES_SUMMARY)
    return limited.map(([k, v]) => `§h- ${v}x ${formatBlockName(k)}`)
}

function formatBlockName(id = '') {
    const fmt = DoriosAPI?.utils?.formatIdToText
    const raw = typeof fmt === 'function'
        ? fmt(id)
        : (id.split(':')[1] || id)
    const max = 24
    return raw.length <= max ? raw : `${raw.slice(0, max - 3)}...`
}
