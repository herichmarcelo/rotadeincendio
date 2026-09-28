# Documentação Técnica: Relatório Semanal de Status Operacional

Esta documentação descreve as regras de negócio, arquitetura técnica, fluxo de dados e especificação da exportação em PDF do **Relatório Semanal de Status Operacional** do sistema **Rota de Incêndio**.

---

## 1. Visão Geral e Motivação

O objetivo deste módulo é unificar e modernizar o controle das vistorias de rotas de fuga e equipamentos de combate a incêndio, substituindo o antigo preenchimento manual em planilhas Excel por um fluxo integrado, automatizado e com rastreabilidade em tempo real.

### Principais Capacidades:
- **Agrupamento Semanal por Setores:** Consolidação automática de todos os checklists realizados entre Segunda-feira e Domingo de uma semana de referência.
- **Navegação Histórica de Semanas:** Permite retroceder ou avançar semanas via parâmetros de URL (`?semana=YYYY-MM-DD`), viabilizando a análise e impressão de períodos anteriores.
- **Filtro por Unidade:** Segmentação por planta/unidade (`?unidadeId=...`) respeitando níveis de acesso e RLS (Row Level Security).
- **Visual Excel Modernizado no Dashboard:** Interface clara com código de cores (verde para conforme, vermelho para não conforme, cinza para pendente), bordas laterais indicativas e ícones vetoriais padronizados (Lucide React).
- **Exportação Profissional em PDF:** Documento gerado no navegador em formato A4 Paisagem (Landscape), com identidade visual corporativa (cabeçalho vermelho e corpo branco), sem uso de emojis para assegurar compatibilidade e clareza tipográfica.

---

## 2. Arquitetura de Componentes e Arquivos

```
src/
├── services/
│   └── relatorio.ts                    # Lógica de agregação semanal, cálculo de % e filtros no Supabase
├── components/
│   └── dashboard/
│       ├── DashboardSemanaNav.tsx      # Navegador interativo de semanas (?semana=)
│       ├── DashboardUnidadeFilter.tsx  # Seletor de unidades via pills (?unidadeId=)
│       ├── RelatorioOperacional.tsx    # Tabela visual no dashboard estilo planilha moderna
│       └── ExportarRelatorioBtn.tsx    # Motor de geração de PDF via jsPDF & autoTable
└── app/(main)/dashboard/
    └── page.tsx                        # Server Component orquestrador que consome searchParams
```

---

## 3. Modelo e Fluxo de Dados

### 3.1 Definição do Período Semanal
A semana operacional é calculada considerando **Segunda-feira** como início (`00:00:00`) e **Domingo** como término (`23:59:59`):

```ts
// Exemplo de cálculo em src/services/relatorio.ts
const dayOfWeek = refDate.getDay(); // 0 = Domingo, 1 = Segunda...
const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
// inicioSemana: Segunda-feira
// fimSemana: Domingo (+6 dias a partir da Segunda)
```

### 3.2 Agrupamento por Setor
A consulta consolida os itens das auditorias da semana agrupados por setor:
1. `auditorias` filtradas por `data_auditoria >= inicioSemana AND data_auditoria <= fimSemana`.
2. Filtro opcional por `unidade_id`.
3. Verificação de permissão do usuário logado (auditores comuns têm acesso restrito aos seus registros via RLS; administradores acessam todas as unidades).
4. Agrupamento dos itens de checklist (`itens_auditoria`) sob os respectivos `setores`.

### 3.3 Status e Métricas Calculadas
Para cada setor e para o relatório consolidado, são apurados:
- **Total de Itens:** Quantidade total de pontos de checagem previstos.
- **Conformes:** Itens com status `aprovado`.
- **Não Conformes:** Itens com status `reprovado`.
- **Pendentes:** Itens ainda não auditados na semana.
- **% de Conclusão / Conformidade:**
  $$\% \text{ Conclusão} = \left(\frac{\text{Conformes} + \text{Não Conformes}}{\text{Total de Itens}}\right) \times 100$$
  $$\% \text{ Conformidade} = \left(\frac{\text{Conformes}}{\text{Itens Auditados}}\right) \times 100$$

---

## 4. Interface do Dashboard

