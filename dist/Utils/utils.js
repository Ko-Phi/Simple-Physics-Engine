export const sq = (n) => n * n;
export const constrain = (n, maxi, mini) => Math.max(maxi, Math.min(mini, n));
export const rounD = (num, deciPlace) => Math.round(num * Math.pow(10, deciPlace)) / Math.pow(10, deciPlace);
export const random = (min, max) => Math.random() * (max - min) + min;
export const range = (start, stop, step = 1) => Array.from({ length: Math.ceil((stop - start) / step) }, (_, i) => start + i * step);
export const shift = (xs) => xs.slice(1).concat(xs[0]);
export const zip = (...arrays) => arrays[0].map((_, index) => arrays.map((array) => array[index]));
export const zipWith = (arr1, arr2, fn) => arr1.map((val, i) => fn(val, arr2[i]));
export const zipShift = (xs) => zip(xs, shift(xs));
