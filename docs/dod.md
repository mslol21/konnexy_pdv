# Definição de Pronto (Definition of Done - DoD)

Para que qualquer recurso ou fase seja considerada concluída no Konnexy PDV, deve cumprir rigorosamente os seguintes critérios:

1. **Tipagem Strict**: Código TypeScript sem supressões arbitrárias (`any` não justificado, `@ts-ignore`).
2. **Moeda em Centavos**: Nenhum valor monetário armazenado ou calculado em ponto flutuante no domínio de negócio. Todos os cálculos usam números inteiros (`Math.round` apenas em taxas/divisões e imediatamente normalizados para inteiro).
3. **Persistência Offline**: Nenhuma ação do usuário fica restrita ao estado volátil de memória (React state/Zustand sem persistência). Todas as mutações são persistidas no IndexedDB (Dexie).
4. **Outbox Pattern**: Toda gravação de negócio gera o respectivo `sync_events` na mesma transação local.
5. **Responsividade**: Layout testado em Desktop (1440x900), Tablet (768x1024) e Smartphone (375x667). Alvos de toque (botões, inputs) com dimensão mínima de 44x44px.
6. **Acessibilidade e Feedback**: Estados claros de Loading, Empty State, Error e Conexão Offline. Contraste mínimo WCAG AA.
7. **Testes Automatizados**: Testes de unidade e integração executando com sucesso no Vitest antes de cada liberação de fase.
8. **Documentação e Auditoria**: Cada alteração imutável possui registro com timestamp, ID do usuário e identificação do dispositivo.
