// Display-only scale requested for recipe books: each unit is 100 of the previous.
module.exports = function formatFluidVolume(amount) {
    const units = ['mB', 'B', 'KB', 'MB', 'GB'];
    let value = Number(amount), unit = 0;
    while (Math.abs(value) >= 100 && unit < units.length - 1) {
        value /= 100;
        unit++;
    }
    if (Math.abs(Number(value.toFixed(2))) >= 100 && unit < units.length - 1) {
        value /= 100;
        unit++;
    }
    return `${Number(value.toFixed(2))} ${units[unit]}`;
};
