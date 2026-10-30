import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { EmpresaAtivaService } from '../../../core/services/empresa-ativa.service';
import { UsuarioEmpresaService } from '../../../core/services/usuario-empresa.service';
import { ImobInventarioService } from '../../../core/services/imob-inventario.service';
import { ImobLocalService } from '../../../core/services/imob-local.service';
import { PermissaoService } from '../../../core/services/permissao.service';
import { ImobInventario, SalvarImobInventario, inventarioEditavel } from '../../../core/models/imob-inventario.model';
import { ImobLocalArvore } from '../../../core/models/imob-local.model';
import { aplicarErroNoForm, lerErroApi } from '../../../core/utils/erros-api';
import { SeletorLocaisComponent } from '../shared/seletor-locais.component';

interface MembroEquipe { usuarioId: string; nome: string; }

@Component({
  selector: 'app-imob-inventario-form',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, SeletorLocaisComponent],
  templateUrl: './imob-inventario-form.component.html'
})
export class ImobInventarioFormComponent implements OnInit {
  private fb = inject(FormBuilder);
  private service = inject(ImobInventarioService);
  private localService = inject(ImobLocalService);
  private usuarioEmpresaService = inject(UsuarioEmpresaService);
  private empresaAtiva = inject(EmpresaAtivaService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  permissao = inject(PermissaoService);

  readonly id = Number(this.route.snapshot.paramMap.get('id')) || null;
  readonly edicao = this.id !== null;

  inventario = signal<ImobInventario | null>(null);
  arvore = signal<ImobLocalArvore[]>([]);
  /** Usuários ativos da empresa ativa (`GET empresa-ativa/usuarios`); só o admin escolhe a equipe. */
  usuariosEmpresa = signal<MembroEquipe[]>([]);
  loading = signal(false);
  erroCarga = signal('');
  naoEncontrado = signal(false);
  saving = signal(false);
  saveError = signal('');

  form = this.fb.group({
    nome: ['', [Validators.required, Validators.maxLength(200)]],
    descricao: ['', [Validators.maxLength(2000)]],
    localIds: [[] as number[], [Validators.required, Validators.minLength(1)]],
    usuarioIds: [[] as string[]],
    reavaliacao: [false],
    dataBase: ['']
  });

  /** Escopo congelado depois de iniciado. */
  escopoBloqueado = computed(() => this.inventario()?.status === 'em_andamento');
  naoEditavel = computed(() => {
    const i = this.inventario();
    return i !== null && !inventarioEditavel(i.status);
  });
  podeEscolherEquipe = computed(() => this.permissao.canManageUsers());

  /** Data-base não pode ser futura (o servidor valida no fuso de São Paulo). */
  readonly hoje = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);

  /** Usuários da empresa mais quem já está na equipe (mesmo que desvinculado depois). */
  opcoesEquipe = computed<MembroEquipe[]>(() => {
    const mapa = new Map(this.usuariosEmpresa().map(u => [u.usuarioId, u]));
    for (const m of this.inventario()?.equipe ?? []) {
      if (!mapa.has(m.usuarioId)) mapa.set(m.usuarioId, { usuarioId: m.usuarioId, nome: m.nome ?? `Usuário ${m.usuarioId.slice(0, 8)}` });
    }
    return [...mapa.values()].sort((a, b) => a.nome.localeCompare(b.nome));
  });

