# Ascendant Technology legacy reference

This directory contains the pre-overhaul implementation for behavioral reference only.
Nothing in `legacy/` is loaded by the active behavior pack.

Use it to document what a feature did, its balance values, persistent state, and expected
player experience. New code must use `DoriosLib`, the canonical `DoriosCore`, and `ATCore`;
it must not import modules from this directory.

Original JSON files modified to disable script-driven behavior are copied under
`legacy/BP/` with their original relative paths.
