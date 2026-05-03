---
name: Product Badge Color Rule
description: Sempre exibir produtos como badge usando a cor cadastrada em products.color para diferenciação visual em qualquer tabela/listagem do front
type: design
---

Sempre que um produto for mencionado em qualquer tabela, listagem ou card no front, renderizar como Badge usando a cor cadastrada em `products.color` (campo `color: text` na tabela `products`).

Padrão visual de aplicação:
```tsx
<Badge
  variant="outline"
  className="text-xs font-medium"
  style={{
    backgroundColor: p.color ? `${p.color}20` : undefined,
    borderColor: p.color || undefined,
    color: p.color || undefined,
  }}
>
  {p.name}
</Badge>
```

- Sempre incluir `color` no SELECT do produto: `products(name, color)`.
- Fallback para cinza neutro (`#6b7280`) quando `color` for null.
- Nunca usar `variant="secondary"` cinza genérico para produtos — descaracteriza a diferenciação.
