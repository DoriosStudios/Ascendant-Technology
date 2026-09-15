// Reference matcher from main 4e16dc00b1e4b976d84d30f49013e4efe0b17455; retained for behavioral equivalence tests.

function matchRecipe(recipes, inputStack, catalystStacks, tank) {
    for (const recipe of recipes) {
        if (!recipe?.input || !recipe.output) continue
        if (!matchesStack(recipe.input, inputStack)) continue
        if (!matchesCatalysts(recipe.catalysts, catalystStacks)) continue
        
        // Check fluid type compatibility
        if (recipe.fluid?.type) {
            const tankType = tank.getType()
            if (tankType !== 'empty' && tankType !== recipe.fluid.type) continue
        }
        
        return recipe
    }
    return null
}

function matchesStack(requirement, stack) {
    if (!stack) return false
    return stack.typeId === requirement.id && stack.amount >= (requirement.amount ?? 1)
}

function matchesCatalysts(requirements = [], stacks) {
    const requirementTotals = getCatalystRequirementTotals(requirements)
    const stackTotals = getCatalystStackTotals(stacks)

    if (requirementTotals.size === 0) return stackTotals.size === 0
    if (stackTotals.size === 0) return false

    for (const [type, available] of stackTotals.entries()) {
        if (!requirementTotals.has(type)) return false
        if (available <= 0) return false
    }

    for (const [type, needed] of requirementTotals.entries()) {
        if ((stackTotals.get(type) ?? 0) < needed) return false
    }

    return true
}

function getCatalystRequirementTotals(requirements = []) {
    return aggregateCatalystEntries(requirements?.filter(Boolean) ?? [], req => req.id, req => req.amount ?? 1)
}

function getCatalystStackTotals(stacks = []) {
    return aggregateCatalystEntries(stacks?.filter(Boolean) ?? [], stack => stack.typeId, stack => stack.amount ?? 0)
}

function aggregateCatalystEntries(entries, idSelector, amountSelector) {
    const totals = new Map()
    for (const entry of entries) {
        const id = idSelector(entry)
        if (!id) continue
        const amount = amountSelector(entry)
        if (!amount || amount <= 0) continue
        totals.set(id, (totals.get(id) ?? 0) + amount)
    }
    return totals
}

export { matchRecipe };
