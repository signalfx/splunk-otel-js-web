export function sharedHelperFunction(value1, value2) {
	const result = value1 + value2;
	return result;
}

export function sharedHelperFunctionThatThrowsError(value) {
	return thisFunctionDoesNotExist();
}

export function otherHelperFunction(value) {
	return String(value);
}
