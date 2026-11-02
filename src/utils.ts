export const sq = (n: number): number => n * n
export const constrain = (n: number, maxi: number, mini: number) =>
  Math.max(maxi, Math.min(mini, n))
export const rounD = (num: number, deciPlace: number): number =>
  Math.round(num * Math.pow(10, deciPlace)) / Math.pow(10, deciPlace)
export const random = (min: number, max: number) => Math.random() * (max - min) + min
export const range = (start: number, stop: number, step: number = 1) =>
  Array.from({ length: Math.ceil((stop - start) / step) }, (_, i) => start + i * step)

export const shift = <Type>(xs: Array<Type>): Array<Type> => xs.slice(1).concat(xs[0])
export const zip = <Type>(...arrays: Array<Array<Type>>) =>
  arrays[0].map((_, index) => arrays.map((array) => array[index]))
export const zipWith = <a, b, c>(arr1: a[], arr2: b[], fn: (a: a, b: b) => c) =>
  arr1.map((val, i) => fn(val, arr2[i]))
export const zipShift = <Type>(xs: Array<Type>) => zip(xs, shift(xs))

export type NArray<T, N extends number, R extends T[] = []> = R["length"] extends N
  ? R
  : NArray<T, N, [...R, T]>
