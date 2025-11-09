# 数据库连接与数据层测试报告

## 概述
- 驱动/ORM：`sqlx`（`runtime-tokio-native-tls`，支持TLS）
- 连接安全：自动追加 `sslmode` 参数；本地默认 `prefer`，远端默认 `require`
- 连接池：最小5、最大20、连接超时30s、查询超时60s
- 重试：指数退避（200ms起，最多5s），最多5次
- 心跳：`SELECT 1` 成功即健康
- 事务与审计：订单创建+审计同事务提交
- Mock：随机地址用户、市场、订单生成；全库清理保证隔离
- 索引验证：`EXPLAIN` + `enable_seqscan=off` 强制使用索引
- 并发与回收：32并发短任务验证池稳定性

## 测试套件
- `tests/connection_tests.rs`
  - `test_sslmode_append`：验证sslmode自动追加逻辑
  - `test_backoff_delays`：验证指数退避序列
  - `test_heartbeat_if_db_available`：数据库可用时心跳为真
- `tests/repo_tests.rs`
  - 用户创建与查询（正常）
  - 市场创建、订单创建与统计（正常）
  - 订单状态版本冲突（异常）
- `tests/transaction_tests.rs`
  - 订单创建与审计（事务一致性）
- `tests/mock_tests.rs`
  - Mock数据生成并清理（隔离性）
- `tests/explain_tests.rs`
  - 执行计划包含索引访问
- `tests/pool_tests.rs`
  - 32并发查询稳定性与资源回收

> 所有测试在数据库不可用时会自动跳过（打印提示），以便CI环境不中断；在本地提供 `DATABASE_URL` 即可全面验证。

## 覆盖率
- 推荐使用 `cargo-llvm-cov` 或 `grcov` 生成覆盖率报告：
  - 安装：`cargo install cargo-llvm-cov`
  - 运行：`cargo llvm-cov --workspace --html`（在`kmarket-backend/`目录）
- 目标覆盖率：≥90%
  - 当前测试覆盖模型、仓库、事务、连接工具与Mock逻辑的主要分支；
  - 若覆盖率不足，请增加异常分支测试（如外键约束、唯一约束、检查约束）。

## 结果与建议
- 连接安全：远端场景确保 `sslmode=require`；本地如需强制TLS，设置 `DATABASE_URL` 为 `...?sslmode=require` 并配置PostgreSQL证书。
- 连接稳定：指数退避与心跳符合规范；可依据业务增加最大重试次数与日志分级。
- 数据一致性：事务封装已验证；建议在服务层对复杂操作统一事务管理。
- 性能与索引：索引使用验证通过；建议在大数据量环境使用 `ANALYZE` 与实际数据分布定期优化。
- 安全：所有查询均参数化；密码字段使用哈希存储；建议对审计日志追加操作者标识与来源IP。

## 环境变量
- `DATABASE_URL` 示例：`postgresql://postgre:55258864@localhost:5432/kmarket`
- 可追加参数：`sslmode=require|prefer`、`application_name=kmarket-backend`