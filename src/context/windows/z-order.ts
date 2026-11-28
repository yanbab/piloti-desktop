/** The stacking order: each raise takes the next number. */
let top = 20;

export const nextZ = (): number => ++top;
