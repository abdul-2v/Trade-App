/**
 * Human-readable quantities in customer-facing documents.
 * Keep unit selection and PDF output consistent between quotations and invoices.
 */
export type TradeUnit = 'job' | 'hour' | 'day' | 'radiator' | 'valve' | 'item' |
  'each' | 'metre' | 'box' | 'pack' | 'roll' | 'visit' | 'room' | 'point' | 'set';

const units: Record<string, { singular: string; plural: string; option: string }> = {
  job: { singular: 'job', plural: 'jobs', option: 'Per job (fixed price)' },
  hour: { singular: 'hour', plural: 'hours', option: 'Per hour' },
  day: { singular: 'day', plural: 'days', option: 'Per day' },
  radiator: { singular: 'radiator', plural: 'radiators', option: 'Per radiator' },
  valve: { singular: 'valve', plural: 'valves', option: 'Per valve' },
  item: { singular: 'item', plural: 'items', option: 'Per item' },
  each: { singular: 'item', plural: 'items', option: 'Per item' },
  metre: { singular: 'metre', plural: 'metres', option: 'Per metre' },
  box: { singular: 'box', plural: 'boxes', option: 'Per box' },
  pack: { singular: 'pack', plural: 'packs', option: 'Per pack' },
  roll: { singular: 'roll', plural: 'rolls', option: 'Per roll' },
  visit: { singular: 'visit', plural: 'visits', option: 'Per visit' },
  room: { singular: 'room', plural: 'rooms', option: 'Per room' },
  point: { singular: 'point', plural: 'points', option: 'Per point' },
  set: { singular: 'set', plural: 'sets', option: 'Per set' },
};

export const unitOptionLabel = (unit: string) => units[unit]?.option || 'Per ' + unit;

/**
 * Do not guess that "three jobs" meant "three radiators".
 * Old data is pluralised, and the tradesperson can issue a corrected version.
 */
export const formatTradeQuantity = (quantity: string | number, unit?: string | null): string => {
  const n = Number(quantity);
  const unitName = String(unit || '').trim().toLowerCase();
  const label = units[unitName];
  const displayNumber = Number.isFinite(n) ? String(n) : String(quantity);
  if (!unitName) return displayNumber;
  return displayNumber + ' ' + (label
    ? (n === 1 ? label.singular : label.plural)
    : (n === 1 ? unitName : unitName + (unitName.endsWith('s') ? '' : 's')));
};

/**
 * One job is a fixed-price line, not a number of identical units.
 * Labour charged by radiator/valve/etc uses an explicit unit instead.
 */
export const hasInvalidTradeQuantity = (quantity: number, unit?: string | null): boolean => {
  if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 100000) return true;
  if (unit === 'job' && quantity !== 1) return true;
  if (unit && !['hour','day','metre'].includes(unit) && !Number.isInteger(quantity)) return true;
  return false;
};
