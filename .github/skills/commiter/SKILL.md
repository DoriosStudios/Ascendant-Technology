---
name: commiter
description: 'Create high-quality single-topic commit messages with a short change title and a detailed sectioned description. Use for commit drafting, changelog-quality commit notes, and splitting mixed changes into separate commits.'
argument-hint: 'What is the single topic for this commit?'
---

# Committer

## Outcome
- Produce one commit message focused on exactly one subject.
- Enforce a short title that summarizes the change at a high level.
- Produce a detailed description organized with `##` subsections and `-` bullet items.
- If multiple subjects exist, split into multiple commits (one topic per commit).

## When to Use
- Preparing a commit after implementing one feature, one fix, or one refactor.
- Cleaning up a mixed set of changes before committing.
- Standardizing commit quality for team history and release tracking.

## Required Format

### 1) Title
- Must be a short, high-level phrase.
- Must describe what changed in general terms.
- Prefer a past-tense action verb + object.
- Examples:
	- `Added Vaporworks Processor`
	- `Refactored Script Structure`

### 2) Description
- Must be detailed and information-rich.
- Must be split into subsections using `##` headings.
- Must use `-` list items for details.
- Must only describe the same single subject from the title.

## Procedure
1. Identify the candidate changes to commit.
2. Group changes by topic.
3. If more than one topic exists, create separate commit messages (one per topic).
4. Draft the title using the required style.
5. Draft the description with `##` sections and `-` bullets.
6. Validate single-topic focus and completeness.

## Suggested Description Sections
Use only relevant sections; keep every item tied to the same topic.

- `## What Changed`
	- Main functional or structural changes.
	- Key files, modules, or systems affected.

- `## Technical Details`
	- Important implementation notes.
	- Constraints, edge cases, and compatibility implications.

- `## Notes`
	- Follow-up work or known limitations directly related to this topic.

## Decision Rules
- If the message needs words like "also", "and", "plus", or introduces unrelated systems, split into multiple commits.
- If title and body cannot be summarized under one clear subject, split into multiple commits.
- If important context is missing, request details before finalizing the commit message.

## Quality Checklist
- Title is short and high-level.
- Title clearly matches the body topic.
- Description uses `##` subsections.
- Description uses `-` list items.
- Description is information-dense and actionable.
- No mixed topics are present.

## Output Template
Title line:
- `<Short high-level title>`

Description body:
- `## What Changed`
	- `...`
- `## Why`
	- `...`
- `## Technical Details`
	- `...`
- `## Validation`
	- `...`
- `## Notes` (optional)
	- `...`