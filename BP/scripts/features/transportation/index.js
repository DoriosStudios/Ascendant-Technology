import * as DoriosLib from "DoriosLib/index.js";
import {
    CONVEYOR_COMPONENT_ID,
    CONVEYOR_UPDATER_COMPONENT_ID,
    conveyorComponent,
    conveyorUpdaterComponent,
    installTransportation,
} from "../../ATCore/transportation/index.js";

DoriosLib.registry.blockComponent(CONVEYOR_COMPONENT_ID, conveyorComponent);
DoriosLib.registry.blockComponent(CONVEYOR_UPDATER_COMPONENT_ID, conveyorUpdaterComponent);
installTransportation();
