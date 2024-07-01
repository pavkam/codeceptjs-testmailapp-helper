/* Random function to generate the tags.*/
const randomCharSet = '0123456789abcdefghijklmnopqrstuvwxyz';

export function randomString(length: number) {
	let result = '';
	for (let i = length; i > 0; --i) {
		result += randomCharSet[Math.floor(Math.random() * randomCharSet.length)];
	}
	return result;
}

/* Quick-and-dirty sleep promise */
export function sleep(ms: number) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}
