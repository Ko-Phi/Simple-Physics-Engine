export const sq = (n: number): number => n * n
export const constrain = (n: number, maxi: number, mini: number) =>
  Math.max(maxi, Math.min(mini, n))
export const rounD = (num: number, deciPlace: number): number =>
  Math.round(num * Math.pow(10, deciPlace)) / Math.pow(10, deciPlace)
export const random = (min: number, max: number) => Math.random() * (max - min) + min
export const range = (start: number, stop: number, step: number = 1) =>
  Array.from({ length: Math.ceil((stop - start) / step) }, (_, i) => start + i * step)
export const rgba = (...inputs: number[]): string => {
  let channels
  if (inputs.length === 1) channels = [inputs[0], inputs[0], inputs[0], 255]
  else if (inputs.length === 2) channels = [inputs[0], inputs[0], inputs[0], inputs[1]]
  else if (inputs.length === 3) channels = inputs.concat(255)
  else channels = inputs
  return "#" + channels.map((c) => c.toString(16).padStart(2, "0")).join("")
}
