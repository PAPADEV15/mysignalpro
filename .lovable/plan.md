## Plano de Implementação - Crypto Intraday Analyst

### Fase 1: Fundação (esta mensagem)
1. **Design System** - Tema escuro profissional, tokens semânticos
2. **Database Schema** - Todas as tabelas com migrations, RLS, roles
3. **Autenticação** - Login, roles (admin/analyst/viewer)
4. **Core Frontend** - Layout, navegação, todas as páginas base
5. **Tipos TypeScript** - Interfaces para todo o domínio

### Fase 2: Backend & Lógica (próxima iteração)
1. **Edge Functions** - Market data, analysis engine, reconciliation
2. **Indicator Engine** - EMA, SMA, RSI, ATR, VWAP calculations
3. **Strategy Module** - Regime 4H, alinhamento 1H, execução 15m
4. **Scoring Engine** - Score 0-100 com 4 blocos
5. **Signal Reconciliation** - Estado machine completa

### Fase 3: Dashboard & Real-time (iteração seguinte)
1. **WebSocket Binance** - Streams de kline em tempo real
2. **Dashboard interativo** - Watchlist com dados reais
3. **Jobs/Scheduler** - Automação de análise e reconciliação
4. **Admin panels** - Settings, watchlist management, audit

### Fase 4: Polish & Métricas
1. **Métricas de qualidade** - Win rate, R médio, histogramas
2. **Audit logs** - Telemetria completa
3. **Testes end-to-end** - Validação do fluxo operacional

Vou começar com a Fase 1 agora, construindo toda a fundação sólida.