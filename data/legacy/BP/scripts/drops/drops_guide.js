/**
 * Drop System IntelliSense Guide (no runtime code)
 *
 * Este arquivo contém apenas typedefs/JSDoc para ajudar o IntelliSense.
 * Referencie-o no `drops.js` via:
 * /// <reference path="./drops_guide.js" />
 *
 * Notas rápidas:
 * - chances aceitam 0–1 ou 0–100 (ex.: 0.25 ou 25).
 * - timeRange usa ticks (0–23999). Se min > max, atravessa a meia-noite.
 * - para referência/autocomplete de partículas, use `DROPS_PARTICLES` de `particle_catalog.js`.
 * - clima ainda não é exposto pela API → não há propriedade weather aqui.
 */

/**
 * Handler típico usado dentro de `DROPS_LIBRARY`.
 *
 * @callback DropHandler
 * @param {DropContext} context - Dados completos do bloco quebrado.
 * @returns {DropResult | import('@minecraft/server').ItemStack[] | null}
 * @example
 * // Drops com base na config
 * const handler = (context) => computeDrops(context, {
 *   dropId: "utilitycraft:aetherium_shard",
 *   baseRange: [1, 2]
 * });
 */

/**
 * @typedef {Object} DropContext
 * @property {import('@minecraft/server').Block} block - Bloco quebrado. Ex: `context.block.typeId`.
 * @property {import('@minecraft/server').Player} player - Jogador que quebrou. Ex: `context.player.name`.
 * @property {import('@minecraft/server').Dimension} dimension - Dimensão atual. Ex: `context.dimension.id`.
 * @property {import('@minecraft/server').ItemStack | undefined} tool - Ferramenta usada (ou undefined). Ex: `context.tool?.typeId`.
 * @property {number} fortuneLevel - Nível de Fortune (0 se não houver). Ex: `context.fortuneLevel`.
 * @property {boolean} hasSilkTouch - True quando Silk Touch estiver ativo.
 * @example
 * if (context.hasSilkTouch) {
 *   // trata silk
 * }
 */

/**
 * @typedef {Object} ExcavateBridgeSettings
 * @property {boolean=} enabled - Ativa o bridge por script event.
 * @property {'loot_table'|'destroy_command'|'break_then_regen_loot_table'=} vanillaDropMode - Método vanilla para obter drops no bridge.
 * @property {boolean=} useLootTables - Legado. `true` => loot_table, `false` => destroy_command.
 */

/**
 * @typedef {Object} FortuneTier
 * @property {number} level - Nível exato de Fortune. Ex: `3`.
 * @property {[number, number]} range - Quantidade mínima/máxima. Ex: `[2, 5]`.
 * @example
 * { level: 2, range: [1, 3] }
 */

/**
 * @typedef {Object} FortuneMath
 * @property {'multiplier'|'bonus'} mode - Como escalar. Ex: `"multiplier"`.
 * @property {[number, number]} perLevel - Multiplicador por nível ou bônus fixo. Ex: `[0.2, 0.35]`.
 * @property {[number, number]=} cap - Limite final opcional. Ex: `[10, 14]`.
 * @example
 * { mode: "bonus", perLevel: [1, 1.5], cap: [12, 16] }
 */

/**
 * @typedef {Object} DropSound
 * @property {string} id - Som do Minecraft. Ex: `"dig.deepslate"`.
 * @property {number=} volume - Volume (0–1). Ex: `0.7`.
 * @property {number=} pitch - Pitch (0.5–2). Ex: `1.2`.
 * @example
 * { id: "random.fizz", volume: 0.6, pitch: 1.5 }
 */

/**
 * @typedef {Object} DropParticle
 * @property {string} id - Partícula. Ex: `"minecraft:basic_smoke_particle"` ou `DROPS_PARTICLES.BASIC_SMOKE`.
 * @property {number=} count - Quantas vezes spawnar (default: 1).
 * @property {number=} chance - Chance 0–1 ou 0–100.
 * @property {{x:number,y:number,z:number}=} offset - Offset fixo. Ex: `{ x: 0, y: 0.2, z: 0 }`.
 * @property {number=} spread - Dispersão aleatória. Ex: `0.25`.
 * @example
 * { id: "minecraft:basic_smoke_particle", count: 4, chance: 0.3, spread: 0.2 }
 */

