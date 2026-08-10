// @ts-check

/**
 * Metadata announced by this DoriosLib installation to other addons in the
 * world through `dorios:dependency_checker`.
 *
 * Add dependency requirements to `dependencies` when Ascendant Technology
 * starts depending on another Dorios addon.
 *
 * @type {import("./dependencies/index.js").AddonMetadata}
 */
export const ADDON_METADATA = {
  name: "UtilityCraft: Ascendant Technology",
  author: "Dorios Studios",
  identifier: "ascendant_technology",
  version: "0.9.0",
  dependencies: {
    utilitycraft: {
      name: "UtilityCraft",
      version: "3.5.1",
      warning: "Ascendant Technology requires UtilityCraft 3.5.1 or newer.",
    },
  },
};

/** @type {import("./dependencies/index.js").InitializeOptions} */
export const DEPENDENCY_OPTIONS = {
  validationDelayTicks: 300,
  announceSuccess: true,
};
