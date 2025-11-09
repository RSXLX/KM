# Sports Fixtures Integration with Markets Table

## 目标
- 复用并扩展现有 `markets` 表，产出前端 `SportsClassifiedGrid` 所需的比赛列表数据（Pre/Live）。
- 后端提供稳定接口与响应结构；前端用现有分类与映射逻辑，无侵入接入。

## 数据结构对齐
- 前端当前使用的 Mock 结构（供映射）：
  - `MockFixture`：
    - `id: string`
    - `title: string`
    - `sport: string`（如 `NBA`、`NFL`、`Premier League`）
    - `league?: string`（如 `EPL`、`UEFA Champions League`）
    - `homeTeam: string`
    - `awayTeam: string`
    - `kickoffTime: string`（展示时间或阶段文本）
    - `status?: 'pre' | 'live' | 'final'`
    - `preOdds?: { home: number; away: number; draw?: number }`
    - `liveOdds?: { home: number; away: number; draw?: number }`
- 前端最终渲染结构（`LiveMatch`）：由 `MockFixture` → `enrichFixture` → `映射` 生成。

## 表结构扩展（markets）
- 已存在的兼容列（项目已通过迁移/启动确保）：
  - `market_address VARCHAR(128)`
  - `home_code INT`、`away_code INT`
  - `home_name VARCHAR(128)`、`away_name VARCHAR(128)`
  - `close_time TIMESTAMPTZ`
  - `state INT DEFAULT 1`、`result INT DEFAULT 0`
  - `odds_home_bps INT`、`odds_away_bps INT`
  - `max_exposure NUMERIC`、`current_exposure NUMERIC`
  - `total_volume NUMERIC`、`total_bets INT`、`resolved_at TIMESTAMPTZ`
- 需要新增的列（便于稳定分类与展示）：
  - `sport VARCHAR(64)`：如 `NBA`、`NFL`、`Premier League`、`UCL`、`MLB`、`Tennis`
  - `league VARCHAR(128)`：如 `NBA`、`EPL`、`UEFA Champions League`、`MLB`、`ATP`

### 推荐迁移（示例 SQL）
```sql
ALTER TABLE markets ADD COLUMN IF NOT EXISTS sport VARCHAR(64);
ALTER TABLE markets ADD COLUMN IF NOT EXISTS league VARCHAR(128);
CREATE INDEX IF NOT EXISTS idx_markets_sport ON markets(sport);
CREATE INDEX IF NOT EXISTS idx_markets_league ON markets(league);
```

## 视图与响应映射（推荐）
- 视图 `sports_fixtures_v`（供接口读取）：
```sql
CREATE OR REPLACE VIEW sports_fixtures_v AS
SELECT
  m.id::TEXT AS id,
  COALESCE(
    m.title,
    CASE WHEN m.home_name IS NOT NULL AND m.away_name IS NOT NULL
      THEN CONCAT(COALESCE(m.sport,'Sports'), ' • ', m.home_name, ' vs ', m.away_name)
      ELSE 'Sports Fixture' END
  ) AS title,
  COALESCE(m.sport, 'Sports') AS sport,
  m.league,
  COALESCE(m.home_name, m.option_a) AS home_team,
  COALESCE(m.away_name, m.option_b) AS away_team,
  m.start_time AS kickoff_time,
  CASE
    WHEN m.state = 1 AND m.start_time > NOW() THEN 'pre'
    WHEN m.state = 1 AND m.start_time <= NOW() THEN 'live'
    WHEN m.status = 'settled' OR m.resolved_at IS NOT NULL THEN 'final'
    ELSE 'pre'
  END AS status,
  CASE WHEN m.state = 1 THEN jsonb_build_object(
    'home', (m.odds_home_bps::DOUBLE PRECISION)/10000.0,
    'away', (m.odds_away_bps::DOUBLE PRECISION)/10000.0,
    'draw', NULL
  ) END AS pre_odds,
  CASE WHEN m.state = 1 AND m.start_time <= NOW() THEN jsonb_build_object(
    'home', (m.odds_home_bps::DOUBLE PRECISION)/10000.0,
    'away', (m.odds_away_bps::DOUBLE PRECISION)/10000.0,
    'draw', NULL
  ) END AS live_odds
FROM markets m
ORDER BY m.created_at DESC;
```

## 后端接口设计
- 路径：`GET /api/v1/sports/fixtures`
- Query：
  - `status=pre|live|final`（默认 `pre`）
  - `sport=NBA|NFL|Premier League|...`
  - `league=EPL|UEFA Champions League|...`
  - `q=关键字`（匹配 `title/home_team/away_team`）
  - `page`（默认 1）、`limit`（默认 20，最大 100）
- 实现建议（SQLx）：
  - 读取 `sports_fixtures_v` 并按参数过滤；分页；返回 `MockFixture[]` 相同字段命名与结构。
- 响应示例：
```json
{
  "success": true,
  "data": {
    "fixtures": [
      {
        "id": "epl-mci-ars-002",
        "title": "Premier League • Manchester City vs Arsenal",
        "sport": "Premier League",
        "league": "EPL",
        "homeTeam": "Manchester City",
        "awayTeam": "Arsenal",
        "kickoffTime": "2025-11-12T21:00:00Z",
        "status": "pre",
        "preOdds": { "home": 2.10, "draw": 3.20, "away": 2.45 }
      }
    ],
    "pagination": { "page": 1, "limit": 20, "total": 1, "totalPages": 1 }
  }
}
```

## 前端接入步骤
- `SportsClassifiedGrid.tsx`
  - 用 `apiClient.get('/sports/fixtures')` 获取 `fixtures`，替换本地 `mockFixtures`。
  - `enrichFixture(f)` 保留；若接口已返回 `sport/league`，可直接使用而无需解析 `title`。
  - 将 `fixtures → LiveMatch[]` 映射逻辑保持不变：
    - `id = f.id`
    - `sport = c.sport`
    - `teams.home.name = f.homeTeam`；`teams.away.name = f.awayTeam`
    - `status.time = f.kickoffTime`；`status.isLive = (f.status === 'live')`
    - `liveOdds = f.status === 'live' ? f.liveOdds : f.preOdds`
    - `marketUrl = '/sports-betting?fixtureId=' + f.id + '&autoOpen=1'`
- 过滤与搜索逻辑维持现状（按 `status/sport/league/q`）。
- 环境变量：确认 `NEXT_PUBLIC_API_BASE_URL` 指向 `http://localhost:8080/api/v1`。

## 端到端步骤
- 后端
  - [ ] 添加迁移：`sport/league` 两列与索引
  - [ ] 新建视图 `sports_fixtures_v`
  - [ ] 路由：`GET /api/v1/sports/fixtures`（SQLx 查询 + 分页）
- 前端
  - [ ] 在 `SportsClassifiedGrid` 中使用 `apiClient` 请求后端数据
  - [ ] 复用 `enrichFixture` 与现有映射生成 `LiveMatch[]`
  - [ ] 验证 `Pre/Live` 切换、联赛 Tab、搜索过滤

## 测试要点
- 数据正确性：`title/sport/league/homeTeam/awayTeam/kickoffTime/status/odds` 对齐。
- 过滤一致性：前端切换与后端查询参数一致（必要时后端仅做分页，前端做二次过滤）。
- 性能：分页上限 100，增加 `sport/league` 索引避免全表扫描。
- 兼容性：若后端暂不填 `sport/league`，前端仍可用 `title` 解析分类，不影响展示。