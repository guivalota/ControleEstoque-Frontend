import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ImobBemService } from '../../../core/services/imob-bem.service';
import { ImobLocalService } from '../../../core/services/imob-local.service';
import { ImobOrdemServicoService } from '../../../core/services/imob-ordem-servico.service';
import { ImobBem, ROTULO_STATUS_BEM } from '../../../core/models/imob-bem.model';
import { ImobLocalArvore } from '../../../core/models/imob-local.model';
import {
  CriarImobOs, ImobOsDados, ImobOsMotivoBaixa, ImobOsTipo, MOTIVOS_BAIXA, ROTULO_MOTIVO_BAIXA, ROTULO_TIPO_OS,
  STATUS_ELEGIVEIS_OS, TIPOS_OS
} from '../../../core/models/imob-ordem-servico.model';
import { lerErroApi } from '../../../core/utils/erros-api';
import { AutocompleteResponsavelComponent } from '../shared/autocomplete-responsavel.component';
import { SeletorLocalComponent } from '../shared/seletor-local.component';

const MAX_BENS = 200;
const MAX_RESULTADOS = 10;

interface ItemForm {
  bem: ImobBem;
  local: FormControl<number | null>;
  responsavel: FormControl<number | null>;
}

@Component({
  selector: 'app-imob-os-form',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, SeletorLocalComponent, AutocompleteResponsavelComponent],
  templateUrl: './imob-os-form.component.html'
})
export class ImobOsFormComponent implements OnInit {
  private service = inject(ImobOrdemServicoService);
  private bensService = inject(ImobBemService);
  private locais = inject(ImobLocalService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  readonly tipos = TIPOS_OS;
  readonly motivos = MOTIVOS_BAIXA;
  readonly maxBens = MAX_BENS;
  rotuloTipo = ROTULO_TIPO_OS;
  rotuloMotivo = ROTULO_MOTIVO_BAIXA;
  rotuloStatusBem = ROTULO_STATUS_BEM;

  form = new FormGroup({
    tipo: new FormControl<ImobOsTipo>('transferencia', { nonNullable: true }),
    justificativa: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(2000)] }),
    // venda
    valorVenda: new FormControl<number | null>(null, [Validators.min(0)]),
    compradorNome: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(255)] }),
    dataVenda: new FormControl('', { nonNullable: true }),
    numeroDocumento: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(100)] }),
    // baixa
    motivoBaixa: new FormControl<ImobOsMotivoBaixa | ''>('', { nonNullable: true }),
    // manutenção
    fornecedorServicoNome: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(255)] }),
    previsaoConclusao: new FormControl('', { nonNullable: true }),
    custoEstimado: new FormControl<number | null>(null, [Validators.min(0)])
  });

  tipo = signal<ImobOsTipo>('transferencia');
  arvore = signal<ImobLocalArvore[]>([]);
  itens = signal<ItemForm[]>([]);
  busca = new FormControl('', { nonNullable: true });
  resultados = signal<ImobBem[]>([]);
  buscando = signal(false);
  enviando = signal(false);
  erro = signal('');
  tentouEnviar = signal(false);

  idsSelecionados = computed(() => new Set(this.itens().map(i => i.bem.id)));

  ngOnInit() {
    this.locais.arvore().subscribe({ next: a => this.arvore.set(a), error: () => this.arvore.set([]) });
    const bemId = Number(this.route.snapshot.queryParamMap.get('bemId'));
    if (bemId) {
      this.bensService.obter(bemId).subscribe({
        next: bem => this.adicionar(bem),
        error: err => this.erro.set(lerErroApi(err, 'Não foi possível carregar o bem informado.').mensagem)
      });
    }
  }

  mudarTipo(tipo: ImobOsTipo) {
    this.tipo.set(tipo);
    this.form.controls.tipo.setValue(tipo);
    // Bens que não servem ao novo tipo saem da seleção.
    this.itens.update(l => l.filter(i => this.elegivel(i.bem)));
    this.resultados.set([]);
  }

  elegivel(bem: ImobBem, tipo = this.tipo()): boolean {
    return STATUS_ELEGIVEIS_OS[tipo].includes(bem.status);
  }

  buscar() {
    const termo = this.busca.value.trim();
    if (!termo) { this.resultados.set([]); return; }
    this.buscando.set(true);
    this.bensService.listar({ busca: termo, page: 1, pageSize: MAX_RESULTADOS }).subscribe({
      next: r => { this.resultados.set(r.items); this.buscando.set(false); },
      error: err => { this.buscando.set(false); this.erro.set(lerErroApi(err, 'Erro ao buscar bens.').mensagem); }
    });
  }

  adicionar(bem: ImobBem) {
    if (this.idsSelecionados().has(bem.id)) return;
    if (this.itens().length >= MAX_BENS) { this.erro.set(`Uma OS aceita no máximo ${MAX_BENS} bens.`); return; }
    this.itens.update(l => [...l, { bem, local: new FormControl<number | null>(null), responsavel: new FormControl<number | null>(null) }]);
  }

  remover(bemId: number) {
    this.itens.update(l => l.filter(i => i.bem.id !== bemId));
  }

  /** Copia o destino do primeiro bem para os demais. */
  aplicarATodos() {
    const [primeiro, ...resto] = this.itens();
    if (!primeiro) return;
    for (const i of resto) {
      i.local.setValue(primeiro.local.value);
      i.responsavel.setValue(primeiro.responsavel.value);
    }
  }

  private dados(): ImobOsDados | undefined {
    const v = this.form.getRawValue();
    switch (this.tipo()) {
      case 'venda':
        return {
          valorVenda: v.valorVenda, compradorNome: v.compradorNome.trim(),
          dataVenda: v.dataVenda || undefined, numeroDocumento: v.numeroDocumento.trim() || undefined
        };
      case 'baixa':
        return { motivoBaixa: (v.motivoBaixa || undefined) as ImobOsMotivoBaixa | undefined };
      case 'manutencao':
        return {
          fornecedorServicoNome: v.fornecedorServicoNome.trim() || undefined,
          previsaoConclusao: v.previsaoConclusao || undefined, custoEstimado: v.custoEstimado
        };
      default:
        return undefined;
    }
  }

  /** Validações de tela; as regras de negócio completas continuam no servidor. */
  private problema(): string {
    const v = this.form.getRawValue();
    if (this.form.invalid) return 'Revise os campos destacados.';
    if (this.itens().length === 0) return 'Selecione ao menos um bem.';
    if (this.tipo() === 'venda' && (v.valorVenda === null || !v.compradorNome.trim())) return 'A venda exige o valor e o nome do comprador.';
    if (this.tipo() === 'baixa' && !v.motivoBaixa) return 'A baixa exige o motivo.';
    if (this.tipo() === 'transferencia' && this.itens().some(i => i.local.value === null && i.responsavel.value === null)) {
      return 'Informe o local e/ou o responsável de destino de cada bem.';
    }
    return '';
  }

  enviar() {
    this.tentouEnviar.set(true);
    this.form.markAllAsTouched();
    this.erro.set(this.problema());
    if (this.erro()) return;
    const transferencia = this.tipo() === 'transferencia';
    const req: CriarImobOs = {
      tipo: this.tipo(),
      justificativa: this.form.controls.justificativa.value.trim(),
      dados: this.dados(),
      itens: this.itens().map(i => ({
        bemId: i.bem.id,
        localDestinoId: transferencia ? i.local.value : undefined,
        responsavelDestinoId: transferencia ? i.responsavel.value : undefined
      }))
    };
    this.enviando.set(true);
    this.service.abrir(req).subscribe({
      next: os => { this.enviando.set(false); this.router.navigate(['/imobilizado/ordens-servico', os.id]); },
      error: err => { this.enviando.set(false); this.erro.set(lerErroApi(err, 'Erro ao abrir a ordem de serviço.').mensagem); }
    });
  }
}