### A. Filtro e Navegação de Períodos (`DashboardSemanaNav.tsx`)
- Componente Client-side (`"use client"`).
- **Seleção Flexível (De ... Até ...):** Permite ao usuário escolher qualquer intervalo customizado de datas (ex.: `04/09 a 09/09`) via inputs nativos de data (`<input type="date">`).
- **Atalhos Rápidos em 1 Clique:**
  - *Esta Semana* (Segunda a Domingo da semana atual)
  - *Semana Anterior*
  - *Últimos 7 dias*
  - *Últimos 15 dias*
  - *Este Mês Completo* (dia 1 ao último dia do mês corrente)
- **Navegação Passo a Passo (`<` e `>`):** Permite avançar ou retroceder dinamicamente respeitando o mesmo tamanho de dias do intervalo selecionado.
- **Roteamento e URL:** Mantém o estado via parâmetros de URL (`?dataInicio=YYYY-MM-DD&dataFim=YYYY-MM-DD` ou `?semana=YYYY-MM-DD`), preservando filtros de unidade e permitindo compartilhamento de links.
- **Badge Indicador:** Exibe a tag `Atual` para a semana corrente ou a contagem de dias selecionados (ex.: `6d`) para períodos personalizados.

### B. Filtro de Unidades (`DashboardUnidadeFilter.tsx`)
- Apresenta "Todas as Unidades" ou filtros específicos (ex: São Bernardo do Campo).
- Permite alternância rápida sem recarregar a aplicação inteira (Server-side data fetching via Next.js router cache).

### C. Visualização Operacional (`RelatorioOperacional.tsx`)
- Linhas estilizadas com classes Tailwind dedicadas:
  - **Aprovado:** Fundo esmeralda suave (`bg-emerald-500/10`), borda lateral verde (`border-l-emerald-500`), ícone `<CheckCircle2 />`.
  - **Reprovado:** Fundo vermelho suave (`bg-red-500/10`), borda lateral vermelha (`border-l-red-500`), ícone `<XCircle />`.
  - **Pendente:** Fundo neutro (`bg-muted/30`), borda lateral cinza (`border-l-slate-400`), ícone `<MinusCircle />`.
- Exibição de observações do auditor quando houver não conformidade registrada.

---

## 5. Especificação do PDF (`ExportarRelatorioBtn.tsx`)

A exportação foi implementada utilizando **`jspdf`** e **`jspdf-autotable`** com foco em apresentação executiva e conformidade industrial.

### 5.1 Diretrizes de Design
| Elemento | Especificação |
|---|---|
| **Orientação** | A4 Paisagem (`landscape`, 297mm x 210mm) |
| **Fundo da Página** | Branco (`#FFFFFF`) |
| **Cabeçalho Corporativo** | Faixa superior Vermelha Thales (`#DC2626` / `#B91C1C`) |
| **Tipografia** | Helvetica / Helvetica-Bold (nativa do jsPDF, leve e compatível) |
| **Metadados** | Unidade, Semana (data início e fim), Data de Emissão e Auditor |
| **Eliminação de Emojis** | Emojis causam falhas de codificação (glyphs desconhecidos) em PDFs. Foram substituídos por círculos vetoriais nativos (`doc.circle`) com as legendas `OK`, `NÃO` e `-`. |

### 5.2 Estrutura do Documento Gerado
1. **Header:** Identificação da Thales, título "RELATÓRIO DE STATUS OPERACIONAL - ROTAS DE INCÊNDIO" e período.
2. **Cards de Resumo Executivo:**
   - Total de Setores
   - Itens Inspecionados vs. Total
   - Taxa de Conformidade (%)
3. **Detalhamento por Setor:**
   - Tabela organizada por setor contendo os pontos, status e observações.
4. **Tabela de Resumo Sintético:**
   - Gerada via `autoTable` no rodapé da página com cabeçalho estilizado em cinza escuro/vermelho com totais consolidados.
5. **Rodapé:** Paginação automática (`Página X de Y`) e carimbo de conformidade.

---

## 6. Boas Práticas e Compatibilidade Next.js 15/16

Conforme as diretrizes arquiteturais do projeto:
- **`searchParams` Assíncrono:** No Next.js 15+, a prop `searchParams` de `page.tsx` é uma `Promise`, sendo consumida com `await searchParams`.
- **Server Components:** A agregação de dados e consultas Supabase permanecem no servidor, enviando para o cliente apenas os dados tratados para otimizar desempenho e segurança.
- **Offline / PWA Ready:** O relatório respeita o armazenamento local e as sincronizações pendentes de vistorias realizadas em campo.
