# Tools Directory

This directory contains utility scripts and tools for the Ascendant Technology addon development.

## Available Tools

### `create_roadmap_issues.sh`

Bash script to automatically create all roadmap issues on GitHub.

**Requirements:**
- [GitHub CLI (gh)](https://cli.github.com/) installed and authenticated
- Appropriate permissions on the repository

**Usage:**
```bash
./create_roadmap_issues.sh
```

**What it does:**
- Creates 7 comprehensive roadmap issues on GitHub
- Applies appropriate labels to each issue
- Links related issues and milestones
- Uses the templates from `ROADMAP_ISSUES.md`

**Issues created:**
1. Rework All Machine Interfaces for Better Visibility and Usability
2. Improve Drop System to Enhance Vanilla-like Behavior
3. Expand Language Support for Better Accessibility
4. Make Hyper Processing Upgrade and Overclock System Work with UtilityCraft
5. Expand Addon Compatibility and Integration
6. Implement Additional Unique Systems to Enhance AT's Identity
7. Polish and Optimize AT for 1.0 Release

### `generate_transmutables.js`

JavaScript tool for generating transmutable items data.

**Usage:**
```bash
node generate_transmutables.js
```

## Manual Issue Creation

If you prefer not to use the automated script, you can manually create issues using the templates in `ROADMAP_ISSUES.md` at the root of the repository.

**Steps:**
1. Open `ROADMAP_ISSUES.md` in your editor
2. Navigate to https://github.com/DoriosStudios/Ascendant-Technology/issues
3. Click "New Issue"
4. Copy the title and body from the desired section in `ROADMAP_ISSUES.md`
5. Add the appropriate labels
6. Submit the issue

## Contributing

When adding new tools to this directory:
1. Document the tool in this README
2. Add appropriate file permissions (chmod +x for scripts)
3. Include usage examples and requirements
4. Test the tool before committing
