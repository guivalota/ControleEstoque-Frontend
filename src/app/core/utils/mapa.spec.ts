import { textoCoordenadas, urlMapa } from './mapa';

describe('mapa', () => {
  it('urlMapa monta o link do OpenStreetMap com 6 casas', () => {
    expect(urlMapa(-23.55052, -46.633309)).toBe('https://www.openstreetmap.org/?mlat=-23.550520&mlon=-46.633309#map=18/-23.550520/-46.633309');
  });

  it('sem uma das coordenadas não há link nem texto', () => {
    expect(urlMapa(null, 10)).toBeNull();
    expect(urlMapa(10, undefined)).toBeNull();
    expect(textoCoordenadas(null, null)).toBeNull();
  });

  it('textoCoordenadas usa ponto decimal', () => {
    expect(textoCoordenadas(-23.55052, -46.633309)).toBe('-23.550520, -46.633309');
  });
});
