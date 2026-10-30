import { of } from 'rxjs';
import { carregarTodasPaginas } from './paginas';

describe('carregarTodasPaginas', () => {
  const itens = (de: number, ate: number) => Array.from({ length: ate - de + 1 }, (_, i) => de + i);

  it('pede páginas de 100 até juntar o total', () => {
    const chamadas: [number, number][] = [];
    let resultado: number[] = [];
    carregarTodasPaginas<number>((page, size) => {
      chamadas.push([page, size]);
      const todos = itens(1, 250);
      return of({ items: todos.slice((page - 1) * size, page * size), total: 250 });
    }).subscribe(r => (resultado = r));
    expect(chamadas).toEqual([[1, 100], [2, 100], [3, 100]]);
    expect(resultado.length).toBe(250);
    expect(resultado[249]).toBe(250);
  });

  it('uma página só quando cabe', () => {
    let n = 0;
    carregarTodasPaginas<number>(() => { n++; return of({ items: [1, 2], total: 2 }); }).subscribe();
    expect(n).toBe(1);
  });

  it('para numa página vazia mesmo que o total prometa mais', () => {
    let n = 0;
    carregarTodasPaginas<number>(() => { n++; return of({ items: [], total: 500 }); }).subscribe();
    expect(n).toBe(1);
  });
});
