---
name: prepare-release
description: Generate a changelog and suggest a new version number based on git commits since the last version. Use when the user asks to generate a changelog, create a new version, or prepare a release. Optionally accepts a version number argument (e.g., `/prepare-release 2.1.0`).
---

When this skill is invoked, follow these steps:

## 0. Check for custom version number

- If the user provides a version number as an argument (e.g., `/prepare-release 2.1.0`), use that version
- Otherwise, proceed to analyze commits and suggest a version number

## 1. Find the last version

- Check git tags to find the most recent version tag (format: `vX.Y.Z`)

## 2. Analyze commits since last version

- Get all commits since the last version tag
- For each commit:
    - Examine the commit's title and full description
    - Extract the PR number from the commit message (usually in format `(#1234)`)
    - Fetch the PR description to get more detailed information using one of these methods:
        - Preferred: `gh pr view <PR_NUMBER>` if `gh` CLI is available
        - Fallback: Use WebFetch to fetch from `https://api.github.com/repos/signalfx/splunk-otel-js-web/pulls/<PR_NUMBER>` (public API, no auth required) and extract the `body` field
- Categorize commits into:
    - **Breaking changes**: Look for "BREAKING CHANGE" in commit body, PR description, or "!" in commit type (e.g., "feat!:")
    - **Features**: Commits starting with "feat:", "feature:"
    - **Bug fixes**: Commits starting with "fix:", "bugfix:"
    - **Dependencies**: Commits from dependabot or starting with "chore(deps", "chore(deps-dev", "build(deps"
    - **Chores**: Other commits starting with "chore:", "ci:", "docs:", "style:", "refactor:", "perf:", "test:"
- Use PR descriptions as the primary source of detailed information for changelog entries, as they typically contain more context than commit messages

## 3. Suggest new version number (using Semantic Versioning)

- If there are **breaking changes**: bump MAJOR version (e.g., 2.0.0 → 3.0.0)
- Else if there are **new features**: bump MINOR version (e.g., 2.0.0 → 2.1.0)
- Else if there are **bug fixes or other changes**: bump PATCH version (e.g., 2.0.0 → 2.0.1)
- Present the suggested version to the user

## 4. Generate changelog

Format the changelog to match the existing CHANGELOG.md structure:

```markdown
## [Suggested Version]

### Breaking Changes (only if there are breaking changes)

- `@splunk/otel-web`, `@splunk/otel-web-session-recorder`, or `@splunk/otel-web-build-plugins`
    - **Title of Breaking Change** [#PR_NUMBER](PR_URL)
        - Detailed description from PR description (preferred) or commit body
        - Include migration notes if relevant
        - Use bullet points for sub-items

### New Features and Improvements (if no breaking changes, this can be the first section)

- `@splunk/otel-web`
    - **Title of Feature** [#PR_NUMBER](PR_URL)
        - Detailed description from PR description (preferred) or commit body
        - Include code examples if mentioned in PR
        - Use bullet points for sub-features
    - **Another Feature** [#PR_NUMBER](PR_URL)
        - Description

- `@splunk/otel-web-session-recorder`
    - **Title of Feature** [#PR_NUMBER](PR_URL)
        - Description

- `@splunk/otel-web-build-plugins`
    - **Title of Feature** [#PR_NUMBER](PR_URL)
        - Description

- **Updated dependencies**
```

## 5. Formatting rules

- **No date in version header** - Just use `## [Version]` without a date
- **Section order**:
    1. Breaking Changes (only if any exist) - this section is always first when present
    2. New Features and Improvements - group all changes by package
- **Group by package** - Under each section, list the package name first (`@splunk/otel-web`, `@splunk/otel-web-session-recorder`, or `@splunk/otel-web-build-plugins`), then indent all changes for that package below it
- **Bold titles** - Feature/change titles should be in bold
- **Include PR references** - Add `[#PR_NUMBER](PR_URL)` after each title
- **Indentation** - Use 4 spaces for nested items under the package scope
- **Dependencies**:
    - Add as a separate bullet point: `- **Updated dependencies** [#PR1](URL), [#PR2](URL), ...`
    - **NEVER list the package names that were updated** - just say "Updated dependencies" followed by links to all dependency PRs
    - Include links to ALL dependency-related PRs in a comma-separated list
    - This is a top-level bullet point, not under a package name
- Strip conventional commit prefixes (feat:, fix:, etc.) from the changelog entries
- Omit empty sections

## 6. Present to user

- Show the suggested version number
- Show the generated changelog
- Ask if they want to proceed with updating all files

## 7. Update all version-related files

Once the user approves, update the following files in order:

1. **Update CHANGELOG.md**
    - Add the new changelog entry at the top (after the header)
    - Ensure proper formatting

2. **Update package.json files**
    - Root `package.json`
    - `packages/build-plugins/package.json`
    - `packages/integration-tests/package.json`
    - `packages/session-recorder/package.json`
    - `packages/web/package.json`
    - Change the `version` field to the new version

3. **Update version.ts files**
    - `packages/build-plugins/src/version.ts`
    - `packages/session-recorder/src/version.ts`
    - `packages/integration-tests/src/version.ts`
    - `packages/web/src/version.ts`
    - Update the VERSION constant to the new version

4. **Update README.md files**
    - `packages/web/README.md` - Update CDN URLs with version numbers (3 places: v{MAJOR}, v{MAJOR}.{MINOR}, v{MAJOR}.{MINOR}.{PATCH})
    - `packages/session-recorder/README.md` - Update CDN URLs with version numbers (3 places: v{MAJOR}, v{MAJOR}.{MINOR}, v{MAJOR}.{MINOR}.{PATCH})

    Example: For version 2.1.0, update:
    - `v2/splunk-otel-web.js` (major version lock)
    - `v2.1/splunk-otel-web.js` (minor version lock)
    - `v2.1.0/splunk-otel-web.js` (exact version lock)

## 8. Run linting

- Run `npm run lint:fix` to ensure all files follow project formatting standards
- Report the results of the linting process

## 9. Summary

- Report all files that were updated
- Show the final version number
- Remind the user to review the changes before committing

## Example Output

```
Based on the commits since v2.0.0, I suggest version **v2.1.0** (minor bump due to new features).

## 2.1.0

- `@splunk/otel-web`
    - **Added Support for Custom Span Attributes** [#1234](https://github.com/signalfx/splunk-otel-js-web/pull/1234)
        - Added configuration option to capture custom span attributes
        - Supports both static and dynamic attribute values
    - **Implement Automatic Error Boundary Instrumentation** [#1235](https://github.com/signalfx/splunk-otel-js-web/pull/1235)
        - Automatically captures React error boundary events
        - Includes component stack traces in error spans

- `@splunk/otel-web-session-recorder`
    - **Added Custom Event Recording** [#1236](https://github.com/signalfx/splunk-otel-js-web/pull/1236)
        - New API for recording custom events in session replay

- **Updated dependencies** [#1240](https://github.com/signalfx/splunk-otel-js-web/pull/1240), [#1241](https://github.com/signalfx/splunk-otel-js-web/pull/1241)
```

## Notes

- This skill follows Semantic Versioning (semver) principles
- Dependency updates are condensed to a single "Updated dependencies" bullet with links to all dependency PRs - never list package names
- The skill examines PR descriptions as the primary source for detailed changelog entries (via `gh pr view` or the GitHub API), falling back to commit messages when PR info is unavailable
- Breaking changes should always be highlighted first when present
