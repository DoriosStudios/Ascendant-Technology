// ==================================================
// Ascendant Technology – Main Recipe Loader
// ==================================================
// Central file that imports all recipe definitions
// and registers them into DoriosAPI.
//
// Folder structure:
//   config/
//   ├─ recipes/
//   │  ├─ crafter.js
//   │  ├─ crusher.js
//   │  ├─ fuel.js
//   │  ├─ furnace.js
//   │  ├─ infuser.js
//   │  ├─ melter.js
//   │  ├─ press.js
//   │  └─ sieve.js
//   └─ recipes/plants.js
// ==================================================

import './recipes/duplicator.js';
import './recipes/catalyst_weaver.js';
import './recipes/arc_press_forge.js';
import './recipes/industrial_burner.js';
import './recipes/pulverizer.js';
import './recipes/centrifugal_siever.js';
import './recipes/abyssal_fisher.js';
import './recipes/genetic_seed_synthesizer.js';
import './recipes/verdant_cultivator.js';
import './recipes/liquifier.js';
import './recipes/energizer.js';
import './recipes/residue_processor.js';

import './recipes/added/insert_sieve.js';
import './recipes/added/insert_infuser.js';
import './recipes/added/insert_crusher.js';
import './recipes/added/insert_incinerator.js';
import './recipes/added/insert_press.js';

import './fluids/items.js';
import './fluids/coolant_register.js';
import './fluids/capsule_world_interaction.js';

// Dynamic properties used across the pack (overclock burn/power/eff etc.)
