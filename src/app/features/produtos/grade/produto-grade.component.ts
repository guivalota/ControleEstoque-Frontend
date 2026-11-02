import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { GradeService } from '../../../core/services/grade.service';
import { PermissaoService } from '../../../core/services/permissao.service';
import { GradeEixo, GradeProduto, VariacaoGrade } from '../../../core/models/grade.model';
import { QtdPipe } from '../../../core/pipes/qtd.pipe';
import { lerErroApi, textoDoErro } from '../../../core/utils/erros-api';

/** Limite de variações por geração (igual ao do servidor). */
export const MAX_VARIACOES = 200;

/**
 * Grade de um produto-modelo (tamanho x cor…): escolhe os valores de cada eixo, gera as variações (cada uma é um
 * produto com SKU, saldo e lote próprios) e mostra o saldo em matriz.
 */
@Component({
  selector: 'app-produto-grade',
  standalone: true,
  imports: [FormsModule, RouterLink, QtdPipe],
  templateUrl: './produto-grade.component.html'
})
export class ProdutoGradeComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private service = inject(GradeService);
  permissao = inject(PermissaoService);

  produtoId = 0;
  carregando = signal(true);
  erro = signal('');
  aviso = signal('');
  gerando = signal(false);

  grade = signal<GradeProduto | null>(null);
  eixos = signal<GradeEixo[]>([]);
  /** eixoId -> ids de valor marcados para a geração. */
  selecao = signal<Record<number, number[]>>({});

  /** Novo valor em edição, por eixo. */
  novoValor: Record<number, { codigo: string; nome: string }> = {};

  eixosAtivos = computed(() => this.eixos().filter(e => e.ativo));

  /** Quantas variações a seleção atual geraria (produto cartesiano dos eixos com ao menos um valor). */
  totalSelecionado = computed(() => {
    const s = this.selecao();
    const tamanhos = Object.values(s).map(v => v.length).filter(n => n > 0);
    return tamanhos.length === 0 ? 0 : tamanhos.reduce((a, b) => a * b, 1);
  });

  excedeLimite = computed(() => this.totalSelecionado() > MAX_VARIACOES);

  /** Eixos usados pelas variações já criadas (linhas e colunas da matriz). */
  eixosDaGrade = computed(() => this.grade()?.eixos ?? []);
  matrizPossivel = computed(() => this.eixosDaGrade().length === 2);

  linhas = computed(() => this.eixosDaGrade()[0]?.valores.filter(v => this.usado(0, v.id)) ?? []);
  colunas = computed(() => this.eixosDaGrade()[1]?.valores.filter(v => this.usado(1, v.id)) ?? []);

  ngOnInit() {
    this.produtoId = Number(this.route.snapshot.paramMap.get('id'));
    this.service.eixos().subscribe({
      next: e => this.eixos.set(e),
      error: err => this.erro.set(textoDoErro(lerErroApi(err, 'Não foi possível carregar os eixos.'), 'Não foi possível carregar os eixos.'))
    });
    this.carregar();
  }

  private carregar() {
    this.carregando.set(true);
    this.service.obter(this.produtoId).subscribe({
      next: g => { this.grade.set(g); this.carregando.set(false); },
      error: err => {
        this.erro.set(textoDoErro(lerErroApi(err, 'Não foi possível carregar a grade.'), 'Não foi possível carregar a grade.'));
        this.carregando.set(false);
      }
    });
  }

  private usado(indiceEixo: number, valorId: number): boolean {
    const eixo = this.eixosDaGrade()[indiceEixo];
    return !!eixo && (this.grade()?.variacoes ?? []).some(v => v.valores[eixo.id] === valorId);
  }

  marcado(eixoId: number, valorId: number): boolean {
    return (this.selecao()[eixoId] ?? []).includes(valorId);
  }

  alternar(eixoId: number, valorId: number, ligado: boolean) {
    this.selecao.update(s => {
      const atual = new Set(s[eixoId] ?? []);
      if (ligado) atual.add(valorId); else atual.delete(valorId);
      return { ...s, [eixoId]: [...atual] };
    });
  }

  marcarTodos(eixo: GradeEixo, ligado: boolean) {
    this.selecao.update(s => ({ ...s, [eixo.id]: ligado ? eixo.valores.filter(v => v.ativo).map(v => v.id) : [] }));
  }

  gerar() {
    const eixos = Object.entries(this.selecao())
      .filter(([, ids]) => ids.length > 0)
      .map(([eixoId, valorIds]) => ({ eixoId: Number(eixoId), valorIds }));
    if (eixos.length === 0) { this.erro.set('Escolha ao menos um valor de um eixo.'); return; }
    if (this.excedeLimite()) { this.erro.set(`A grade teria ${this.totalSelecionado()} variações; o máximo por vez é ${MAX_VARIACOES}.`); return; }

    this.gerando.set(true);
    this.erro.set('');
    this.aviso.set('');
    this.service.gerar(this.produtoId, { eixos }).subscribe({
      next: r => {
        this.grade.set(r.grade);
        this.aviso.set(r.criadas === 0
          ? 'Todas essas variações já existiam.'
          : `${r.criadas} variação(ões) criada(s)${r.puladas ? `; ${r.puladas} já existia(m)` : ''}.`);
        this.selecao.set({});
        this.gerando.set(false);
      },
      error: err => {
        this.erro.set(textoDoErro(lerErroApi(err, 'Não foi possível gerar a grade.'), 'Não foi possível gerar a grade.'));
        this.gerando.set(false);
      }
    });
  }

  adicionarValor(eixo: GradeEixo) {
    const n = this.novoValor[eixo.id];
    if (!n?.codigo?.trim() || !n?.nome?.trim()) { this.erro.set('Informe o código e o nome do novo valor.'); return; }
    this.erro.set('');
    this.service.criarValor(eixo.id, { codigo: n.codigo.trim(), nome: n.nome.trim(), ordem: eixo.valores.length + 1 }).subscribe({
      next: v => {
        this.eixos.update(es => es.map(e => e.id === eixo.id ? { ...e, valores: [...e.valores, v] } : e));
        this.novoValor[eixo.id] = { codigo: '', nome: '' };
      },
      error: err => this.erro.set(textoDoErro(lerErroApi(err, 'Não foi possível criar o valor.'), 'Não foi possível criar o valor.'))
    });
  }

  /** Saldo da variação que tem o valor da linha e o da coluna (ou null se essa combinação não existe). */
  celula(linhaValorId: number, colunaValorId: number): VariacaoGrade | null {
    const [e0, e1] = this.eixosDaGrade();
    if (!e0 || !e1) return null;
    return (this.grade()?.variacoes ?? []).find(v => v.valores[e0.id] === linhaValorId && v.valores[e1.id] === colunaValorId) ?? null;
  }

  totalLinha(linhaValorId: number): number {
    return this.colunas().reduce((soma, c) => soma + (this.celula(linhaValorId, c.id)?.saldo ?? 0), 0);
  }

  totalColuna(colunaValorId: number): number {
    return this.linhas().reduce((soma, l) => soma + (this.celula(l.id, colunaValorId)?.saldo ?? 0), 0);
  }

  nomeDoValor(eixoId: number, valorId: number | undefined): string {
    if (valorId === undefined) return '';
    return this.eixosDaGrade().find(e => e.id === eixoId)?.valores.find(v => v.id === valorId)?.nome ?? '';
  }
}
