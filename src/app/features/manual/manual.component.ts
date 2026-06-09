import { Component, inject, OnInit, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { marked } from 'marked';

@Component({
  selector: 'app-manual',
  standalone: true,
  imports: [],
  templateUrl: './manual.component.html'
})
export class ManualComponent implements OnInit {
  private http = inject(HttpClient);
  private sanitizer = inject(DomSanitizer);

  conteudo = signal<SafeHtml>('');
  loading = signal(true);
  erro = signal(false);

  ngOnInit() {
    this.http.get('docs/manual-usuario.md', { responseType: 'text' }).subscribe({
      next: md => {
        let html = marked.parse(md) as string;
        html = html
          .replace(/<table>/g, '<div class="table-responsive my-3"><table class="table table-bordered table-sm">')
          .replace(/<\/table>/g, '</table></div>');
        this.conteudo.set(this.sanitizer.bypassSecurityTrustHtml(html));
        this.loading.set(false);
      },
      error: () => {
        this.erro.set(true);
        this.loading.set(false);
      }
    });
  }
}
