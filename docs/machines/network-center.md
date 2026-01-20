# Network Center

Control panel that scans the connected energy network and shows a full system summary.

## What it does
- Scans cables and energy-tagged blocks in the network.
- Counts machines, generators, batteries, cables, and nodes.
- Shows stored energy, capacity, balance, and overall status.

## How to use
1. Connect the block to the energy network.
2. Keep enough energy for continuous scanning.
3. Read the panels shown in the block UI.

## What appears on the panels
- Consumption (machines) and generation (generators).
- Stored energy, capacity, and free space.
- Net flow per tick and status (Stable/Charging/Draining/Deficit/Buffer Full).
- Truncation warning when the network exceeds the safety limit (4096 nodes).

## Energy
- Constant consumption to keep monitoring.
- Scan runs about every ~2 seconds.

## Upgrades
- None.
