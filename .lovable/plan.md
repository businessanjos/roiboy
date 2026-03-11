

## Remover cards de scores do perfil do cliente

### Alteração

Remover o bloco inteiro de 6 cards (linhas 2028-2116) em `src/pages/ClientDetail.tsx`:
- ROIzômetro
- E-Score
- V-NPS
- Quadrante
- Tendência
- Vigência

O grid `<div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 ...">` e todos os `<Card>` filhos serão removidos. O conteúdo abaixo (Risk Alerts, etc.) continuará normalmente.

### Arquivo editado
- `src/pages/ClientDetail.tsx` — remoção das linhas 2028-2116