/**
 * @typedef {Object} DropEffect
 * @property {string} id - Efeito. Ex: `"minecraft:haste"` (ou `"haste"`, que será normalizado).
 * @property {number} duration - Duração em ticks. Ex: `200`.
 * @property {number=} amplifier - Intensidade. Ex: `1`.
 * @property {number=} chance - Chance 0–1 ou 0–100.
 * @property {boolean=} showParticles - Mostrar partículas do efeito.
 * @example
 * { id: "minecraft:haste", duration: 200, amplifier: 1, chance: 0.5, showParticles: false }
 * // Também válido:
 * // { id: "haste", duration: 200 }
 */

/**
 * @typedef {Object} ExtraDropEntry
 * @property {string} dropId - Item extra. Ex: `"minecraft:gold_nugget"`.
 * @property {[number, number]=} amountRange - Intervalo do drop. Ex: `[1, 3]`.
 * @property {number=} amount - Atalho para valor fixo. Ex: `2`.
 * @property {number=} chance - Chance 0–1 ou 0–100. Ex: `15`.
 * @property {FortuneMath=} fortuneMath - Escala com Fortune.
 * @property {FortuneTier[]=} fortuneTiers - Tiers de Fortune.
 * @example
 * { dropId: "minecraft:gold_nugget", amountRange: [1, 2], chance: 0.2 }
 */

/**
 * @typedef {Object} DropConditions
 * @property {string|string[]=} dimension - Dimensões permitidas. Ex: `"overworld"` ou `["nether", "the_end"]`.
 * @property {string|string[]=} biome - Biomas permitidos (se API suportar). Ex: `"minecraft:plains"`.
 * @property {[number, number]=} timeRange - Faixa de tempo. Ex: `[12000, 23000]`.
 * @property {boolean=} playerSneaking - Exige que o player esteja agachado.
 * @property {string|string[]=} playerGameMode - Modos permitidos. Ex: `"survival"`.
 * @property {string|string[]=} toolType - Tags exigidas. Ex: `"minecraft:is_pickaxe"`.
 * @property {Record<string, string|number|boolean>=} blockStates - Estados do bloco. Ex: `{ "utilitycraft:axis": "north" }`.
 * @example
 * { dimension: "overworld", timeRange: [0, 8000], playerSneaking: true }
 */

/**
 * @typedef {Object} SpecialToolOverride
 * @property {string} toolId - Item exato. Ex: `"utilitycraft:smelting_pickaxe"`.
 * @property {string=} dropId - Drop alternativo para a ferramenta.
 * @property {string=} silkDropId - Drop alternativo com Silk Touch.
 * @property {[number, number]=} baseRange - Intervalo padrão. Ex: `[1, 1]`.
 * @property {string=} originalDropId - Drop vanilla a remover quando usar substituição.
 * @property {string=} replaceDropId - Drop que substitui o original sem cancelar a quebra.
 * @property {'replace'|'supplement'|'vanilla'=} dropMode - Como lidar com o drop vanilla quando este override é aplicado.
 *   - `replace`: substitui o drop vanilla (cancela a quebra).
 *   - `supplement`: mantém o vanilla e adiciona extras (não cancela).
 *   - `vanilla`: não gera o drop base (só extras/efeitos).
 * @property {FortuneTier[]=} fortuneTiers - Tiers customizados.
 * @property {FortuneMath=} fortuneMath - Escala customizada.
 * @property {string|string[]=} toolType - Tag extra exigida. Ex: `"utilitycraft:is_hammer"`.
 * @property {DropSound|string=} sound - Som especial ao aplicar override.
 * @property {DropSound|string=} baseSound - Som base do bloco.
 * @property {boolean=} omitSpecialSound - Ignora `sound` do override.
 * @property {'auto'|'player'|'orb'|'none'=} xpMode - How XP is awarded.
 * @property {DropConditions=} conditions - Condições adicionais.
 * @example
 * {
 *   toolId: "utilitycraft:smelting_pickaxe",
 *   dropId: "utilitycraft:titanium",
 *   sound: { id: "random.fizz", volume: 0.6, pitch: 1.4 }
 * }
 */

