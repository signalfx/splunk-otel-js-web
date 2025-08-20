# Hackathon Tasks - Splunk OpenTelemetry JS Web Package Refactoring

## Overview
This document outlines the tasks needed to improve the `packages/web` codebase during the hackathon. The focus is on removing technical debt, improving TypeScript types, eliminating eslint/ts-ignore directives, and modernizing old code patterns.

## 🚨 High Priority Tasks

### 1. Remove ESLint Disable Directives and TypeScript Ignores
**Files affected:** Multiple files with 25+ instances
- [ ] **SplunkContextManager.ts** - Remove 8 `eslint-disable-next-line @typescript-eslint/no-this-alias` and 6 `@ts-expect-error` directives
- [ ] **SplunkSocketIoClientInstrumentation.ts** - Remove `eslint-disable-next-line @typescript-eslint/no-this-alias`
- [ ] **index.ts** - Remove 2 `@ts-expect-error` directives 
- [ ] **SplunkWebSocketInstrumentation.ts** - Remove `@ts-expect-error Gecko 6.0`
- [ ] **webvitals.ts** - Remove `eslint-disable-next-line @typescript-eslint/ban-ts-comment` and `@ts-ignore TS1479`
- [ ] **SplunkErrorInstrumentation.ts** - Remove `@ts-expect-error Attributes are defined but hidden`
- [ ] **utils.ts** - Remove 2 `@ts-expect-error __original isn't mentioned in types`
- [ ] **exporters/otlp.ts** - Remove 2 `@ts-expect-error` directives for private property access

**Strategy:** 
- Replace `eslint-disable-next-line @typescript-eslint/no-this-alias` with proper arrow functions or bind()
- Create proper TypeScript interfaces for missing type definitions
- Use type assertions instead of @ts-expect-error where appropriate

### 2. Address TODOs and FIXMEs
**Files with 15+ TODO/FIXME comments:**
- [ ] **SplunkDocumentLoadInstrumentation.ts** - TODO about upstream exposed name on api.Span
- [ ] **SplunkPostDocLoadResourceInstrumentation.ts** - 3 TODOs about TS built-in types and server-timings
- [ ] **SplunkWebTracerProvider.ts** - TODO about upstream propagator deregistration
- [ ] **SplunkLongTaskInstrumentation.ts** - TODO to rename `_isSupported` method
- [ ] **user-tracking/index.ts** - TODO to use cookie/local store
- [ ] **SplunkXhrPlugin.ts** - TODO and FIXME about upstream fixes and attribute deprecation
- [ ] **exporters/zipkin.ts** - 4 TODOs about upstream proper exports
- [ ] **SplunkUserInteractionInstrumentation.ts** - 2 FIXMEs about cleaner patching and ngZone issues
- [ ] **SplunkWebSocketInstrumentation.ts** - 4 FIXMEs about upstream conversion and logic sharing
- [ ] **SplunkErrorInstrumentation.ts** - 3 FIXMEs about timestamps, string handling, and error sources

### 3. Improve TypeScript Typings
**Replace `any` types and improve type safety:**
- [ ] **upstream/user-interaction/instrumentation.ts** - Replace `any` parameters in history patching
- [ ] **SplunkContextManager.ts** - Replace `any[]` in postMessage args
- [ ] **servertiming.ts** - Replace `(entries as any).serverTiming` with proper types
- [ ] **SplunkPostDocLoadResourceInstrumentation.ts** - Replace `any` in _createSpan entry parameter
- [ ] **utils.ts** - Replace `(window as any)[identifier]` with proper window extension
- [ ] **SplunkErrorInstrumentation.ts** - Replace multiple `any` casts with proper types
- [ ] **SplunkLongTaskInstrumentation.ts** - Replace `(entry as any).attribution` with proper PerformanceEntry types
- [ ] **SplunkUserInteractionInstrumentation.ts** - Replace `any` in _patchHistoryMethod return type

