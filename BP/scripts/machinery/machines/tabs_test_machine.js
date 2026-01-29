import { Machine } from "../managers_extra.js";

DoriosAPI.register.blockComponent("tabs_test_machine", {
	beforeOnPlayerPlace(e, { params: settings }) {
		Machine.spawnMachineEntity(e, settings);
	},
	onPlayerBreak(e) {
		Machine.onDestroy(e);
	}
});
