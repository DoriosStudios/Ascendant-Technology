# Quick Start Guide: Creating Roadmap Issues

This guide explains how to use the roadmap issues templates created for Ascendant Technology.

## What Has Been Created

Three new files have been added to help manage the project roadmap:

1. **`ROADMAP_ISSUES.md`** - Contains detailed templates for 7 roadmap issues
2. **`tools/create_roadmap_issues.sh`** - Automated script to create all issues at once
3. **`tools/README.md`** - Documentation for the tools directory

## The 7 Roadmap Issues

1. **UI Rework** - Refactor all machine interfaces for better usability on low-resolution displays
2. **Drop System** - Improve reliability and vanilla-like behavior
3. **Language Support** - Add translations for international players
4. **AT Systems in UtilityCraft** - Enable Hyper Processing and Overclock for other addons
5. **Addon Compatibility** - Expand integration with more addons
6. **Unique Systems** - Implement Gas system and other unique features
7. **Polish** - Final optimization and refinement for 1.0 release

## How to Create the Issues

### Method 1: Automated Script (Recommended)

**Prerequisites:**
- Install [GitHub CLI](https://cli.github.com/)
- Authenticate with: `gh auth login`
- Have write access to the repository

**Steps:**
```bash
cd tools
./create_roadmap_issues.sh
```

This will create all 7 issues automatically with proper labels and formatting.

### Method 2: Manual Creation

If you prefer manual control or don't have GitHub CLI:

1. Open the file `ROADMAP_ISSUES.md`
2. Go to https://github.com/DoriosStudios/Ascendant-Technology/issues
3. Click "New Issue"
4. Copy the **Title** from the desired issue section
5. Copy the **Body** content from that same section
6. Add the **Labels** mentioned in that section
7. (Optional) Assign to a **Milestone** if one exists
8. Click "Submit new issue"
9. Repeat for each of the 7 roadmap items

### Method 3: GitHub Web Interface with Template

You can also:
1. View the `ROADMAP_ISSUES.md` file on GitHub
2. Use the raw content to create issues one by one
3. Customize as needed before submitting

## Issue Labels

The issues use these labels (create them if they don't exist):
- `Enhancement` - For new features and improvements
- `Bug` - For bug fixes within the improvements
- `UI` - For user interface changes
- `Addition` - For new content additions

## Milestones

Consider creating these milestones to organize the issues:
- `0.8 - Core Systems`
- `0.9 - Polish & Accessibility`
- `1.0 - Integration`
- `1.0 - Unique Systems`
- `1.0 - UI Overhaul`
- `1.0 - Final Polish`
- `1.0 - Machine`

## Next Steps After Creating Issues

1. **Prioritize** - Determine which issues to tackle first
2. **Assign** - Assign issues to team members
3. **Break Down** - Create sub-tasks for large issues
4. **Track Progress** - Use project boards or milestones
5. **Link PRs** - Reference issues in pull requests

## Customization

Feel free to modify the templates in `ROADMAP_ISSUES.md` before creating the issues:
- Adjust acceptance criteria
- Add/remove scope items
- Update milestones
- Change priorities
- Add additional context

## Questions?

If you have questions about any of the roadmap items or need clarification on the templates, refer to the detailed descriptions in `ROADMAP_ISSUES.md` or open a discussion on GitHub.

---

**Note:** The roadmap is based on the original Portuguese planning document and has been translated and expanded with detailed technical specifications and acceptance criteria.