### 4. Migrate Underscore-Prefixed Private Members to TypeScript Private Keyword
**Replace underscore prefix convention with proper TypeScript private keyword:**
- [ ] **SplunkContextManager.ts** - Migrate `_currentContext`, `_contextResumingListeners`, `_enabled`, `_hashChangeContext`, `_messagePorts` to `private` keyword
- [ ] **SplunkSpanAttributesProcessor.ts** - Migrate `_globalAttributes` to `private` keyword
- [ ] **SplunkWebSocketInstrumentation.ts** - Migrate `_config` to `private` keyword
- [ ] **SplunkPostDocLoadResourceInstrumentation.ts** - Migrate `_createSpan`, `_processHeadMutationObserverRecords`, `_startHeadMutationObserver`, `_startPerformanceObserver` to `private` keyword
- [ ] **SplunkConnectivityInstrumentation.ts** - Migrate `_createSpan` to `private` keyword
- [ ] **SplunkPageVisibilityInstrumentation.ts** - Migrate `_createSpan` to `private` keyword
- [ ] **upstream/user-interaction/instrumentation.ts** - Migrate `_eventNames`, `_eventsSpanMap`, `_shouldPreventSpanCreation`, `_spansData`, `_wrappedListeners`, `_zonePatched` and methods `_allowEventName`, `_createSpan`, `_getPatchableEventTargets`, `_invokeListener`, `_patchAddEventListener`, `_patchRemoveEventListener` to `private` keyword
- [ ] **SessionBasedSampler.ts** - Migrate `_accumulate`, `_normalize` to `private` keyword
- [ ] **SplunkErrorInstrumentation.ts** - Migrate `_splunkConfig` to `private` keyword
- [ ] **exporters/rate-limit.ts** - Migrate `_processor`, `_filter` to `private` keyword
- [ ] **exporters/zipkin.ts** - Migrate `_mapToZipkinSpan`, `_postTranslateSpan`, `_preTranslateSpan` to `private` keyword
- [ ] **SplunkUserInteractionInstrumentation.ts** - Migrate `_routingTracer`, `_emitRouteChangeSpan` to `private` keyword
- [ ] **storage/cookie-store.ts** - Migrate `_deserialize`, `_getRaw`, `_serialize` to `private` keyword
- [ ] **SplunkLongTaskInstrumentation.ts** - Migrate `_longtaskObserver`, `_createSpanFromEntry` to `private` keyword

### 5. Add ESLint Rule for Import Merging
**Consolidate multiple imports from the same module:**
- [ ] **Add ESLint rule** - Configure `import/no-duplicates` or similar rule to merge imports from the same file
- [ ] **index.ts** - Merge multiple imports from `@opentelemetry/api`, `@opentelemetry/semantic-conventions`, `@opentelemetry/core`, and local modules
- [ ] **SplunkDocumentLoadInstrumentation.ts** - Merge imports from `@opentelemetry/api`, `@opentelemetry/semantic-conventions`
- [ ] **SplunkPostDocLoadResourceInstrumentation.ts** - Merge imports from `@opentelemetry/instrumentation`
- [ ] **Apply across all files** - Use ESLint auto-fix to consolidate duplicate imports

**Example transformation:**
```typescript
// Before:
import { Attributes } from '@opentelemetry/api'
import { diag } from '@opentelemetry/api'

// After:
import { Attributes, diag } from '@opentelemetry/api'
```

### 6. Remove Deprecated Code and APIs
**Modernize deprecated patterns and replace with current standards:**

#### **6.1 Deprecated Experimental APIs**
- [ ] **EventTarget.ts** - Remove deprecated experimental methods:
  - `_experimental_addEventListener` → `addEventListener`
  - `_experimental_removeEventListener` → `removeEventListener`
- [ ] **index.ts** - Remove deprecated experimental methods:
  - `_experimental_getGlobalAttributes()` → `getGlobalAttributes()`
  - `_experimental_getSessionId()` → `getSessionId()`
  - `error()` method (deprecated, use `reportError()` instead)

#### **6.2 Deprecated Semantic Attributes**
- [ ] **Replace deprecated SemanticAttributes usage:**
  - **SplunkDocumentLoadInstrumentation.ts** - Update `SEMATTRS_HTTP_URL` to current semantic conventions
  - **SplunkSocketIoClientInstrumentation.ts** - Update messaging attributes to current standards
  - **SplunkPostDocLoadResourceInstrumentation.ts** - Update HTTP attributes

