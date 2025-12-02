import { ModalFormData } from "@minecraft/server-ui"

const RANGE = {
	min: 0,
	max: 24
}

const EXCLUDED_TYPES = [
	"minecraft:player",
	"minecraft:item",
	"minecraft:xp_orb",
	"minecraft:arrow",
	"minecraft:fireball",
	"minecraft:small_fireball",
	"minecraft:snowball",
	"minecraft:egg",
	"minecraft:thrown_trident",
	"minecraft:eye_of_ender_signal",
	"minecraft:lightning_bolt",
	"minecraft:falling_block"
]

const EXCLUDED_FAMILIES = ["player", "inanimate"]
const IMMUNE_TAG = "utilitycraft:magnet_immune"

DoriosAPI.register.blockComponent("mob_magnet", {
	onTick(e) {
		const { block } = e
		const isOn = block.permutation.getState("utilitycraft:isOn")
		const range = block.permutation.getState("utilitycraft:rangeSelected")

		if (!isOn || range <= 0) return

		const { x, y, z } = block.location
		const center = { x: x + 0.5, y: y + 0.5, z: z + 0.5 }

		const entities = block.dimension.getEntities({
			location: center,
			maxDistance: range,
			excludeTypes: EXCLUDED_TYPES,
			excludeFamilies: EXCLUDED_FAMILIES
		})

		for (const entity of entities) {
			if (!entity?.isValid) continue
			if (entity.hasTag(IMMUNE_TAG)) continue

			entity.teleport(
				{ x: x + 0.5, y: y + 1, z: z + 0.5 },
				{ dimension: block.dimension, facingLocation: center }
			)
		}
	},
	onPlayerInteract(e) {
		const { block, player } = e
		const hand = player.getComponent("equippable").getEquipment("Mainhand")

		if (hand || player.isSneaking) return

		const isOn = block.permutation.getState("utilitycraft:isOn")
		const range = block.permutation.getState("utilitycraft:rangeSelected")

		const modalForm = new ModalFormData()
			.title("Mob Magnet Settings")
			.toggle("Off/On", { defaultValue: isOn })
			.slider("Radius", RANGE.min, RANGE.max, { defaultValue: range })

		modalForm.show(player).then(formData => {
			if (formData.canceled || !formData.formValues) return

			const [newOn, newRange] = formData.formValues
			block.setPermutation(block.permutation.withState("utilitycraft:isOn", newOn))
			block.setPermutation(block.permutation.withState("utilitycraft:rangeSelected", newRange))
		})
	}
})
