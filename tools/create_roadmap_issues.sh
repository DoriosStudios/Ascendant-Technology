#!/bin/bash

# Script to create roadmap issues for Ascendant Technology
# Requires: GitHub CLI (gh) installed and authenticated
# Usage: ./create_roadmap_issues.sh

REPO="DoriosStudios/Ascendant-Technology"

echo "Creating roadmap issues for $REPO..."
echo ""

# Check if gh is installed
if ! command -v gh &> /dev/null; then
    echo "Error: GitHub CLI (gh) is not installed."
    echo "Please install it from: https://cli.github.com/"
    exit 1
fi

# Check if authenticated
if ! gh auth status &> /dev/null; then
    echo "Error: Not authenticated with GitHub CLI."
    echo "Please run: gh auth login"
    exit 1
fi

# Issue 1: Rework All Machine Interfaces
echo "Creating Issue 1: UI Rework..."
gh issue create \
    --repo "$REPO" \
    --title "Rework All Machine Interfaces for Better Visibility and Usability" \
    --label "Enhancement,UI" \
    --body "## Summary
Refactor all machine UIs to improve visibility and usability, with a focus on supporting players with low screen resolutions. Implement a subpack system with \"Classic\" and \"Tabs\" interface styles.

## Problem
Current machine interfaces (especially complex ones like Cryo Chamber, Catalyst Weaver, and Network Center) are too large for lower resolution displays. Some interfaces extend beyond the screen boundaries, making them unusable for affected players.

## Scope
- Redesign all machine UIs with responsive layouts
- Create two UI styles:
  - **Classic**: Original full-screen layout for high-resolution displays
  - **Tabs**: Compact tabbed interface for lower resolutions
- Implement subpack system to allow players to choose their preferred UI style
- Ensure all information remains accessible regardless of style choice
- Maintain consistency across all machine interfaces

## Machines to Rework
- Absolute Container
- Catalyst Weaver (Arc Loom)
- Liquifier (Flux Crucible)
- Duplicator (Cloner | Replication Matrix)
- Singularity Fabricator
- Energizer (Pulse Forge)
- Network Center
- Residue Processor
- Laser Barrier (if UI is added)
- Cryo Chamber
- Interdimensional Infuser
- And any other machines with complex UIs

## Acceptance Criteria
- [ ] All machine UIs are redesigned and responsive
- [ ] \"Classic\" subpack maintains original full-screen layouts
- [ ] \"Tabs\" subpack provides compact, tabbed interfaces
- [ ] Players can switch between UI styles via subpack selection
- [ ] All UIs are usable on low-resolution displays (tested on minimum supported resolution)
- [ ] UI consistency maintained across all machines
- [ ] Documentation updated with UI screenshots and subpack instructions

## Technical Notes
- Consider implementing a reusable UI component system for consistency
- Test on various screen resolutions (minimum: 1280x720)
- Ensure touch controls work properly on mobile devices
- Maintain backwards compatibility with existing saved games

## Related Issues
- Closes #6 (Machine's UI are way too big)

## Milestone
1.0 - UI Overhaul"

echo "✓ Issue 1 created"
echo ""

# Issue 2: Improve Drop System
echo "Creating Issue 2: Drop System improvements..."
gh issue create \
    --repo "$REPO" \
    --title "Improve Drop System to Enhance Vanilla-like Behavior" \
    --label "Enhancement,Bug" \
    --body "## Summary
Refine the drop system to reduce the \"anti-vanilla\" feeling when events are canceled and ensure all conditions work reliably without failures.

## Problem
The current drop system, while functional, has issues:
- Events being canceled can create jarring, non-vanilla-like behavior
- Some drop conditions may fail or behave inconsistently
- Player experience can feel disconnected from vanilla Minecraft expectations

## Scope
- Analyze current drop system implementation
- Identify and fix inconsistent behavior in drop conditions
- Improve event handling to maintain vanilla-like feel
- Ensure all edge cases are properly handled
- Optimize performance of drop calculations
- Add better error handling and fallback mechanisms

## Goals
1. **Reliability**: All drop conditions must work consistently without failures
2. **Vanilla Feel**: Canceled events should not create jarring gameplay experiences
3. **Performance**: Drop calculations should be efficient and not cause lag
4. **Flexibility**: System should be easy to extend for future content

## Acceptance Criteria
- [ ] All drop conditions tested and working reliably
- [ ] Event cancellation handles gracefully without breaking player experience
- [ ] No reported instances of drops failing unexpectedly
- [ ] Performance benchmarks show no significant lag from drop calculations
- [ ] Code is well-documented for future maintenance
- [ ] Integration tests cover all drop scenarios

