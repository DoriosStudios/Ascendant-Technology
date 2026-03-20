// Central registry for custom properties (block states, dynamic properties, tags, etc.)
// Add entries here so JSON files and JS scripts share the same source of truth.
// Minimal shape of each entry:
// {
//   description: string,
//   kind: 'block_state' | 'dynamic_property' | 'tag' | 'component' | 'other',
//   type: 'boolean' | 'int' | 'float' | 'string' | 'enum',
//   values?: number[] | string[], // allowed values (for enums or bounded ints)
//   default?: number | string | boolean,
//   notes?: string,
//   jsonPaths?: string[], // where it appears in BP/RP JSON (optional doc)
// }

/**
 * @typedef {Object} PropertyMeta
 * @property {string} description  Texto curto exibido no hover e na doc.
 * @property {'block_state'|'dynamic_property'|'tag'|'component'|'other'} kind  Escopo/onde vive.
 * @property {'boolean'|'int'|'float'|'string'|'enum'} type  Tipo lógico.
 * @property {Array<number|string>=} values  Valores permitidos (enum ou faixa limitada).
 * @property {number|string|boolean=} default  Valor padrão.
 * @property {string=} notes  Observações adicionais.
 * @property {string[]=} jsonPaths  Onde costuma aparecer (para referência).
 */

/** Block-state: functional toggle of the block (false = off, true = on). */
export const STATE_IS_ON = "utilitycraft:isOn";
/** Block-state: upgrade level index for range (0-15). Higher index unlocks larger reach. */
export const STATE_RANGE = "utilitycraft:range";
/** Block-state: currently selected reach in meters (enumerated distances). */
export const STATE_RANGE_SELECTED = "utilitycraft:rangeSelected";
/** Block-state: filter upgrade toggle (0 = absent, 1 = installed/enabled). */
export const STATE_FILTER = "utilitycraft:filter";
/** Dynamic property (entity): per-entity cooldown applied to teleported mobs. */
export const DYN_MAGNET_COOLDOWN = "utilitycraft:mob_magnet_cooldown";

/** @type {Record<string, PropertyMeta>} */
export const PROPERTY_REGISTRY = {
  [STATE_IS_ON]: {
    description: 'Functional switch of the Mob Magnet (false = off, true = on). Disabling pauses pulls and light emission.',
    kind: 'block_state',
    type: 'boolean',
    values: [0, 1],
    default: 0,
    notes: 'Used by permutations for on/off texture and light. Scripts mirror this into persisted state.',
    jsonPaths: [
      'BP/blocks/**',
      'BP/scripts/machinery/**'
    ]
  },

  [STATE_RANGE]: {
    description: 'Range upgrade level index (0-15). Higher index unlocks a wider selectable reach.',
    kind: 'block_state',
    type: 'enum',
    values: [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15],
    default: 0,
    notes: 'Represents the maximum unlocked range tier. Actual selected distance is in utilitycraft:rangeSelected.',
    jsonPaths: ['BP/blocks/**']
  },

  [STATE_RANGE_SELECTED]: {
    description: 'Currently selected reach in meters (from the predefined distances). Clamped by the upgrade level.',
    kind: 'block_state',
    type: 'enum',
    values: [2,4,6,8,10,12,14,16,18,20,22,24,26,28,30,32],
    default: 2,
    notes: 'Written by UI when the player picks a distance. Should not exceed the tier unlocked by utilitycraft:range.',
    jsonPaths: ['BP/blocks/**']
  },

  [STATE_FILTER]: {
    description: 'Filter upgrade toggle (0 = not installed, 1 = installed). Enables whitelist/blacklist UI.',
    kind: 'block_state',
    type: 'boolean',
    values: [0, 1],
    default: 0,
    jsonPaths: ['BP/blocks/**']
  },

  [DYN_MAGNET_COOLDOWN]: {
    description: 'Cooldown individual aplicado em mobs puxados pelo imã.',
    kind: 'dynamic_property',
    type: 'int',
    default: 0,
    notes: 'Armazenado por entidade; usado para não teletransportar o mesmo mob em ticks consecutivos.',
    jsonPaths: ['BP/scripts/blocks/mob_magnet.js']
  },
};

/** Obtém metadados completos da propriedade. */
export function getPropertyMeta(id) {
  return PROPERTY_REGISTRY[id];
}

/** Lança erro amigável se a propriedade não estiver registrada. */
export function requirePropertyMeta(id) {
  const meta = PROPERTY_REGISTRY[id];
  if (!meta) {
    throw new Error(`Property not registered: ${id}`);
  }
  return meta;
}

/** Lista propriedades, com filtro opcional por kind (ex.: 'block_state'). */
export function listProperties(kind) {
  if (!kind) return Object.entries(PROPERTY_REGISTRY);
  return Object.entries(PROPERTY_REGISTRY).filter(([, meta]) => meta.kind === kind);
}

/** Helper para obter descrição curta diretamente. */
export function getPropertyDescription(id) {
  return PROPERTY_REGISTRY[id]?.description;
}

/** Valor padrão registrado (ou undefined se não existir). */
export function getPropertyDefault(id) {
  return PROPERTY_REGISTRY[id]?.default;
}