#### **6.3 Deprecated Component Attribute**
- [ ] **SplunkXhrPlugin.ts** - Remove deprecated `component` attribute usage (line 54 FIXME comment)
- [ ] **exporters/rate-limit.ts** - Replace `component` attribute with proper semantic attributes
- [ ] **SplunkPostDocLoadResourceInstrumentation.ts** - Update component attribution

**Migration Strategy:**
- Add deprecation warnings with clear migration paths
- Provide backward compatibility during transition period
- Update documentation with migration guide
- Consider feature flags for gradual rollout

### 7. Improve Code Structure and Organization
**Reorganize codebase for better maintainability and discoverability:**

#### **7.1 Create Instrumentation Directory Structure**
- [ ] **Create `src/instrumentation/` directory** - Move all instrumentation classes from root
- [ ] **Group by category:**
  - `src/instrumentation/network/` - SplunkFetchInstrumentation, SplunkXhrPlugin, SplunkWebSocketInstrumentation
  - `src/instrumentation/user/` - SplunkUserInteractionInstrumentation, SplunkLongTaskInstrumentation
  - `src/instrumentation/browser/` - SplunkDocumentLoadInstrumentation, SplunkPageVisibilityInstrumentation, SplunkConnectivityInstrumentation
  - `src/instrumentation/errors/` - SplunkErrorInstrumentation
  - `src/instrumentation/resources/` - SplunkPostDocLoadResourceInstrumentation
  - `src/instrumentation/messaging/` - SplunkSocketIoClientInstrumentation

#### **7.2 Consolidate Core Components**
- [ ] **Create `src/core/` directory** for core functionality:
  - Move `SplunkContextManager.ts`, `SplunkWebTracerProvider.ts`, `SessionBasedSampler.ts`
  - Move `SplunkSpanAttributesProcessor.ts`, `SplunkSamplerWrapper.ts`
- [ ] **Create `src/core/context/` subdirectory** - Break down large SplunkContextManager (20KB file)

#### **7.3 Improve Utility Organization**
- [ ] **Consolidate utilities:**
  - Move `utils.ts`, `global-utils.ts`, `servertiming.ts`, `synthetics.ts` to `src/utils/`
  - Create `src/utils/browser/` for browser-specific utilities
  - Create `src/utils/performance/` for performance-related utilities
- [ ] **Rename ambiguous files:**
  - `utils.ts` → `instrumentation-utils.ts` (more specific)
  - `EventTarget.ts` → `SplunkEventTarget.ts` (avoid naming conflicts)

#### **7.4 Clean Up Root Directory**
- [ ] **Move large files from root:**
  - `index.ts` (22KB) - Split into `src/initialization/` modules
  - `webvitals.ts` → `src/instrumentation/performance/webvitals.ts`
  - `version.ts` → `src/core/version.ts`
- [ ] **Remove empty directories:** `managers/` (currently empty)

#### **7.5 Improve Naming Conventions**
- [ ] **Standardize file naming:**
  - Remove "Splunk" prefix from internal files (keep for public APIs)
  - `SplunkContextManager.ts` → `context-manager.ts` (internal file)
  - `SplunkSpanAttributesProcessor.ts` → `span-attributes-processor.ts`
- [ ] **Use kebab-case for file names** consistently
- [ ] **Group related functionality:**
  - Create `src/sampling/` for SessionBasedSampler and SplunkSamplerWrapper
  - Create `src/processors/` for span processors

#### **7.6 Upstream Code Organization**
- [ ] **Review `upstream/` directory structure:**
  - Consider moving to `src/vendor/` or `src/external/` for clarity
  - Add README explaining upstream code purpose and maintenance
- [ ] **Polyfills organization:**
  - Move `polyfill-safari10.ts` to `src/polyfills/safari10.ts`
  - Consolidate all polyfills in `src/polyfills/` directory