## Technical Considerations
- Review event priority and cancellation handling
- Consider implementing a drop queue system for complex scenarios
- Add comprehensive logging for debugging drop issues
- Ensure compatibility with other addons that may affect drops

## Milestone
0.8 - Core Systems"

echo "✓ Issue 2 created"
echo ""

# Issue 3: Expand Supported Languages
echo "Creating Issue 3: Language support expansion..."
gh issue create \
    --repo "$REPO" \
    --title "Expand Language Support for Better Accessibility" \
    --label "Enhancement,Addition" \
    --body "## Summary
Expand the addon's language support to improve accessibility for international players.

## Problem
Currently, the addon has limited language support, which reduces accessibility for non-English speaking players.

## Priority
Low - This is an accessibility improvement rather than critical functionality.

## Scope
- Identify current language coverage
- Determine priority languages based on player base
- Create translation infrastructure if not already present
- Translate all UI text, item names, descriptions, and tooltips
- Implement language files for selected languages

## Proposed Languages (Priority Order)
1. **Portuguese (PT-BR)** - High priority (developer's native language)
2. **Spanish (ES)** - High priority (large player base)
3. **French (FR)** - Medium priority
4. **German (DE)** - Medium priority
5. **Russian (RU)** - Medium priority
6. **Chinese Simplified (ZH-CN)** - Medium priority
7. Additional languages based on community demand

## Acceptance Criteria
- [ ] Translation infrastructure is in place
- [ ] At least 3 new languages are fully supported
- [ ] All UI elements, items, and machine names are translated
- [ ] Language files are properly formatted and loaded
- [ ] In-game language switching works correctly
- [ ] Documentation includes instructions for contributors to add new languages

## Community Involvement
- Consider accepting community translations via pull requests
- Create translation guidelines for contributors
- Set up a system for community members to suggest translations

## Technical Notes
- Follow Minecraft's language file format and conventions
- Ensure text fits properly in UI elements across all languages
- Test with different character sets (Latin, Cyrillic, CJK)
- Consider using placeholder strings for future content

## Milestone
0.9 - Polish & Accessibility"

echo "✓ Issue 3 created"
echo ""

# Issue 4: AT Systems in UtilityCraft
echo "Creating Issue 4: AT systems in UtilityCraft..."
gh issue create \
    --repo "$REPO" \
    --title "Make Hyper Processing Upgrade and Overclock System Work with UtilityCraft and Other Expansions" \
    --label "Enhancement,Addition" \
    --body "## Summary
Enable the Hyper Processing Upgrade and Overclock System to function with UtilityCraft machines and other expansion addons without interfering with their code.

## Problem
Currently, two major AT systems do not work with machines from other addons:
- **Hyper Processing Upgrade**: Only works with AT machines
- **Overclock System**: Only compatible with AT machines

This limits the usefulness of these systems and reduces integration between addons in the Dorios ecosystem.

## Challenge
Implementing cross-addon compatibility without modifying the code of other addons is technically challenging and requires careful architectural design.

## Scope
- Research current implementation of Hyper Processing Upgrade
- Research current implementation of Overclock System
- Design a non-invasive integration approach
- Implement compatibility layer for UtilityCraft machines
- Test with UtilityCraft machines
- Extend compatibility to other expansion addons
- Document the integration approach for future expansions

## Target Addons
1. **UtilityCraft** (Primary target - parent addon)
2. **Heavy Machinery Expansion** (Dorios ecosystem)
3. Other Dorios ecosystem expansions
4. Third-party addons (where feasible)

## Proposed Approach
1. Create a detection system to identify compatible machines from other addons
2. Implement a plugin/hook system that doesn't require modifying external code
3. Use tag-based or property-based identification for compatible machines
4. Add configuration options for cross-addon compatibility
5. Provide API documentation for other addon developers to integrate

## Acceptance Criteria
- [ ] Hyper Processing Upgrade works with UtilityCraft machines
- [ ] Overclock System works with UtilityCraft machines
- [ ] Integration doesn't require modifying UtilityCraft code
- [ ] Compatibility extends to Heavy Machinery Expansion machines
- [ ] System is extensible for future addons
- [ ] Documentation explains how other addon developers can integrate
- [ ] All functionality tested and verified to work correctly
- [ ] No performance degradation from compatibility layer

## Technical Considerations
- Use property checks or tags to identify compatible machines
- Consider implementing a machine registry system
- Ensure backward compatibility with existing AT machines
- Add proper error handling for incompatible machines
- Document the integration API for addon developers

## Related Issues
- Related to addon ecosystem integration goals

## Milestone
1.0 - Integration"

echo "✓ Issue 4 created"
echo ""

# Issue 5: Improve Compatibility
echo "Creating Issue 5: Addon compatibility..."
gh issue create \
    --repo "$REPO" \
    --title "Expand Addon Compatibility and Integration" \
    --label "Enhancement,Addition" \
    --body "## Summary
Expand and improve compatibility with addons beyond the Dorios ecosystem, enhancing integration possibilities and player experience.

## Current Status
AT is currently compatible with:
- **Dorios Ecosystem** addons (UtilityCraft, Heavy Machinery, etc.)
- **Project EMC**
- **Adventure Condiment**

However, there's significant room for improvement and expansion.

## Scope
This is a broad initiative covering multiple areas:

### 1. Enhanced Integration with Existing Compatible Addons
- Deeper integration with Project EMC
- Better synergy with Adventure Condiment
- Improved Dorios ecosystem compatibility

### 2. New Addon Compatibility
- Research popular Minecraft Bedrock addons
- Identify integration opportunities
- Implement compatibility layers

### 3. API/Plugin System
- Create a public API for other addon developers
- Document integration points
- Provide example integrations

### 4. Recipe Integration
- Cross-addon recipe support
- Shared resource compatibility
- Balanced progression across addons

### 5. Energy/Fluid System Compatibility
- Ensure AT energy system works with other addon energy systems
- Fluid compatibility (if applicable)
- Resource transfer between addon systems

## Integration Plans (To Be Detailed)
The following integrations are being considered:

### Project EMC
- [ ] AT machines can use EMC-based automation
- [ ] Energized items integrate with EMC values
- [ ] Special recipes involving EMC items

### Adventure Condiment
- [ ] AT tools/armor synergies
- [ ] Recipe integration
- [ ] Balanced progression

### Popular Community Addons
- [ ] Research most used addons
- [ ] Prioritize integration opportunities
- [ ] Implement compatibility layers

## Acceptance Criteria
- [ ] Compatibility matrix documented
- [ ] At least 2 new addon integrations completed
- [ ] Public API documented and available
- [ ] Integration examples provided
- [ ] All integrations tested and stable
- [ ] No conflicts or crashes with compatible addons
- [ ] Performance impact assessed and acceptable

## Community Input
- Open to suggestions for which addons to prioritize
- Welcome community testing of compatibility
- Consider community-contributed integrations

## Technical Considerations
- Avoid hard dependencies where possible
- Use optional soft dependencies for integrations
- Implement graceful fallbacks when addons aren't present
- Ensure load order doesn't cause issues
- Maintain AT's identity while expanding compatibility

## Milestone
1.0 - Integration"

echo "✓ Issue 5 created"
echo ""

# Issue 6: Unique Systems
echo "Creating Issue 6: Unique AT systems..."
gh issue create \
    --repo "$REPO" \
    --title "Implement Additional Unique Systems to Enhance AT's Identity" \
    --label "Enhancement,Addition" \
    --body "## Summary
Implement at least 2 more unique gameplay systems to make Ascendant Technology more distinctive and engaging beyond just the Overclock system.

## Problem
Currently, the Overclock system is AT's primary unique feature. While good, the addon needs more unique systems to:
- Enhance its identity and differentiation from other tech addons
- Provide varied gameplay experiences
- Justify its \"Ascendant\" theme
- Give players more reasons to engage with the addon

## Planned Systems

### 1. Gas System (In Planning) 🟡
**Steam as First Implementation**

The Gas system will introduce a new resource type beyond items and fluids:

**Features:**
- Gases as a distinct resource type
- Steam as the first gas (produced from water)
- Gas generation, storage, and usage
- Integration with existing machines
- Potential for more gases in the future (toxic, pressurized, etc.)

**Machines:**
- Vaporworks Processor (already in Machine_To_Do)
- Gas storage solutions
- Gas-consuming machines for enhanced processing

**Benefits:**
- Adds depth to resource processing
- Creates new optimization challenges
- Provides alternative power/processing boosts
- Opens design space for future content

### 2. Additional Unique System (Open for Suggestions) ❓

**Potential Ideas:**
- **Dimensional Energy Network**: Cross-dimensional resource transfer
- **Matter Conversion System**: Transform one resource type into another
- **Quantum Processing**: Probability-based crafting with risk/reward
- **Automation Scripting**: Player-programmable machine behavior
- **Nano-Construction**: Build structures/items through molecular assembly
- **Singularity Manipulation**: Harness black hole physics for processing

**Community Input Welcome!**

We're open to suggestions for what the second (and third, if applicable) system should be. Consider:
- What makes AT feel \"ascendant\" or advanced?
- What gameplay loops are missing?
- What would be fun to experiment with?
- What fits the technological/end-game theme?

## Acceptance Criteria
- [ ] Gas system fully implemented with Steam
- [ ] At least one additional unique system implemented
- [ ] Both systems have dedicated machines/items
- [ ] Systems integrate well with existing content
- [ ] Systems provide meaningful gameplay value
- [ ] Documentation and tutorials created
- [ ] Systems are balanced and tested
- [ ] Each system has clear progression path

## Design Principles
- Systems should feel \"advanced\" and end-game worthy
- Avoid duplicating mechanics from other addons
- Ensure systems integrate naturally with existing content
- Balance complexity with usability
- Provide clear value to players

## Milestone
1.0 - Unique Systems

## Discussion
Please share your ideas for unique systems in the comments! What would make AT more interesting and distinctive?"

echo "✓ Issue 6 created"
echo ""

# Issue 7: Polish the Addon
echo "Creating Issue 7: Polish the addon..."
gh issue create \
    --repo "$REPO" \
    --title "Polish and Optimize AT for 1.0 Release" \
    --label "Enhancement" \
    --body "## Summary
Comprehensive polish pass to make Ascendant Technology complete, compatible, and perfect for gameplay. This is the final refinement before considering the addon \"release-ready.\"

## Scope
This is a broad polishing initiative covering all aspects of the addon:

### 1. Content Completion
- [ ] Fill gaps in block/item progression
- [ ] Add complementary decorative blocks
- [ ] Complete all machine variants
- [ ] Add missing crafting recipes
- [ ] Ensure all content has proper descriptions and lore

### 2. Script Performance Optimization
- [ ] Profile script performance
- [ ] Optimize hot paths in machine logic
- [ ] Reduce unnecessary event handlers
- [ ] Optimize energy/fluid calculations
- [ ] Minimize tick-rate intensive operations
- [ ] Implement lazy loading where applicable

### 3. Visual Improvements
- [ ] Review and enhance textures
- [ ] Add particle effects where appropriate
- [ ] Improve UI animations and transitions
- [ ] Enhance machine working animations
- [ ] Add visual feedback for player actions
- [ ] Ensure visual consistency across all content

### 4. Audio Polish
- [ ] Add machine operation sounds
- [ ] Implement ambient sounds for active machines
- [ ] Add UI interaction sounds
- [ ] Ensure audio doesn't become repetitive or annoying

### 5. Balance Pass
- [ ] Review all recipe costs and outputs
- [ ] Balance energy consumption across machines
- [ ] Adjust processing times for better gameplay flow
- [ ] Ensure progression feels smooth
- [ ] Verify late-game content is appropriately challenging

### 6. Bug Fixing
- [ ] Address all known bugs (see bugs.md)
- [ ] Fix edge cases and rare issues
- [ ] Improve error handling
- [ ] Add better validation for player inputs

### 7. Documentation
- [ ] Complete in-game documentation/help
- [ ] Update README with comprehensive information
- [ ] Create video tutorials (optional)
- [ ] Document all machines, recipes, and systems
- [ ] Add troubleshooting guide

### 8. Compatibility Testing
- [ ] Test with all supported addons
- [ ] Verify multiplayer functionality
- [ ] Test across different Minecraft versions
- [ ] Ensure no conflicts with popular addons
- [ ] Validate performance with large-scale builds

### 9. Code Quality
- [ ] Code review and refactoring
- [ ] Remove dead code and debug statements
- [ ] Improve code documentation
- [ ] Standardize naming conventions
- [ ] Add code comments for complex logic

### 10. User Experience
- [ ] Streamline new player onboarding
- [ ] Improve tooltips and descriptions
- [ ] Add contextual hints/tips
- [ ] Ensure intuitive machine interfaces
- [ ] Make progression path clear

## Acceptance Criteria
- [ ] All sections above are addressed
- [ ] No critical bugs remain
- [ ] Performance is acceptable on target hardware
- [ ] All systems are documented
- [ ] Visual and audio polish is consistent
- [ ] Addon is feature-complete for 1.0
- [ ] Community testing shows positive feedback
- [ ] Ready for official 1.0 release

## Testing Plan
1. Internal testing of all systems
2. Performance benchmarking
3. Community beta testing period
4. Bug fix iteration
5. Final validation pass

## Timeline
This is the final major initiative before 1.0, so it should be comprehensive but focused. Break down into smaller subtasks as needed.

## Milestone
1.0 - Final Polish

## Notes
This issue serves as a tracker for the overall polish effort. Create separate issues for specific polish tasks if they are substantial enough to warrant focused work."

echo "✓ Issue 7 created"
echo ""

echo "==============================================="
echo "All 7 roadmap issues have been created!"
echo "View them at: https://github.com/$REPO/issues"
echo "==============================================="
