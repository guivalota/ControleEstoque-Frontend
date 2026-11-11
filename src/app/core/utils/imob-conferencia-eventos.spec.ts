import { ImobConferenciaEvento } from '../models/imob-leitura.model';
import { rotuloCampoEvento, textoEvento, valorEvento } from './imob-conferencia-eventos';

const evento = (extra: Partial<ImobConferenciaEvento>): ImobConferenciaEvento => ({
  id: 1, campo: 'estado_id', usuarioId: 'u1', origem: 'web', criadoEm: '2026-11-11T12:00:00Z', ...extra
});

describe('imob-conferencia-eventos', () => {
  it('estado, departamento e local mostram o nome da época; sem nome cai no id', () => {
    expect(valorEvento('estado_id', '7', 'Bom')).toBe('Bom');
    expect(valorEvento('departamento_id', '3', null)).toBe('#3');
    expect(valorEvento('local_lido_id', '9', 'Sala 1')).toBe('Sala 1');
  });

  it('valor de mercado em reais, encontrado em Sim/Não e vazio em traço', () => {
    expect(valorEvento('valor_mercado', '750.50').replace(/\s/g, ' ')).toBe('R$ 750,50');
    expect(valorEvento('encontrado', 'true')).toBe('Sim');
    expect(valorEvento('encontrado', 'false')).toBe('Não');
    expect(valorEvento('observacao', null)).toBe('—');
    expect(valorEvento('observacao', '')).toBe('—');
  });

  it('texto do evento mostra antes → depois', () => {
    expect(textoEvento(evento({ valorAnterior: '5', valorAnteriorNome: 'Ruim', valorNovo: '7', valorNovoNome: 'Bom' })))
      .toBe('Estado de conservação: Ruim → Bom');
    expect(textoEvento(evento({ campo: 'observacao', valorAnterior: null, valorNovo: 'Pé quebrado' })))
      .toBe('Observação: — → Pé quebrado');
  });

  it('foto adicionada e removida mostram só o arquivo', () => {
    expect(textoEvento(evento({ campo: 'foto_adicionada', valorNovo: 'IMG_1.jpg' }))).toBe('Foto adicionada: IMG_1.jpg');
    expect(textoEvento(evento({ campo: 'foto_removida', valorAnterior: 'IMG_1.jpg' }))).toBe('Foto removida: IMG_1.jpg');
  });

  it('campo desconhecido usa o próprio nome', () => {
    expect(rotuloCampoEvento('novo_campo')).toBe('novo_campo');
  });
});
