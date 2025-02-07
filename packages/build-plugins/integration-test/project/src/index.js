import { sharedHelperFunction, sharedHelperFunctionThatThrowsError } from './common/helpers'

function globalFunction() {
	const value1 = 1
	const value2 = 2
	console.log('running index.js of the build-plugins sample project', sharedHelperFunction(value1, value2))
}

function globalFunctionThatThrowsError() {
	sharedHelperFunctionThatThrowsError(5)
}

window.globalFunction = globalFunction
window.globalFunctionThatThrowsError = globalFunctionThatThrowsError
