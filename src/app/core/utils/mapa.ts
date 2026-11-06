/** Link para ver um ponto GPS no mapa (OpenStreetMap, sem chave de API). `null` se faltar alguma das coordenadas. */
export function urlMapa(latitude?: number | null, longitude?: number | null): string | null {
  if (latitude == null || longitude == null) return null;
  const lat = latitude.toFixed(6);
  const lon = longitude.toFixed(6);
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=18/${lat}/${lon}`;
}

/** Texto curto das coordenadas, com ponto decimal (padrão de GPS), ou `null`. */
export function textoCoordenadas(latitude?: number | null, longitude?: number | null): string | null {
  if (latitude == null || longitude == null) return null;
  return `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
}
