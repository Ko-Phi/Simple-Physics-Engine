export const sq = (n) => n * n;
export const constrain = (n, maxi, mini) => Math.max(maxi, Math.min(mini, n));
export const rounD = (num, deciPlace) => Math.round(num * Math.pow(10, deciPlace)) / Math.pow(10, deciPlace);
export const random = (min, max) => Math.random() * (max - min) + min;
export const range = (start, stop, step = 1) => Array.from({ length: Math.ceil((stop - start) / step) }, (_, i) => start + i * step);
export const rgba = (...inputs) => {
    let channels;
    if (inputs.length === 1)
        channels = [inputs[0], inputs[0], inputs[0], 255];
    else if (inputs.length === 2)
        channels = [inputs[0], inputs[0], inputs[0], inputs[1]];
    else if (inputs.length === 3)
        channels = inputs.concat(255);
    else
        channels = inputs;
    return "#" + channels.map((c) => c.toString(16).padStart(2, "0")).join("");
};
