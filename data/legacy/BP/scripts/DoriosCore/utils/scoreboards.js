import { world } from "@minecraft/server";

/**
 * Retrieves a scoreboard objective by id, or creates it if it does not exist.
 *
 * @param {string} id The unique identifier of the scoreboard objective.
 * @param {string} [display=id] The display name shown in the scoreboard. Defaults to the id.
 * @returns {ScoreboardObjective} The existing or newly created scoreboard objective.
 */
export function getOrCreateObjective(id, display = id) {
    return world.scoreboard.getObjective(id)
        ?? world.scoreboard.addObjective(id, display);
}

/**
 * Ensures a set of scoreboard objectives exist and returns them as an object.
 *
 * Each entry in the `definitions` array must be a tuple of `[id, displayName]`.
 * If the display name is omitted, the objective id will be used as its display name.
 *
 * @param {Array.<[string, string?]>} definitions Array of objectives to load, each with an id and optional display name.
 * @param {Record<string, ScoreboardObjective>} [target] Optional object where objectives will be stored.
 * @returns {Record<string, ScoreboardObjective>} An object containing the objectives, keyed by their ids.
 */
export function loadObjectives(definitions, target = {}) {
    for (const [id, display] of definitions) {
        target[id] = getOrCreateObjective(id, display);
    }
    return target;
}