#### **7.7 Proposed New Structure**
```
src/
├── core/
│   ├── context/
│   │   ├── context-manager.ts (split from SplunkContextManager)
│   │   ├── event-listeners.ts
│   │   └── message-ports.ts
│   ├── sampling/
│   │   ├── session-based-sampler.ts
│   │   └── sampler-wrapper.ts
│   ├── processors/
│   │   └── span-attributes-processor.ts
│   ├── tracer-provider.ts
│   └── version.ts
├── instrumentation/
│   ├── browser/
│   │   ├── document-load.ts
│   │   ├── page-visibility.ts
│   │   └── connectivity.ts
│   ├── network/
│   │   ├── fetch.ts
│   │   ├── xhr.ts
│   │   └── websocket.ts
│   ├── user/
│   │   ├── interactions.ts
│   │   └── long-task.ts
│   ├── errors/
│   │   └── error-instrumentation.ts
│   ├── resources/
│   │   └── post-doc-load.ts
│   ├── messaging/
│   │   └── socket-io.ts
│   └── performance/
│       └── webvitals.ts
├── initialization/
│   ├── config.ts
│   ├── instrumentations.ts
│   └── index.ts (main entry point)
├── utils/
│   ├── browser/
│   ├── performance/
│   ├── instrumentation-utils.ts
│   └── attributes.ts
├── polyfills/
├── vendor/ (renamed from upstream)
└── [existing directories: exporters, storage, types, etc.]
```

## 🔧 Medium Priority Tasks

### 8. Modernize Function Declarations
**Replace old-style function declarations with modern patterns:**
- [ ] **index.ts** - Convert `_internalInit: function` and `init: function` to arrow functions or methods
- [ ] **SplunkFetchInstrumentation.ts** - Convert `function (span, request, result)` to arrow function
- [ ] **Multiple files** - Replace anonymous `function` expressions with arrow functions where appropriate

### 9. Remove Console Usage
**Replace console.* calls with proper logging:**
- [ ] **index.ts** - Replace `console.warn` with diag logger
- [ ] **EventTarget.ts** - Replace `console.error` with diag logger
- [ ] **SplunkErrorInstrumentation.ts** - Handle `console.error` instrumentation properly

### 10. Improve Error Handling
**Add proper error handling and validation:**
- [ ] **storage/local-store.ts** - Add error logging for localStorage failures
- [ ] **SplunkContextManager.ts** - Improve error handling in event listener wrapping
- [ ] **SplunkWebSocketInstrumentation.ts** - Add proper error handling for WebSocket operations

## 🎨 Low Priority Tasks

### 11. Code Style Improvements
- [ ] Standardize comment formatting across files
- [ ] Ensure consistent indentation and formatting
- [ ] Add missing JSDoc documentation for public APIs
- [ ] Remove unused imports and variables

### 12. Performance Optimizations
- [ ] Review throttling implementations in storage utilities
- [ ] Optimize event listener management in SplunkContextManager
- [ ] Review memory usage in instrumentation classes

### 13. Testing Improvements
- [ ] Add unit tests for refactored code
- [ ] Improve test coverage for error handling paths
- [ ] Add integration tests for storage utilities

## 📋 Implementation Strategy

### Phase 1: Foundation (Day 1)
1. Remove critical @ts-expect-error and eslint-disable directives
2. Migrate underscore-prefixed private members to TypeScript private keyword
3. Add ESLint rule for import merging and apply fixes
4. Address high-impact TODOs

### Phase 2: Type Safety (Day 1-2)
1. Replace `any` types with proper TypeScript interfaces
2. Create missing type definitions
3. Improve type safety across instrumentation classes
4. Create common storage package

### Phase 3: Code Quality (Day 2)
1. Modernize function declarations
2. Improve error handling
3. Replace console usage with proper logging

### Phase 4: Polish (Day 2)
1. Code organization improvements
2. Documentation updates
3. Final cleanup and testing

## 🎯 Success Metrics
- [ ] Zero `@ts-expect-error` and `eslint-disable` directives
- [ ] Zero `TODO`/`FIXME` comments
- [ ] Zero `any` types in public APIs
- [ ] All underscore-prefixed private members migrated to TypeScript `private` keyword
- [ ] ESLint rule configured for import merging with all duplicates resolved
- [ ] All console.* calls replaced with proper logging
- [ ] Common storage package created and integrated
- [ ] Improved TypeScript strict mode compliance
- [ ] Better code organization and maintainability

## 📝 Notes
- Prioritize changes that improve type safety and remove technical debt
- Ensure backward compatibility when refactoring public APIs
- Test thoroughly after each major refactoring
- Document any breaking changes or new patterns introduced
