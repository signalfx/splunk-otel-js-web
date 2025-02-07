import { expect } from 'chai'
import { readFileSync, existsSync } from 'fs';
import * as path from 'path';
import { computeSourceMapIdFromFile } from '../src/utils';

describe('integration-test setup', function () {
	it('sample project dist/ folder exists', function () {
		expect(existsSync('./integration-test/project/dist'), 'install and build the sample project before running this test suite').ok
	})
})

describe('webpack sourceMaps plugin', function () {
	it('injects the correct code snippet only when a source map file was emitted', async function () {
		await verifySourceMapIdInjectionDidOccur('./integration-test/project/dist/webpack-config-devtool-source-map-js/')
		await verifySourceMapIdInjectionDidOccur('./integration-test/project/dist/webpack-config-devtool-hidden-source-map-js/')
		await verifySourceMapIdInjectionDidNotOccur('./integration-test/project/dist/webpack-config-no-source-maps-js/')
		await verifySourceMapIdInjectionDidNotOccur('./integration-test/project/dist/webpack-config-devtool-eval-js/')
		await verifySourceMapIdInjectionDidNotOccur('./integration-test/project/dist/webpack-config-without-plugin-js/')
	})
})

async function verifySourceMapIdInjectionDidOccur(distDirectory: string) {
	let oldWindow = global.window;

	// Arrange:
	// the code snippet expects a window object, so we set one artificially in the node test environment
	(global.window as any) = {};

	// Act: load the script that should have our injected code snippet
	const mainJs = path.resolve(distDirectory + 'main.js');
	await import(mainJs);

	// Assert:
	// This is a basic sanity check that the script will modify window.sourceMapIds when loaded
	// The code snippet does not support node environments, so sourceMapIds is just an empty object here.
	//
	// A real browser and real server are needed to perform further validation on the keys & values
	// that will end up in window.sourceMapIds because of how the code snippet's regex works.
	// There are playwright tests to handle this case.
	expect((window as any).sourceMapIds).not.undefined;

	// Assert:
	// check that the correct sourceMapId is included in the code snippet
	const mainJsMap = path.resolve(distDirectory + 'main.js.map');
	const expectedSourceMapId = await computeSourceMapIdFromFile(mainJsMap);
	expect(readFileSync(mainJs).toString()).contains('window.sourceMapIds\[s] = \'' + expectedSourceMapId + '\'');

	(global.window as any) = oldWindow;
}

async function verifySourceMapIdInjectionDidNotOccur(distDirectory: string) {
	let oldWindow = global.window;
	(global.window as any) = {};

	const mainJs = path.resolve(distDirectory + 'main.js');
	await import(mainJs);

	expect((window as any).sourceMapIds).undefined;
	expect(readFileSync(mainJs).toString()).not.contains('window.sourceMapIds');

	(global.window as any) = oldWindow;
}
