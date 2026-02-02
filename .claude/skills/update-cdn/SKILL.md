---
name: update-cdn
description: Update CDN module version for session-replay dependencies. Takes a version number as argument (e.g., `/update-cdn v2.7.0`). Updates CDN URLs in cdn-module.ts, picker.ts, picker-cdn.d.ts, cdn-module-types.d.ts, temporarily disables webpack frozen flag, runs build, then restores frozen flag and cleans up webpack.lock files.
---

When this skill is invoked, follow these steps:

## 0. Validate version argument

- The user MUST provide a version number as an argument (e.g., `/update-cdn v2.7.0`)
- If no version is provided, ask the user to provide one
- The version should be in format `vX.Y.Z` (e.g., `v2.7.0`)
- If the version doesn't start with 'v', prepend it (e.g., `2.7.0` becomes `v2.7.0`)

## 1. Show current state

- Read the current version from one of the CDN module files
- Display the current version and the target version to the user
- Ask for confirmation before proceeding

## 2. Update CDN URLs in source files

Update the version in the following files (replace old version with new version):

### packages/session-recorder/src/session-replay/cdn-module.ts

Update the CDN URLs:

- `https://cdn.signalfx.com/o11y-gdi-rum/session-replay/vX.Y.Z/session-replay.module.legacy.min.js`
- `https://cdn.signalfx.com/o11y-gdi-rum/session-replay/vX.Y.Z/background-service.html`

### packages/session-recorder/src/session-replay/cdn-module-types.d.ts

Update the module declaration URL:

- `declare module 'https://cdn.signalfx.com/o11y-gdi-rum/session-replay/vX.Y.Z/session-replay.module.legacy.min.js'`

### packages/web/src/utils/picker.ts

Update the CDN URL:

- `https://cdn.signalfx.com/o11y-gdi-rum/session-replay/vX.Y.Z/picker/picker.module.min.js`

### packages/web/src/utils/picker-cdn.d.ts

Update the module declaration URL:

- `declare module 'https://cdn.signalfx.com/o11y-gdi-rum/session-replay/vX.Y.Z/picker/picker.module.min.js'`

## 3. Disable frozen flag in webpack configs

Temporarily set `frozen: false` in:

### packages/session-recorder/webpack.config.js

Change:

```javascript
experiments: {
  buildHttp: {
    allowedUris: ['https://cdn.signalfx.com/'],
    cacheLocation: false,
    frozen: false,  // Changed from true
  },
},
```

### packages/web/webpack.config.js

Change:

```javascript
experiments: {
  buildHttp: {
    allowedUris: ['https://cdn.signalfx.com/'],
    cacheLocation: false,
    frozen: false,  // Changed from true
  },
},
```

## 4. Delete old webpack.lock files

Remove the old lock files that contain outdated integrity hashes:

- `packages/session-recorder/webpack.lock`
- `packages/web/webpack.lock`

## 5. Run the build

Execute the build command from the repository root:

```bash
pnpm run build
```

This will:

- Fetch the new CDN resources
- Generate new integrity hashes
- Create new webpack.lock files with updated hashes

## 6. Restore frozen flag in webpack configs

Set `frozen: true` back in both webpack config files:

### packages/session-recorder/webpack.config.js

```javascript
experiments: {
  buildHttp: {
    allowedUris: ['https://cdn.signalfx.com/'],
    cacheLocation: false,
    frozen: true,  // Restored
  },
},
```

### packages/web/webpack.config.js

```javascript
experiments: {
  buildHttp: {
    allowedUris: ['https://cdn.signalfx.com/'],
    cacheLocation: false,
    frozen: true,  // Restored
  },
},
```

## 7. Verify the update

- Read the new webpack.lock files to confirm they contain updated integrity hashes for the new version
- Display the new integrity hashes to the user

## 8. Summary

Report:

- All files that were updated
- The old version and new version
- Confirm webpack.lock files have been regenerated
- Remind the user to review the changes before committing

## Files modified by this skill

1. `packages/session-recorder/src/session-replay/cdn-module.ts` - CDN URLs updated
2. `packages/session-recorder/src/session-replay/cdn-module-types.d.ts` - Module declaration URL updated
3. `packages/web/src/utils/picker.ts` - CDN URL updated
4. `packages/web/src/utils/picker-cdn.d.ts` - Module declaration URL updated
5. `packages/session-recorder/webpack.config.js` - Frozen flag toggled (ends at true)
6. `packages/web/webpack.config.js` - Frozen flag toggled (ends at true)
7. `packages/session-recorder/webpack.lock` - Regenerated with new hashes
8. `packages/web/webpack.lock` - Regenerated with new hashes

## Example usage

```
/update-cdn v2.7.0
```

This will update all CDN references from the current version (e.g., v2.6.4) to v2.7.0.