/**
 * @typedef {Object} DropEntry
 * @property {string=} dropId - Drop principal. Ex: `"minecraft:iron_ore"`.
 * @property {string=} silkDropId - Drop com Silk Touch. Ex: `"minecraft:stone"`.
 * @property {[number, number]=} baseRange - Range base. Ex: `[1, 2]`.
 * @property {string=} originalDropId - Drop vanilla a remover quando usar substituição.
 * @property {string=} replaceDropId - Drop que substitui o original sem cancelar a quebra.
 * @property {'replace'|'supplement'|'vanilla'=} dropMode - Como lidar com o drop vanilla.
 *   - `replace`: substitui o drop vanilla (cancela a quebra).
 *   - `supplement`: mantém o vanilla e adiciona extras (não cancela).
 *   - `vanilla`: não gera o drop base (só extras/efeitos).
 * @property {'auto'|'player'|'orb'|'none'=} xpMode - How XP is awarded.
 * @property {boolean=} replaceVanilla - Legado: `true` → replace, `false` → supplement.
 * @property {string|string[]=} toolType - Tag(s) exigidas. Ex: `"minecraft:is_pickaxe"`.
 * @property {FortuneTier[]=} fortuneTiers - Tiers de Fortune.
 * @property {FortuneMath=} fortuneMath - Escala dinâmica.
 * @property {SpecialToolOverride[]=} specialTools - Overrides por ferramenta.
 * @property {DropSound|string=} baseSound - Som base do bloco.
 * @property {boolean=} omitSpecialSound - Ignorar som especial do override.
 * @property {boolean=} suppressVanillaSound - Não tocar som fallback ao substituir vanilla.
 * @property {DropParticle[]=} particles - Partículas extras.
 * @property {DropEffect[]=} statusEffects - Efeitos no player.
 * @property {ExtraDropEntry[]=} extraDrops - Drops extras com chance.
 * @property {number|[number, number]=} xp - XP extra. Ex: `3` ou `[1, 5]`.
 * @property {'auto'|'player'|'orb'|'none'=} xpMode - How XP is awarded.
 * @property {string[]=} commands - Comandos pós-quebra.
 * @property {'player'|'dimension'=} commandTarget - Quem executa comandos.
 * @property {DropConditions=} conditions - Condições adicionais.
 * @example
 * {
 *   dropId: "utilitycraft:aetherium_shard",
 *   baseRange: [1, 2],
 *   fortuneMath: { mode: "multiplier", perLevel: [0.2, 0.4] },
 *   particles: [{ id: "minecraft:basic_smoke_particle", count: 2, chance: 0.3 }]
 * }
 */

/**
 * @typedef {Object} DropResult
 * @property {ItemStack[]} drops - Itens finais a spawnar.
 * @property {boolean=} replaceVanilla - Substitui drops vanilla.
 * @property {DropSound|string=} sound - Som especial (override).
 * @property {DropSound|string=} baseSound - Som base do bloco.
 * @property {boolean=} omitSpecialSound - Ignora som especial.
 * @property {boolean=} suppressVanillaSound - Suprime som fallback.
 * @property {DropParticle[]=} particles - Partículas extras.
 * @property {DropEffect[]=} statusEffects - Efeitos no player.
 * @property {number|[number, number]=} xp - XP extra.
 * @property {'auto'|'player'|'orb'|'none'=} xpMode - How XP is awarded.
 * @property {string[]=} commands - Comandos.
 * @property {'player'|'dimension'=} commandTarget - Quem executa comandos.
 * @property {string=} replaceOriginalId - Vanilla item to remove when replacing without cancel.
 * @property {import('@minecraft/server').ItemStack[]=} replaceDrops - Drops spawned after replacement.
 * @example
 * {
 *   drops: [new ItemStack("minecraft:diamond", 1)],
 *   replaceVanilla: true,
 *   baseSound: "dig.stone"
 * }
 */
