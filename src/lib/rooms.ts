import type { Field } from '../ui/EntityForm';
import type { Room } from './types';

/** "Bad (OG)" - the floor disambiguates rooms that exist on several floors. */
export const roomLabel = (room: Room) => (room.floor ? `${room.name} (${room.floor})` : room.name);

/** Rooms by floor, then by name. */
export const sortRooms = (rooms: Room[]) =>
  [...rooms].sort((a, b) => (a.floor ?? '').localeCompare(b.floor ?? '', 'de') || a.name.localeCompare(b.name, 'de'));

const floorsOf = (rooms: Room[]) => [...new Set(rooms.map((r) => r.floor).filter((f): f is string => !!f))];

/** Form fields for a room; floors already in use are offered while typing. */
export const ROOM_FIELDS = (rooms: Room[]): Field[] => [
  { name: 'name', label: 'Raum', required: true },
  {
    name: 'floor',
    label: 'Geschoss (z.B. EG, OG, Keller)',
    half: true,
    suggestions: floorsOf(rooms),
  },
  { name: 'area', label: 'Fläche in m²', type: 'decimal', half: true },
];

/** Form fields for pasting several rooms of one floor at once. */
export const ROOM_LIST_FIELDS = (rooms: Room[]): Field[] => [
  { name: 'floor', label: 'Geschoss (z.B. EG, OG, Keller)', suggestions: floorsOf(rooms) },
  { name: 'list', label: 'Räume, einer pro Zeile, Fläche dahinter wenn bekannt (z.B. „Bad 11,14“)', type: 'textarea', required: true },
];

/**
 * "Bad 11,14 m²" -> { name: 'Bad', area: 11.14 }. The area must have decimals
 * or a unit, so that "Kinderzimmer 1" keeps its number.
 */
export function parseRoomList(text: string): { name: string; area: number | null }[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const m = line.match(/^(.+?)[\s:;,]+(\d+(?:[.,]\d+)?)\s*(m²|m2)?$/i);
      if (!m || (!m[3] && !/[.,]/.test(m[2]))) return { name: line, area: null };
      return { name: m[1].trim(), area: parseFloat(m[2].replace(',', '.')) };
    });
}
