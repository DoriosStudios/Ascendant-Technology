/**
 * Resolves Trouble chance through a deliberately back-loaded level curve.
 * The configured base and cap are preserved, but early levels no longer
 * consume most of the available growth.
 */
export function getTroubleChance(effect, level) {
    const baseChance = Math.max(0, Number(effect?.baseChance ?? 0.01) || 0.01);
    const maxChance = Math.max(baseChance, Number(effect?.maxChance ?? 0.2) || 0.2);
    const normalizedLevel = Math.max(1, Math.min(200, Math.floor(Number(level) || 1)));

    let curveProgress = 0;
    if (normalizedLevel <= 50) {
        curveProgress = ((normalizedLevel - 1) / 49) * 0.1;
    } else if (normalizedLevel <= 100) {
        curveProgress = 0.1 + ((normalizedLevel - 50) / 50) * 0.25;
    } else {
        curveProgress = 0.35 + ((normalizedLevel - 100) / 100) * 0.65;
    }

    return Math.min(maxChance, baseChance + (maxChance - baseChance) * curveProgress);
}

export function getTripleTroubleChance(doubleTrouble, tripleTrouble, level) {
    if (!doubleTrouble || !tripleTrouble) return 0;
    return getTroubleChance(doubleTrouble, level)
        * Math.max(0, Number(tripleTrouble.chanceScale ?? 0.1) || 0);
}
