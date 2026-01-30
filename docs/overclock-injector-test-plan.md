# Overclock Injector - Test Plan

## Testing Checklist

### Basic Functionality
- [ ] Block can be crafted with the correct recipe
- [ ] Block can be placed in the world
- [ ] Block shows correct texture when placed (off state)
- [ ] Block can be broken and drops the item
- [ ] Block rotates correctly based on player facing direction
- [ ] Block entity spawns correctly on placement

### Network Integration
- [ ] Injector connects to Reinforced Cable network
- [ ] Injector scans and finds Overclock Tower in network
- [ ] Injector receives overclock charge from tower
- [ ] Injector stores overclock level and effectiveness correctly
- [ ] Energy can flow through the injector to other blocks
- [ ] Fluid can flow through the injector to other blocks

### Coolant System
#### Cryofluid Testing
- [ ] Injector accepts Cryofluid in fluid tank
- [ ] Cryofluid drains at 120 mB/tick when overclock active
- [ ] Cryofluid provides 100% effectiveness multiplier
- [ ] Status display shows "Cryofluid (100%)"
- [ ] Heat decreases when Cryofluid is present

#### Water Testing
- [ ] Injector accepts Water in fluid tank
- [ ] Water drains at 240 mB/tick when overclock active
- [ ] Water provides 50% effectiveness multiplier
- [ ] Status display shows "Water (50%)"
- [ ] Heat decreases when Water is present

#### No Coolant Testing
- [ ] Status shows "No Coolant" when tank is empty
- [ ] Heat increases when no coolant and overclock is active
- [ ] Heat accumulation rate scales with overclock level

### Overclock Application
- [ ] Injector applies overclock to machine it faces
- [ ] Overclock is NOT applied when facing wrong direction
- [ ] Overclock is NOT applied to generators
- [ ] Overclock effectiveness modified by coolant type
- [ ] Target machine receives correct overclock level
- [ ] Target machine performance increases as expected

### Heat Management
#### Normal Operation
- [ ] Heat starts at 0 on placement
- [ ] Heat stays low with sufficient coolant
- [ ] Heat decreases by 2/tick when coolant is active
- [ ] "overheating" block state remains false

#### Warning State
- [ ] Warning state triggers at 32° heat
- [ ] "overheating" block state changes to true
- [ ] Texture changes to overheat variant
- [ ] Light emission increases to 12
- [ ] Status shows "WARNING: OVERHEATING! (X° to melt)"
- [ ] Can recover if coolant is added

#### Melt Failure
- [ ] Block melts when heat reaches 42°
- [ ] Melt plays anvil break sound
- [ ] Block is destroyed (becomes air)
- [ ] Block entity is properly cleaned up
- [ ] Network connections are severed
- [ ] Machines downstream lose power/overclock

### Visual States
- [ ] OFF state: Dark texture, no light
- [ ] ON state: Bright texture, light level 8
- [ ] OVERHEAT state: Warning texture, light level 12
- [ ] Rotation permutations work for all 6 faces

### UI/Status Display
- [ ] Interacting shows status screen
- [ ] Overclock Level displayed correctly
- [ ] Effectiveness percentage displayed correctly
- [ ] Coolant status displayed with proper color codes
- [ ] Heat level displayed with color coding (green/yellow/red)
- [ ] Warning message shows when overheating
- [ ] Energy display works if present
- [ ] Fluid display works if present

### Edge Cases
- [ ] Injector works when overclock level is 0 (no heat buildup)
- [ ] Injector handles very high overclock levels
- [ ] Injector handles rapid coolant depletion
- [ ] Injector handles being disconnected from network
- [ ] Injector handles target machine being removed
- [ ] Injector handles being placed without a target
- [ ] Multiple injectors can operate on same network
- [ ] Injector heat persists across world reloads

### Performance
- [ ] No lag with single injector
- [ ] No lag with 10 injectors on one network
- [ ] Network scanning completes within tick budget
- [ ] No memory leaks from entity properties

### Integration with Existing Systems
- [ ] Works with existing Overclock Tower
- [ ] Works with existing Reinforced Cable
- [ ] Works with all AT machines (not generators)
- [ ] Works with Cryo Chamber (fluid source)
- [ ] Recipe unlocks after crafting Overclock Tower
- [ ] Appears in correct creative inventory group

## Testing Scenarios

### Scenario 1: Basic Setup
1. Craft Overclock Tower
2. Craft Reinforced Cables
3. Craft Overclock Injector
4. Place Tower → Cable → Injector → Machine
5. Add fuel to Tower
6. Add Cryofluid to Injector
7. Verify machine receives overclock boost

### Scenario 2: Coolant Failure
1. Set up working overclock system (Scenario 1)
2. Let Cryofluid run out
3. Observe heat increase
4. Watch for overheat warning at 32°
5. Verify melt occurs at 42°
6. Confirm network disruption

### Scenario 3: Coolant Recovery
1. Set up working overclock system
2. Let injector start overheating (32-40° heat range)
3. Add Cryofluid
4. Verify heat decreases
5. Confirm return to normal operation

### Scenario 4: Network Scale
1. Create large overclock network
2. Place 5-10 injectors on different machines
3. Add coolant to all
4. Verify all receive proper overclock
5. Confirm performance remains stable

### Scenario 5: Directional Placement
1. Place injector facing each direction (N/S/E/W/U/D)
2. Place target machine in each direction
3. Verify overclock only applies to facing machine
4. Confirm rotation visualization is correct

## Success Criteria
- All basic functionality tests pass
- All coolant system tests pass
- Heat management works as designed
- Melt mechanic triggers correctly
- No crashes or errors in console
- Performance is acceptable
- Visual states are clear and correct
- Documentation matches implementation

## Known Issues to Monitor
- Heat persistence across world reloads
- Network scanning performance with large networks
- Fluid tank synchronization with UI
- Block state updates under rapid changes
- Memory cleanup on block destruction
