This patch improves custom potion projectiles, sounds, and particles, fixes duplicate machine drops and Catalyst Weaver recipe previews, and corrects Mob Chamber initialization after world reloads.

<!-- Upcoming release: v0.9.4b. -->
<!-- Previous release: extras/past_changelogs/changelog_v0.9.4.md -->

## UI/UX

- **Custom Potions**
    - Thrown bottles now face each player's camera and display the corresponding splash or lingering potion texture.
    - Doubled the visible size of thrown potion bottles while preserving their collision size.
    - Slowed thrown bottles while adjusting the launch arc, gravity, and air resistance to retain a throwing range close to vanilla potions.
    - Added positional throwing sounds and improved glass-breaking feedback at the impact location.
    - Added animated impact particles colored to match the potion.
    - Reworked lingering clouds with animated, fading particles that match the potion's color and the cloud's remaining radius.

## BUG FIXES

- Fixed an invalid-entity error when vanilla splash potion projectiles are removed, including splash water bottles.
- Fixed duplicate block drops when mining AT machines, generators, and multiblock controllers, including empty blocks and blocks with stored resources. Each break now produces a single block item preserving stored energy, fluids, and gases, with inventory contents dropped separately.
- Fixed inherited **Infuser** recipe previews in the **Catalyst Weaver** using the byproduct slot instead of the main output slot.
- Fixed **Mob Chamber** throwing a storage initialization error after `/reload`. Processing now waits for world initialization before resuming.

Contributors: @Kauziin
