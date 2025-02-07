import { sharedHelperFunction, otherHelperFunction } from './common/helpers'

const result = sharedHelperFunction(1, 2)
otherHelperFunction(result)

window.globalFunctionFromOtherEntry = function () {
	console.log('executing function in other-entry.js', otherHelperFunction(5))
}
