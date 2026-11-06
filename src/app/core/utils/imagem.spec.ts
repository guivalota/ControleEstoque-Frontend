import { dimensoesReduzidas, reduzirImagem } from './imagem';

async function criarArquivo(largura: number, altura: number, tipo: 'image/png' | 'image/jpeg' = 'image/png', nome = 'grande.png'): Promise<File> {
  const canvas = document.createElement('canvas');
  canvas.width = largura;
  canvas.height = altura;
  const ctx = canvas.getContext('2d')!;
  // Ruído simples para o arquivo não ficar minúsculo
  for (let i = 0; i < 200; i++) {
    ctx.fillStyle = `hsl(${(i * 37) % 360} 70% 50%)`;
    ctx.fillRect((i * 53) % largura, (i * 29) % altura, 40, 40);
  }
  const blob = await new Promise<Blob>(resolve => canvas.toBlob(b => resolve(b!), tipo));
  return new File([blob], nome, { type: tipo });
}

describe('imagem', () => {
  describe('dimensoesReduzidas', () => {
    it('não mexe no que já cabe', () => {
      expect(dimensoesReduzidas(1200, 800)).toEqual({ largura: 1200, altura: 800 });
      expect(dimensoesReduzidas(1600, 1600)).toEqual({ largura: 1600, altura: 1600 });
    });

    it('limita o maior lado mantendo a proporção', () => {
      expect(dimensoesReduzidas(4000, 3000)).toEqual({ largura: 1600, altura: 1200 });
      expect(dimensoesReduzidas(3000, 6000)).toEqual({ largura: 800, altura: 1600 });
    });

    it('nunca devolve lado zero', () => {
      expect(dimensoesReduzidas(100000, 10).altura).toBeGreaterThanOrEqual(1);
    });
  });

  describe('reduzirImagem', () => {
    it('arquivo que não é imagem volta o mesmo objeto', async () => {
      const pdf = new File(['%PDF-1.4'], 'laudo.pdf', { type: 'application/pdf' });
      expect(await reduzirImagem(pdf)).toBe(pdf);
    });

    it('imagem pequena volta o mesmo objeto', async () => {
      const pequena = await criarArquivo(300, 200);
      expect(await reduzirImagem(pequena)).toBe(pequena);
    });

    it('conteúdo que o navegador não decodifica volta o mesmo objeto', async () => {
      const quebrada = new File(['isto não é um jpeg'], 'quebrada.jpg', { type: 'image/jpeg' });
      expect(await reduzirImagem(quebrada)).toBe(quebrada);
    });

    it('imagem grande vira JPEG com o maior lado em 1600 px e nome .jpg', async () => {
      const grande = await criarArquivo(3200, 2000, 'image/png', 'foto da mesa.png');

      const reduzida = await reduzirImagem(grande);

      expect(reduzida).not.toBe(grande);
      expect(reduzida.type).toBe('image/jpeg');
      expect(reduzida.name).toBe('foto da mesa.jpg');
      const bmp = await createImageBitmap(reduzida);
      expect(bmp.width).toBe(1600);
      expect(bmp.height).toBe(1000);
      bmp.close();
    });
  });
});
