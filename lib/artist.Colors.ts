// lib/artist.Colors.ts

export const ARTIST_COLOR_PALETTE = [
  '#3C2A21', // espresso
  '#6F1D1B', // oxblood
  '#2C3E50', // midnight blue
  '#264653', // petrol
  '#7B3E19', // tobacco
  '#3E2723', // dark chocolate
  '#004643', // deep teal
  '#512E5F', // plum
  '#1C1C1C', // near-black
  '#4A4E69', // twilight grey-blue
  '#1D3557', // navy indigo
  '#7C2D12', // copper brown
  '#6C584C', // muted olive
  '#2D6A4F', // forest green
  '#2E1F27', // vintage aubergine
  '#3D0000', // bordeaux
  '#1E1E24', // ink
  '#22223B', // deep ink blue
  '#5C3D2E', // cocoa
  '#2F3E46', // steel green
  '#373737', // charcoal
  '#2B2D42', // muted indigo
  '#423E37', // antique bronze
  '#1A1A2E', // noir blue
  '#4A3F35', // weathered brown
  '#3A0CA3', // modern violet
  '#264653', // petrol redux
  '#3F3F44', // studio grey
  '#362417', // mahogany
  '#183446', // twilight teal
  '#4C3A51', // dusk lavender
  '#2E2C2F', // muted black
  '#2C2A4A', // faded blue
  '#472D30', // cherrywood
  '#5E3023', // burnt oak
  '#1B1B2F', // violet black
  '#342E37', // smoke violet
  '#1C1B1B', // noir matte
  '#292F36', // deep sea blue
];

// === Fallbacks de colores por disco (solo si records.vibe_color/cover_color vienen vacíos) ===
const RECORD_COLOR_FALLBACKS: Record<string, { vibe: string; cover: string }> = {
  // escribe títulos exactamente como en tu tabla `records.title`
  'Hit Me Hard And Soft': { vibe: '#0e1a3a', cover: '#f2f2f2' }, // <- pon aquí tus colores reales
  // añade aquí más discos si lo necesitas
}

export function getRecordColorsByTitle(title?: string | null) {
  if (!title) return null
  const key = title.trim()
  return RECORD_COLOR_FALLBACKS[key] ?? null
}
