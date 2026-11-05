import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { forkJoin, Observable } from 'rxjs';
import { GradeService } from '../../core/services/grade.service';
import { PermissaoService } from '../../core/services/permissao.service';
import { ToastService } from '../../core/services/toast.service';
import { GradeEixo, GradeValor } from '../../core/models/grade.model';
import { lerErroApi, textoDoErro } from '../../core/utils/erros-api';

interface Alvo { tipo: 'eixo' | 'valor'; id: number; nome: string }

/**
 * Cadastro da grade da empresa: eixos (Tamanho, Cor…) e os valores de cada um (Marrom, Preto, P, M…).
 * É daqui que saem as opções da tela de grade do produto. O código nunca muda (já está nos SKUs gerados) e valor
 * nunca é excluído: só inativado, o que o tira das próximas gerações sem mexer nas variações existentes.
 */
@Component({
  selector: 'app-grade-cadastro',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './grade-cadastro.component.html'
})
export class GradeCadastroComponent implements OnInit {
  private service = inject(GradeService);
  private toast = inject(ToastService);
  permissao = inject(PermissaoService);

  eixos = signal<GradeEixo[]>([]);
  loading = signal(true);
  erro = signal('');
  salvando = signal(false);

  /** Item em edição de nome (eixo ou valor). */
  editando = signal<Alvo | null>(null);
  /** Novo valor em digitação, por eixo. */
  novoValor: Record<number, { codigo: string; nome: string }> = {};
  novoEixo = { codigo: '', nome: '' };

  /** Valores e eixos: admin e operador; criar/alterar eixo: só admin (como o servidor). */
  podeValores = computed(() => this.permissao.pode('estoque.grade.valores-criar'));
  podeEixos = computed(() => this.permissao.pode('estoque.grade.eixos-criar'));

  ngOnInit() {
    this.carregar();
  }

  private carregar() {
    this.loading.set(true);
    this.service.eixos().subscribe({
      next: e => { this.eixos.set(this.ordenados(e)); this.loading.set(false); },
      error: err => { this.erro.set(this.msg(err, 'Não foi possível carregar a grade.')); this.loading.set(false); }
    });
  }

