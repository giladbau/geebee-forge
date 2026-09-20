/** Game order is independent of the trained CNN class order. Colors follow identity. */
export const SHAPES = [
 { name: 'triangle', color: '#D97872' },
 { name: 'square', color: '#6489C4' },
 { name: 'star', color: '#C8759E' },
 { name: 'circle', color: '#C99C43' },
 { name: 'crescent', color: '#8976B6' },
 { name: 'cloud', color: '#CE8559' },
 { name: 'lightning', color: '#559995' },
 { name: 'rainbow', color: '#7376B5' },
 { name: 'sun', color: '#6C9B79' },
] as const;

/** Translate an accepted model label only; never reorder model scores. */
export function gameSymbolForLabel(label: string): number | null {
 const symbol = SHAPES.findIndex(shape => shape.name === label);
 return symbol < 0 ? null : symbol;
}
