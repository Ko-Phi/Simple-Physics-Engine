export const shift = (xs) => xs.slice(1).concat(xs[0]);
export const zip = (...arrays) => arrays[0].map((_, index) => arrays.map((array) => array[index]));
export const zipWith = (arr1, arr2, fn) => arr1.map((val, i) => fn(val, arr2[i]));
export const zipShift = (xs) => zip(xs, shift(xs));