  private ordenados(eixos: GradeEixo[]): GradeEixo[] {
    return [...eixos]
      .sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome))
      .map(e => ({ ...e, valores: [...e.valores].sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome)) }));
  }

  private msg(err: unknown, fallback: string): string {
    return textoDoErro(lerErroApi(err, fallback), fallback);
  }

  private falha(err: unknown, fallback: string) {
    this.erro.set(this.msg(err, fallback));
    this.salvando.set(false);
  }

  private trocarValor(v: GradeValor) {
    this.eixos.update(es => this.ordenados(es.map(e => e.id === v.eixoId ? { ...e, valores: e.valores.map(x => x.id === v.id ? v : x) } : e)));
  }

  private trocarEixo(novo: GradeEixo) {
    this.eixos.update(es => this.ordenados(es.map(e => e.id === novo.id ? { ...novo, valores: e.valores } : e)));
  }

  /** Rascunho do novo valor do eixo (criado sob demanda para o template). */
  nv(eixoId: number): { codigo: string; nome: string } {
    return this.novoValor[eixoId] ??= { codigo: '', nome: '' };
  }

  emEdicao(tipo: 'eixo' | 'valor', id: number): boolean {
    const a = this.editando();
    return a?.tipo === tipo && a.id === id;
  }

  // ---------- nome
  editar(alvo: Alvo) {
    this.erro.set('');
    this.editando.set({ ...alvo });
  }

  editarNome(nome: string) {
    this.editando.update(a => a ? { ...a, nome } : a);
  }

  cancelarEdicao() {
    this.editando.set(null);
  }

  salvarNome() {
    const a = this.editando();
    if (!a) return;
    const nome = a.nome.trim();
    if (!nome) { this.erro.set('Informe o nome.'); return; }
    this.salvando.set(true);
    this.erro.set('');
    if (a.tipo === 'valor') {
      this.service.atualizarValor(a.id, { nome }).subscribe({
        next: v => { this.trocarValor(v); this.fimEdicao(); },
        error: err => this.falha(err, 'Não foi possível renomear o valor.')
      });
    } else {
      this.service.atualizarEixo(a.id, { nome }).subscribe({
        next: e => { this.trocarEixo(e); this.fimEdicao(); },
        error: err => this.falha(err, 'Não foi possível renomear o eixo.')
      });
    }
  }

  private fimEdicao() {
    this.salvando.set(false);
    this.editando.set(null);
  }

  // ---------- ativo
  alternarValor(v: GradeValor) {
    this.erro.set('');
    this.service.atualizarValor(v.id, { ativo: !v.ativo }).subscribe({
      next: novo => { this.trocarValor(novo); this.toast.sucesso(novo.ativo ? 'Valor ativado.' : 'Valor inativado.'); },
      error: err => this.falha(err, 'Não foi possível alterar o valor.')
    });
  }

  alternarEixo(e: GradeEixo) {
    this.erro.set('');
    this.service.atualizarEixo(e.id, { ativo: !e.ativo }).subscribe({
      next: novo => { this.trocarEixo(novo); this.toast.sucesso(novo.ativo ? 'Eixo ativado.' : 'Eixo inativado.'); },
      error: err => this.falha(err, 'Não foi possível alterar o eixo.')
    });
  }

  // ---------- criar
  adicionarValor(eixo: GradeEixo) {
    const n = this.novoValor[eixo.id];
    if (!n?.codigo?.trim() || !n?.nome?.trim()) { this.erro.set('Informe o código e o nome do novo valor.'); return; }
    this.erro.set('');
    const ordem = Math.max(0, ...eixo.valores.map(v => v.ordem)) + 1;
    this.service.criarValor(eixo.id, { codigo: n.codigo.trim(), nome: n.nome.trim(), ordem }).subscribe({
      next: v => {
        this.eixos.update(es => this.ordenados(es.map(e => e.id === eixo.id ? { ...e, valores: [...e.valores, v] } : e)));
        this.novoValor[eixo.id] = { codigo: '', nome: '' };
        this.toast.sucesso('Valor criado.');
      },
      error: err => this.falha(err, 'Não foi possível criar o valor.')
    });
  }

  adicionarEixo() {
    if (!this.novoEixo.codigo.trim() || !this.novoEixo.nome.trim()) { this.erro.set('Informe o código e o nome do novo eixo.'); return; }
    this.erro.set('');
    const ordem = Math.max(0, ...this.eixos().map(e => e.ordem)) + 1;
    this.service.criarEixo({ codigo: this.novoEixo.codigo.trim(), nome: this.novoEixo.nome.trim(), ordem }).subscribe({
      next: e => {
        this.eixos.update(es => this.ordenados([...es, { ...e, valores: e.valores ?? [] }]));
        this.novoEixo = { codigo: '', nome: '' };
        this.toast.sucesso('Eixo criado.');
      },
      error: err => this.falha(err, 'Não foi possível criar o eixo.')
    });
  }

  // ---------- ordem
  mover(eixo: GradeEixo, valor: GradeValor, delta: -1 | 1) {
    const lista = [...eixo.valores];
    const i = lista.findIndex(v => v.id === valor.id);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= lista.length) return;
    [lista[i], lista[j]] = [lista[j], lista[i]];
    // renumera 1..n: valores com a mesma ordem (comum nos padrões) trocariam de lugar sem efeito
    const mudancas: Observable<GradeValor>[] = [];
    const novos: GradeValor[] = lista.map((v, idx) => ({ ...v, ordem: idx + 1 }));
    novos.forEach((v, idx) => { if (v.ordem !== eixo.valores.find(x => x.id === v.id)!.ordem) mudancas.push(this.service.atualizarValor(v.id, { ordem: idx + 1 })); });
    if (mudancas.length === 0) return;
    this.erro.set('');
    forkJoin(mudancas).subscribe({
      next: () => this.eixos.update(es => this.ordenados(es.map(e => e.id === eixo.id ? { ...e, valores: novos } : e))),
      error: err => { this.falha(err, 'Não foi possível reordenar os valores.'); this.carregar(); }
    });
  }
}
