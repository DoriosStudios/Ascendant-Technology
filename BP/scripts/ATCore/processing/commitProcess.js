/**
 * Commit a completed recipe locally. Do not include I/O or world mutations in
 * `commit`: only the listed inventory slots and resource buffers are restored.
 */
export function commitProcess(machine, result, slots, resources, commit) {
    const items = slots.map(slot => machine.container.getItem(slot)?.clone());
    const amounts = resources.map(storage => storage.get());
    try {
        commit();
        return true;
    } catch {
        for (let index = 0; index < slots.length; index++) machine.container.setItem(slots[index], items[index]);
        for (let index = 0; index < resources.length; index++) {
            const delta = amounts[index] - resources[index].get();
            if (delta) resources[index].add(delta);
        }
        // Keep the paid progress for a later retry; never produce twice.
        result.progress += Math.ceil(result.processCount / result.batch) * result.cost;
        result.processCount = 0;
        return false;
    }
}
