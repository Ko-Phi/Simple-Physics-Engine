export const shift = <Type>(xs: Array<Type>): Array<Type> => xs.slice(1).concat(xs[0])
export const zip = <Type>(...arrays: Array<Array<Type>>) =>
  arrays[0].map((_, index) => arrays.map((array) => array[index]))
export const zipWith = <a, b, c>(arr1: a[], arr2: b[], fn: (a: a, b: b) => c) =>
  arr1.map((val, i) => fn(val, arr2[i]))
export const zipShift = <Type>(xs: Array<Type>) => zip(xs, shift(xs))

export type NArray<T, N extends number, R extends T[] = []> = R["length"] extends N
  ? R
  : NArray<T, N, [...R, T]>
