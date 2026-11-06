export interface ErroImportacao {
  linha: number;
  plaqueta?: string | null;
  /** Coluna canônica ou `linha` (problema geral da linha). */
  campo: string;
  mensagem: string;
}

export interface PendenciaImportacao {
  nome: string;
  linhas: number;
}

export interface RelatorioImportacao {
  totalLinhas: number;
  linhasValidas: number;
  linhasComErro: number;
  linhasComDadosIncompletos: number;
  totalErros: number;
  errosTruncados: boolean;
  erros: ErroImportacao[];
  categoriasNaoEncontradas: PendenciaImportacao[];
  locaisNaoEncontrados: PendenciaImportacao[];
  colunasIgnoradas: string[];
  /** Campos customizados cujas colunas foram reconhecidas pelo cabeçalho. */
  camposCustomizadosReconhecidos?: string[];
  /** Observações que não impedem a importação (ex.: planilha com várias abas). */
  avisos?: string[];
  /** Formato do arquivo enviado. */
  formato?: 'csv' | 'xlsx';
  hashArquivo: string;
  podeConfirmar: boolean;
}

export interface ResultadoImportacao {
  importados: number;
  ignoradas: number;
  relatorio: RelatorioImportacao;
}