  ngOnInit() {
    this.form.controls.reavaliacao.valueChanges.subscribe(on => {
      const c = this.form.controls.dataBase;
      c.setValidators(on ? [Validators.required] : []);
      c.updateValueAndValidity();
    });

    this.localService.arvore().subscribe({
      next: a => this.arvore.set(a),
      error: () => this.erroCarga.set('Não foi possível carregar os locais.')
    });

    const empresaId = this.empresaAtiva.id();
    if (this.podeEscolherEquipe() && empresaId !== null) {
      this.usuarioEmpresaService.listarTodos({ ativo: true }).subscribe({
        next: lista => this.usuariosEmpresa.set(lista.map(u => ({ usuarioId: u.id, nome: u.nome }))),
        error: () => this.erroCarga.set('Não foi possível carregar os usuários da empresa.')
      });
    }

    if (this.edicao) {
      this.loading.set(true);
      this.service.obter(this.id!).subscribe({
        next: inv => {
          this.inventario.set(inv);
          this.form.reset({
            nome: inv.nome, descricao: inv.descricao ?? '',
            localIds: inv.locais.map(l => l.localId), usuarioIds: inv.equipe.map(m => m.usuarioId),
            reavaliacao: inv.reavaliacao, dataBase: inv.dataBase ?? ''
          });
          if (this.naoEditavel()) this.form.disable({ emitEvent: false });
          else if (this.escopoBloqueado()) {
            this.form.controls.localIds.disable({ emitEvent: false });
            this.form.controls.reavaliacao.disable({ emitEvent: false });
            this.form.controls.dataBase.disable({ emitEvent: false });
          }
          this.loading.set(false);
        },
        error: err => {
          if (err.status === 404) this.naoEncontrado.set(true);
          else this.erroCarga.set(lerErroApi(err, 'Erro ao carregar o inventário.').mensagem);
          this.loading.set(false);
        }
      });
    }
  }

  equipeMarcada(id: string): boolean {
    return (this.form.controls.usuarioIds.value ?? []).includes(id);
  }

  alternarMembro(id: string, marcar: boolean) {
    const atual = this.form.controls.usuarioIds.value ?? [];
    this.form.controls.usuarioIds.setValue(marcar ? [...new Set([...atual, id])] : atual.filter(x => x !== id));
    this.form.controls.usuarioIds.markAsDirty();
  }

  save() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.saving.set(true);
    this.saveError.set('');

    const v = this.form.getRawValue();
    const payload: SalvarImobInventario = {
      nome: v.nome!.trim(),
      descricao: v.descricao?.trim() || undefined,
      localIds: v.localIds ?? [],
      usuarioIds: v.usuarioIds ?? [],
      reavaliacao: !!v.reavaliacao,
      dataBase: v.reavaliacao && v.dataBase ? v.dataBase : undefined
    };

    const op = this.edicao ? this.service.atualizar(this.id!, payload) : this.service.criar(payload);
    op.subscribe({
      next: salvo => {
        this.saving.set(false);
        this.router.navigate(['/imobilizado/inventarios', salvo?.id ?? this.id]);
      },
      error: err => {
        this.saveError.set(aplicarErroNoForm(this.form, lerErroApi(err, 'Erro ao salvar inventário.'), {
          nome: ['nome'],
          localIds: ['local', 'escopo'],
          dataBase: ['data-base', 'database']
        }));
        this.saving.set(false);
      }
    });
  }

  erroNome(): string {
    const c = this.form.controls.nome;
    if (c.errors?.['servidor']) return c.errors['servidor'];
    if (!c.touched || !c.errors) return '';
    if (c.errors['required']) return 'Campo obrigatório.';
    if (c.errors['maxlength']) return 'Máximo de 200 caracteres.';
    return '';
  }

  erroDescricao(): string {
    const c = this.form.controls.descricao;
    return c.touched && c.errors?.['maxlength'] ? 'Máximo de 2000 caracteres.' : '';
  }

  erroDataBase(): string {
    const c = this.form.controls.dataBase;
    if (c.errors?.['servidor']) return c.errors['servidor'];
    return c.touched && c.errors?.['required'] ? 'Informe a data-base.' : '';
  }

  erroLocais(): string {
    const c = this.form.controls.localIds;
    if (c.errors?.['servidor']) return c.errors['servidor'];
    return c.touched && c.errors ? 'Selecione ao menos um local.' : '';
  }
}
