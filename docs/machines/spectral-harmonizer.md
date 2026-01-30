# Spectral Harmonizer

[![](../pics/spectral_harmonizer.png)](../pics/spectral_harmonizer.png)

Synchronization machine that coordinates multiple machines into beat cycles for burst production windows.

## What it does
- Synchronizes nearby machines with harmonic couplers into beat cycles.
- Provides periodic speed boosts during beat windows.
- Consumes Beat Cores as fuel for synchronization.
- Scans up to 16 blocks in all directions for compatible machines.

## How it works

### Beat Cycles
The Spectral Harmonizer operates in 3-second beat cycles (60 ticks):
1. **Beat Window** (first 1.5 seconds): Machines with Harmonic Couplers receive a **10% speed boost**.
2. **Cooldown** (next 1.5 seconds): The boost fades as machines complete their synchronized operations.

### Fuel Consumption
- Consumes **1 Beat Core every 10 cycles** (30 seconds of operation).
- If a Beat Core is depleted, the harmonizer **desynchronizes**, causing a **5-second stall** where no boosts are applied.

### Machine Requirements
- Only machines with a **Harmonic Coupler** upgrade installed can be synchronized.
- The harmonizer can synchronize up to **32 machines** simultaneously.
- Compatible machines must be within **16 blocks** of the harmonizer.

## How to use
1. Place the Spectral Harmonizer in the center of your factory area.
2. Install **Harmonic Coupler** upgrades in machines you want to synchronize.
3. Insert **Beat Cores** into the harmonizer's fuel slot.
4. Connect energy to the harmonizer.
5. Monitor the status panels to see synchronized machines and beat cycle status.

## Inputs and outputs
- **Beat Core Slot**: Fuel input for synchronization (slot 3).
- **Info Panels**: Display current beat phase, synchronized machines, and cycle count.

## Machine Capabilities
- **Energy Capacity**: 12,800,000 DE (12.8 MDE)
- **Energy Consumption**: 3,200 DE/tick upkeep
- **Processing Rate**: 16,000 DE/tick
- **Beat Cycle**: 60 ticks (3 seconds)
- **Speed Boost**: 10% during beat window
- **Scan Range**: 16 blocks radius
- **Max Machines**: 32 synchronized machines

## Status Indicators

### Status Panel (Slot 0)
- **Beat Active/Beat Cooldown**: Current phase of the beat cycle.
- **Phase**: Percentage through current cycle (0-100%).
- **Cycles**: Total number of completed beat cycles.
- **Boost**: Speed boost percentage (+10%).

### Beat Cycle Panel (Slot 1)
- **Next Core**: Number of cycles until next Beat Core consumption.
- **Window**: Duration of beat cycle window (1.5s).
- **Consumption**: Beat Core consumption rate (1 per 10 cycles).

### Synchronized Panel (Slot 5)
- **Active**: Number of machines currently synchronized / total compatible machines.
- **Range**: Scan radius (16 blocks).
- **Status**: Messages about machine synchronization.

## Failure States

### Desynchronization
- **Cause**: Beat Core depleted during operation.
- **Effect**: 5-second stall where no synchronization occurs.
- **Recovery**: Insert a new Beat Core to resume operation.

## Tips
- **Placement**: Position the harmonizer centrally in your factory for maximum coverage.
- **Redundancy**: Keep multiple Beat Cores in the input slot to prevent desynchronization.
- **Machine Selection**: Only install Harmonic Couplers on machines where the 10% speed boost is most valuable.
- **Energy Buffer**: Ensure adequate energy supply to prevent harmonizer downtime.
- **Monitoring**: Watch the synchronized machine count to verify your setup is working.

## Recipes

### Spectral Harmonizer
| Component | Quantity |
| --- | --- |
| Beat Core | 2 |
| Ultimate Chip | 1 |
| Harmonic Coupler | 2 |
| Aetherium Block | 1 |
| Titanium Ingot | 2 |
| Machine Case | 1 |

### Beat Core (yields 2)
| Component | Quantity |
| --- | --- |
| Energized Iron Ingot | 4 |
| Redstone | 4 |
| Aetherium Shard | 1 |

### Harmonic Coupler
| Component | Quantity |
| --- | --- |
| Titanium Ingot | 4 |
| Beat Core | 4 |
| Advanced Chip | 1 |

## Notes
- The Spectral Harmonizer is a **late-game utility** for optimizing factory throughput.
- The 10% speed boost **stacks multiplicatively** with other speed upgrades and overclock boosts.
- Desynchronization penalties encourage maintaining an adequate Beat Core supply.
- The system is designed to reward careful factory planning and resource management.
