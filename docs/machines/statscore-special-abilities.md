# StatsCore Special Abilities

Reference page for the special abilities currently used by StatsCore equipment.

Most special abilities are **awakened in the Refining Table**. If an item still has its ability locked, the first successful awakening consumes a **Runic Core**.

## Combat and hybrid abilities

- **Bleeding**
	- **Equipment:** Sword
	- **Effect:** Hits can apply a bleed that keeps damaging the target over time, now with red dust particles on each bleed tick.

- **Sweeping**
	- **Equipment:** AIOT
	- **Effect:** Exclusive to AIOTs, releasing wide strikes that damage nearby enemies.

- **Skewer**
	- **Equipment:** Spear
	- **Effect:** Hits can mark targets so follow-up damage lands harder.

- **Aftershock**
	- **Equipment:** Mace
	- **Effect:** Triggers a shockwave that affects nearby mobs in a **7.5-block radius**, applying **Levitation V for 2 seconds** and then **Slowness IV for 5 seconds**.

- **Harpoon**
	- **Equipment:** Trident
	- **Effect:** Marks struck targets and, when combined with **Loyalty**, launches the user strongly in the look direction while briefly preventing fall damage.

- **Deadeye**
	- **Equipment:** Bow
	- **Effect:** Bow hits attempt to calm the struck entity using that mob's calm event.

- **Ballista**
	- **Equipment:** Crossbow
	- **Effect:** Marks the struck target and chains into up to **3** extra nearby targets.

- **Reaper**
	- **Equipment:** Hoe
	- **Effect:** Adds **+2 Attack Damage**, damages nearby mobs of the same type as the original target, and also powers the crop-harvest behavior listed below.

- **Berserk**
	- **Equipment:** Diamond / Netherite / Titanium / Aetherium Axes
	- **Effect:** Killing enemies builds temporary stacks that increase attack damage, up to the configured cap.

## Mining and utility abilities

- **Luck**
	- **Equipment:** AIOT
	- **Effect:** Breaking ores always spawns an XP orb.

- **Crushing**
	- **Equipment:** Hammer
	- **Effect:** Ore breaks always add the matching dust for **coal, copper, iron, gold, and titanium**.

- **Operator**
	- **Equipment:** Drill, Heavy Drill
	- **Effect:** Sneak + interact to cycle drill modes.
	- **Modes:**
		- `Crushy` keeps the default wide break.
		- `Silky` mines in silk-style where possible.
		- `Greedy` adds fortune-style extra drops where valid.

- **Gardener**
	- **Equipment:** Shears
	- **Effect:** Breaking leaves or plants clears a flat **5x5** area and duplicates plant harvests.

- **Primal**
	- **Equipment:** Flint Knife
	- **Effect:** Boosts fiber, stick, and cane drops, adds bleed in combat, and grants **+4 Attack Damage**.

- **Forger**
	- **Equipment:** Smelting Pickaxe
	- **Effect:** Ore breaks can add matching plates, netherrack yields **4 Nether Bricks**, and hits ignite enemies.

- **Ingniter**
	- **Equipment:** Flint and Steel
	- **Effect:** Igniting TNT replaces it with a fresh TNT block and can light Creepers.

- **Worm**
	- **Equipment:** Shovel
	- **Effect:** Breaking dirt, sand, red sand, or gravel adds matching handfuls/fragments.
	- **Extra behavior:**
		- Using the shovel on supported soil cycles between dirt-style variants.
		- Sneak + use on supported soil digs up buried small-plant seeds, similar to a Sniffer-style find.
		- Holding the shovel grants **50% evade chance**.

- **Reaper**
	- **Equipment:** Hoe
	- **Effect:** Breaking a ripe crop duplicates the harvest and automatically replants it.

- **Berserk**
	- **Equipment:** Axe
	- **Effect:** Sneak-breaking normal or stripped logs converts them directly into planks with extra plank output.

## Defense abilities

- **Clarity**
	- **Equipment:** Helmet
	- **Effect:** Grants **Night Vision** below **Y48** in the Overworld.

- **Retaliation**
	- **Equipment:** Chestplate
	- **Effect:** Taking damage can reflect part of it back at the attacker.

- **Bulwark**
	- **Equipment:** Aetherium Leggings
	- **Effect:** Defensive identity focused on steady protection and survival.

- **Featherstep**
	- **Equipment:** Boots
	- **Effect:** Reduces fall damage by **80%** and grants a short **Absorption** burst with a **1-minute cooldown**.

- **Spikes**
	- **Equipment:** Shield
	- **Effect:** Reflects incoming damage, knocks attackers back, and pulls nearby monsters toward the first aggressor.

- **Tough**
	- **Equipment:** Turtle Helmet
	- **Effect:** Grants **Conduit Power** while in water and reduces damage from **falling blocks, suffocation, lightning, and stalactites**.

## Notes

- Some abilities are direct runtime behaviors (`Bleeding`, `Sweeping`, `Aftershock`, `Harpoon`, `Ballista`, `Operator`, `Gardener`, `Primal`, `Forger`, `Ingniter`, `Worm`, `Reaper`, `Berserk`, `Retaliation`, `Spikes`).
- Some abilities still shape the item's passive identity while also carrying targeted runtime hooks (`Deadeye`, `Clarity`, `Bulwark`, `Featherstep`, `Tough`, `Crushing`, `Luck`).
- Armor pieces still keep their normal StatsCore defensive stats, such as damage reduction, damage negation chance, preservation, immunities, and vulnerabilities, in addition to their named ability identity.
