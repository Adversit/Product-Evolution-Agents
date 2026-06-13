# 研发执行报告

> 产品：RAGFlow ｜ 模块：文件上传与问答质量
> 注意：本报告只输出**建议**，不产出任何代码改动（无 Patch/PR）。


## 需求摘要 + 验收标准

**解析任务稳定性修复——分阶段状态机、结构化错误透传与自动重试**（req-01）

- 背景：RAGFlow 用户在多种高频场景遭遇解析任务卡死或失败：80–100MB+ 大文件长时间转圈后直接失败（sig-001, sig-003）、GraphRAG 启用后任务队列堆积导致整体卡死（sig-013, sig-014）、docx 文件解析卡在 0%（sig-005）、PDF 解析完成后长期处于 pending 状态（sig-006, sig-007）。竞品调研显示 Dify、AnythingLLM、Open WebUI 同样面临大文件/批量场景的卡死问题且均未给出成熟方案（cf-02, cf-04, cf-06），说明这是行业共性痛点。根因分析（tf-05, tf-06）表明：当前解析流程将多步骤（提取→OCR→分块→嵌入→索引）压缩为单一「解析中」状态，worker 崩溃后状态机无法推进到 failed，任务永久卡死；同时失败后不记录结构化原因，错误链路在「异常捕获→存储→前端展示」环节断裂，用户无法获知具体失败原因，只能盲目重试或重新上传大文件。该问题出现频率极高（frequency=10）、严重度为 critical（sig-021, sig-022, sig-023），已确认为 known 状态。
- 痛点：用户上传 80–100MB 的大文件后，解析任务经常长时间转圈甚至直接失败（sig-001, sig-003）；失败时没有任何错误原因提示，只看到笼统的「解析失败」，不知道是格式不支持、OCR 超时、还是内存不足。GraphRAG 场景更严重：启用后任务队列堆积、worker 崩溃，任务永久卡在 pending/0%（sig-013, sig-014），用户只能反复重试或重新上传，每次重试都耗费大量时间和带宽。docx 卡在 0%（sig-005）、PDF 解析后长期 pending（sig-006）也频繁出现，导致知识库无法按时交付，严重影响日常工作流。

- 方案概要：针对用户上传大文件（80–100MB+）后解析任务频繁卡死、失败无明确提示、GraphRAG 场景队列堆积的 P0 级问题，本方案构建一套以"分阶段状态机 + Worker 心跳超时检测"为核心的解析任务稳定性体系。方案覆盖：将解析流程拆分为 8 个枚举阶段并持久化阶段级进度与心跳；引入结构化错误码体系（OOM/OCR 超时/格式不支持/依赖抖动）并全链路透传至前端友好展示；实现可重试 vs 不可重试错误分类与指数退避自动重试（10s/30s/90s，最多 3 次），以分块/索引的 upsert 幂等写入为前置保障；前端提供分阶段进度条与失败原因展示 + 手动重试入口。方案不涉及 GraphRAG 完整幂等性、分块预览、RAG 检索质量优化及备用解析引擎集成，确保聚焦核心卡死修复。

### 验收标准
- [functional] 解析任务必须按枚举阶段流转（uploaded→queued→extracting→ocr→chunking→embedding→indexing→done|failed），每个阶段切换时将当前阶段名、进度、心跳时间戳持久化到状态表；worker 崩溃后，心跳超时检测在 2×阶段阈值内将任务标记为 failed 或触发重试，不再出现永久 pending 状态 _(证据：sig-013, sig-014, tf-05, tf-16, tf-18, tf-19)_- [functional] 解析任务失败时，系统必须写入结构化错误记录（error_type/error_stage/error_message/retryable），至少覆盖 OOM、OCR 超时、格式不支持、依赖服务抖动四类错误分类；前端展示用户友好化文案并提供手动重试按钮，用户看到的错误原因不再是笼统的「解析失败」 _(证据：sig-001, sig-003, tf-03, tf-06, tf-10, tf-15, tf-22)_- [functional] 瞬时错误（网络抖动、依赖 5xx、超时、worker_crash）触发自动重试（指数退避 10s/30s/90s，最多 3 次）；确定性错误（格式不支持、文件损坏）直接落 failed + 原因码，不消耗重试额度；验证方式：对每类错误构造测试用例，断言重试次数与最终状态符合预期 _(证据：sig-022, tf-02, tf-21)_- [functional] 前端分阶段进度条展示当前阶段名 + 已处理 chunk/总 chunk，轮询间隔 ≤5s；用户可明确区分「正常处理中」与「卡住」两种状态；对于无法预估总 chunk 数的格式，进度条展示已完成阶段数/总阶段数作为降级展示 _(证据：sig-023, cf-07, tf-09, tf-20)_- [functional] 自动重试前，系统必须对上一阶段的残留分块/索引数据执行清理（基于稳定 chunk ID 的 upsert 或先删后建）；验证方式：故意在 embedding 阶段中途触发重试，断言重试后向量索引中无重复 chunk 记录 _(证据：tf-02, tf-07, tf-23)_- [functional] 文件大小超过 200MB 时在上传阶段即被拒绝并返回明确错误提示，不创建解析任务；此校验必须在文件完整上传前（客户端预检 + 网关侧 Content-Length 校验）双重保障 _(证据：tf-15, cf-02, sig-001)_- [nonfunctional] 【性能/非功能】心跳超时阈值按文件大小与解析阶段动态配置（≤100MB：extracting 10min/ocr 15min/embedding 5min per 500 chunks；100–200MB：各阶段阈值翻倍），心跳扫描任务频率 ≤60s，扫描期间对批量并发解析的数据库写入压力不超过基线 20% _(证据：tf-01, tf-19, tf-20)_- [nonfunctional] 【可观测性/非功能】解析任务成功率（done/总任务数）在 7 天滚动窗口内 ≥95%（含 80–100MB 大文件场景）；失败任务中至少 90% 携带结构化错误分类，可从日志中按 error_type 聚合查询统计失败分布 _(证据：sig-001, sig-003, cf-02, cf-06, tf-15, tf-22)_- [nonfunctional] 【幂等性/非功能】分块写入使用基于文档 hash + 偏移量的稳定 chunk ID；并发重试同一任务时，通过任务级排他锁（或状态机 CAS）防止两个 worker 同时执行同一阶段写入，避免数据竞争 _(证据：tf-02, tf-07, tf-23, tf-19)_
## 代码影响面地图（按 impact_level 分组）

### CERTAIN
- **rag/svr** ⚠ 核心模块 ｜ 风险 `high` ｜ 影响类型：service, api, config, data_model
  - task_executor 是本次改造的核心载体：需实现 8 阶段状态机流转与持久化、Worker 心跳定期写入（30s 间隔）、结构化异常捕获与 error_type 分类（oom/ocr_timeout/worker_crash/dependency_error 等）、可重试 vs 不可重试判定、指数退避重试调度（10s/30s/90s 最多 3 次）、重试前残留数据清理（先删后建）、进度节流批量写入（500ms/10 chunk）、动态超时阈值按文件大小配置。
  - 验证点：构造 80MB+ PDF 文件验证各阶段状态流转正确且 last_heartbeat_at 持续更新；模拟 worker crash（kill 进程）验证 2× 阶段阈值内被扫描器标记 worker_crash 并触发重试或落 failed；注入 OOM 异常验证 error_type=oom 且 retryable 判定正确；验证指数退避间隔 10s/30s/90s 序列与重试次数上限 3 次后落 failed；验证重试前对上一阶段残留 chunk/索引数据的清理逻辑无重复记录；验证进度写入节流策略在高并发下不会成为瓶颈
- **rag/nlp** ⚠ 核心模块 ｜ 风险 `high` ｜ 影响类型：service, data_model
  - 分词、嵌入、检索打分管线需支持稳定 chunk ID 生成（文档 hash + 偏移量），保证重试 upsert 幂等；embedding 阶段需支持进度回调与批次级超时；embedding 模型调用需捕获依赖服务异常并分类为 dependency_error。
  - 验证点：验证同一文档多次重试后 chunk ID 一致且向量索引无重复；模拟嵌入模型服务 5xx 验证异常被分类为 dependency_error 且 retryable=true；验证 embedding 阶段每 500 chunk 的进度回调被正确上报到状态表
- **deepdoc/parser** ⚠ 核心模块 ｜ 风险 `high` ｜ 影响类型：service
  - extracting 阶段的格式解析器（PDF/DOCX/Excel）需支持进度回调与阶段心跳写入；大文件解析需捕获 OOM 异常并向上层透传 error_type=oom；unsupported_format 需在解析入口校验并分类为不可重试错误。
  - 验证点：构造 100MB+ PDF 触发内存峰值验证 OOM 被捕获并记录 error_type=oom 而非裸 Exception；上传不支持的格式验证 error_type=unsupported_format 且 retryable=false 直接落 failed；验证 extracting 阶段心跳时间戳持续更新
- **api/db** ｜ 风险 `low` ｜ 影响类型：data_model, service
  - 任务状态表需新增字段 current_stage/stage_progress/processed_chunks/total_chunks/last_heartbeat_at/error_type/error_stage/error_message/retryable/retry_count/next_retry_at，编写 Alembic migration 并保证存量数据兼容；Service 层需提供批量任务状态查询、任务级 CAS 排他锁、重试触发接口。
  - 验证点：验证 migration 在空库和有存量数据的库上均可正常执行；验证存量 parsing 状态任务被正确映射到新枚举值或标记为 failed；验证任务状态 CAS 操作在并发重试场景下仅一个请求成功；验证批量查询 API 一次返回多个任务状态减少轮询压力
- **api/apps** ｜ 风险 `low` ｜ 影响类型：api, service
  - 需新增/改造任务状态查询 API（支持批量查询 + ETag/304 缓存）、手动重试 API（CAS 保证幂等）、文件上传 API 增加 Content-Length > 200MB 前置拒绝校验；错误信息透传结构化 error_type/error_stage/error_message/retryable 字段。
  - 验证点：上传 201MB 文件验证网关层直接拒绝返回明确提示；验证任务状态批量查询 API 返回完整的阶段进度和结构化错误信息；验证并发手动重试请求仅一个成功执行；验证 ETag/304 缓存减少无变化时的响应体积
- **web/src** ｜ 风险 `low` ｜ 影响类型：frontend
  - 需实现分阶段进度条组件（展示当前阶段名 + processed_chunks/total_chunks，≤5s 轮询）、降级展示模式（阶段数/总阶段数）、友好化错误文案映射（error_type→用户文案）、手动重试按钮（retryable=true 才展示）、客户端文件大小预检（>200MB 拒绝上传）。
  - 验证点：验证 8 阶段进度条在正常流程下正确依次高亮并显示 chunk 进度；验证流式格式无法预估 chunk 数时降级为「阶段 3/7」展示；验证 ocr_timeout 错误展示友好文案 + 重试按钮，unsupported_format 仅展示原因无重试按钮；验证客户端 >200MB 文件预检即时拒绝上传
- **test** ｜ 风险 `low` ｜ 影响类型：tests
  - 需新增完整测试覆盖：各 error_type 分类的单元测试、状态机流转的集成测试、重试幂等性的端到端测试、心跳超时检测的定时任务测试、前端进度条与错误展示的 E2E 测试、性能测试（10+ 大文件并发解析的写入压力验证）。
  - 验证点：验证每类 error_type（oom/ocr_timeout/unsupported_format/dependency_error/worker_crash/file_corrupted）均有测试用例覆盖；验证重试后向量索引无重复 chunk 的断言测试；验证 10+ 并发大文件解析时数据库写入压力低于基线 20%
### POSSIBLE
- **deepdoc/vision** ｜ 风险 `medium` ｜ 影响类型：service
  - OCR 阶段需支持按批次设置超时（而非整阶段单一超时）、批次级进度回调与心跳更新；某批次超时后重试应跳过已完成批次而非从头重来。
  - 验证点：构造大量图片页 PDF 验证 OCR 按批次超时而非整阶段超时；验证 OCR 批次超时触发重试后跳过已完成批次；验证 OCR 阶段心跳在批次处理期间持续更新
- **rag/app** ｜ 风险 `medium` ｜ 影响类型：service, data_model
  - 分块模板需适配稳定 chunk ID 生成逻辑（文档 hash + 偏移量），确保不同分块策略下 ID 确定且可复现；chunking 阶段需支持进度回调。
  - 验证点：验证不同文档类型（PDF/DOCX/Excel）分块后 chunk ID 基于文档 hash + 偏移量确定；验证同一文档重复解析 chunk ID 不变
- **docker** ｜ 风险 `medium` ｜ 影响类型：config
  - 心跳超时扫描任务依赖 celery beat 或 cron 定时任务调度，需在部署配置中新增扫描任务的定时调度配置（≤60s 频率）及其健康检查/自动重启机制。
  - 验证点：验证 celery beat/cron 配置正确调度心跳扫描任务；验证扫描任务故障后自动重启机制有效
- **rag/llm** ｜ 风险 `medium` ｜ 影响类型：service
  - 嵌入模型适配层需增加依赖服务异常（超时/5xx）的捕获与分类为 dependency_error，并将 retryable=true 标记透传给上层异常处理。
  - 验证点：模拟嵌入模型 API 超时验证异常分类为 dependency_error；验证重排模型/对话模型适配不受本次改造影响
### UNCERTAIN
- **rag/flow** ｜ 风险 `high` ｜ 影响类型：service, config
  - 管线编排层可能需要协调多阶段流转与心跳写入的编排逻辑，但具体改造范围取决于现有编排架构是否已在 task_executor 内完成阶段切换。需确认是否有独立编排入口需要同步改造。
  - 验证点：确认 flow 层是否独立负责阶段编排或仅由 task_executor 直接管理；若需改造则验证编排层的阶段流转与状态持久化一致性
- **rag/graphrag** ｜ 风险 `high` ｜ 影响类型：service, config
  - GraphRAG 场景的自动重试安全性依赖图谱幂等性，本期不在 scope 内但需明确策略：对 GraphRAG 任务禁用自动重试或增加跳过已完成子图的前置检查。具体落点取决于 GraphRAG 任务入口与 task_executor 的关系。
  - 验证点：确认 GraphRAG 任务是否通过 task_executor 调度，若是则验证其被正确排除在自动重试范围外；验证手动重试 GraphRAG 任务时的行为（全量清理重建 or 跳过已完成子图）

**建议改动顺序**：api/db → deepdoc/parser → deepdoc/vision → rag/app → rag/nlp → rag/svr → rag/llm → rag/graphrag → docker → api/apps → web/src → test

## 修改建议

- api/db：新增 11 个字段到任务状态表，字段命名遵循下划线风格与现有约定一致；migration 脚本需同时提供存量数据迁移逻辑（旧 parsing 状态映射或标记 failed），以及完整的 down 回滚脚本。建议分两步迁移：先加字段（允许 NULL），再回填存量数据，降低锁表风险。
- rag/app + rag/nlp：chunk ID 从随机/自增改为「SHA256(文档内容 hash) + 偏移量」拼接方案，确保确定性。需在全部分块模板（PDF/DOCX/Excel 等）中统一此逻辑。建议先在 rag/nlp 中封装 chunk_id 生成函数，各模板调用之。
- rag/svr：将现有单一解析流程拆分为显式的 8 阶段状态机，每阶段入口/出口统一调用状态持久化方法。心跳写入与进度写入应合并为一次批量写操作（减少 DB 往返），节流策略在 task_executor 内部以装饰器或中间件方式实现。异常捕获层建议在每阶段 try-except 外层统一拦截，按异常类型映射到 error_type 枚举。
- rag/svr 重试逻辑：重试调度器与首次执行共用同一阶段编排逻辑，仅在入口处增加「清理上一阶段残留」步骤。CAS 排他锁建议基于任务 ID + 当前阶段的状态机条件更新（UPDATE ... WHERE task_id=? AND current_stage=? AND status IN (allowed_states)）。
- deepdoc/parser：extracting 阶段需在解析入口校验文件格式，不支持格式直接抛出 unsupported_format 异常。大文件解析需在内存密集操作处增加 try-except 捕获 MemoryError/OOM 并转换为 oom 异常类型向上层透传。需在各解析器中埋入进度回调点。
- deepdoc/vision：OCR 改为按批次（batch）循环处理，每批次独立设置超时；批次完成后写入进度与心跳；超时批次在重试时跳过。建议以 batch_id 记录已完成的批次到状态表或独立进度表。
- api/apps：任务状态查询 API 建议支持 list 参数（一次传入多个 task_id），返回结构统一包含 stage/progress/chunks/error 四组字段。文件上传校验建议双保险：客户端 JS 预检 File.size + 服务端读取 Content-Length header，两者任一超限即拒绝。
- web/src：进度条组件建议以阶段数组驱动渲染（7 个处理阶段 + done/failed 终态），每阶段可独立显示完成/进行中/等待三种视觉状态。error_type 到友好文案的映射表建议前端维护一份常量配置，便于后续国际化。轮询建议在任务进入 done/failed 后自动停止。
- docker：新增 celery beat schedule 配置项，心跳扫描任务以独立 queue 隔离避免与解析 worker 抢占资源；扫描任务配置 max_retries 与自身健康检查 endpoint，crash 后由 celery supervisor 自动重启。
- rag/graphrag：建议本期对 GraphRAG 任务设置 retry_enabled=false 配置标志，在重试调度器入口检查该标志跳过自动重试；手动重试时走全量清理重建路径（删除该文档所有图谱节点/边后重新构建），确保数据一致性。

## 任务卡（按 type）

### data
- **task-01** 任务状态表 schema migration 与存量数据兼容 ｜ 风险 `low`
  - 在 api/db 层新增任务状态表字段（current_stage, stage_progress, processed_chunks, total_chunks, last_heartbeat_at, error_type, error_stage, error_message, retryable, retry_count, next_retry_at），编写 Alembic migration 脚本，确保存量数据兼容（旧 parsing 状态映射到新枚举或标记 failed），并编写回滚脚本。
  - 关联模块：api/db
  - 证据：tf-18, tf-22
### backend
- **task-02** 稳定 chunk ID 生成改造（文档 hash + 偏移量） ｜ 风险 `high`
  - 改造 rag/app 分块模板与 rag/nlp 分词管线，使 chunk ID 基于文档 hash + 偏移量确定性生成，保证重试时 upsert 幂等。需验证不同文档类型（PDF/DOCX/Excel）均能产生稳定且唯一的 chunk ID，且同一文档重复解析 ID 不变。
  - 关联模块：rag/app, rag/nlp
  - 证据：tf-02, tf-07, tf-23
- **task-03** 解析状态机与阶段持久化实现 ｜ 风险 `high`
  - 在 rag/svr task_executor 中实现 8 阶段枚举状态机（uploaded→queued→extracting→ocr→chunking→embedding→indexing→done|failed），每阶段切换时持久化阶段名、进度百分比、processed_chunks/total_chunks、last_heartbeat_at 到状态表。实现进度节流批量写入策略（500ms 或 10 chunk 取一）。
  - 关联模块：rag/svr, deepdoc/parser, deepdoc/vision, rag/nlp
  - 证据：tf-16, tf-18, tf-05, tf-20
- **task-04** Worker 心跳机制与超时扫描任务 ｜ 风险 `high`
  - 在 rag/svr task_executor 各阶段实现 30s 间隔心跳写入；实现定时扫描任务（≤60s 频率），检测超过 2× 阶段阈值无心跳的任务并标记 error_type=worker_crash；动态超时阈值按文件大小配置（≤100MB/100-200MB 两档 × 各阶段）；扫描任务自身需健康检查与自动重启。在 docker 中配置 celery beat/cron 调度。
  - 关联模块：rag/svr, docker
  - 证据：tf-01, tf-19
- **task-05** 结构化错误码体系与异常捕获分类 ｜ 风险 `high`
  - 定义 error_type 枚举（oom/ocr_timeout/unsupported_format/dependency_error/worker_crash/file_corrupted）、error_stage、error_message、retryable 字段规范；在 task_executor 异常捕获层按错误类型分类写入；deepdoc/parser 捕获 OOM 并分类为 oom；deepdoc/vision OCR 按批次设置超时并分类 ocr_timeout；rag/llm 捕获嵌入模型异常分类 dependency_error。
  - 关联模块：rag/svr, deepdoc/parser, deepdoc/vision, rag/llm
  - 证据：tf-03, tf-06, tf-10, tf-15, tf-22
- **task-06** 自动重试调度与幂等保证 ｜ 风险 `high`
  - 实现可重试 vs 不可重试错误分类：瞬时错误（网络抖动/依赖 5xx/超时/worker_crash）触发指数退避自动重试（10s/30s/90s 最多 3 次）；确定性错误（unsupported_format/file_corrupted）直接落 failed 不消耗重试额度。重试前基于稳定 chunk ID 执行先删后建清理上一阶段残留数据；通过任务级 CAS 排他锁防止并发重试。
  - 关联模块：rag/svr, rag/nlp, api/db
  - 证据：tf-02, tf-07, tf-21, tf-23
- **task-07** GraphRAG 任务重试策略确认与实现 ｜ 风险 `high`
  - 确认 GraphRAG 任务调度入口与 task_executor 的关系，对 GraphRAG 任务禁用自动重试（仅保留手动重试 + 全量清理重建）或增加跳过已完成子图的前置检查，防止重试产生重复实体节点和关系边。
  - 关联模块：rag/graphrag, rag/svr, rag/flow
  - 证据：tf-07, tf-23
- **task-08** 后端 API：任务状态批量查询、手动重试、文件大小校验 ｜ 风险 `low`
  - api/apps 层新增/改造：任务状态批量查询 API（一次返回多个任务状态，支持 ETag/304 缓存）、手动重试 API（CAS 保证幂等）、文件上传 API 增加 Content-Length > 200MB 前置拒绝校验。错误信息透传结构化 error_type/error_stage/error_message/retryable 字段。
  - 关联模块：api/apps, api/db
  - 证据：tf-09, tf-15, tf-20, cf-02
### frontend
- **task-09** 前端分阶段进度条、错误展示与重试入口 ｜ 风险 `low`
  - web/src 实现：分阶段进度条组件（当前阶段名 + chunk 进度，≤5s 轮询）、降级展示（阶段数/总阶段数）、error_type→友好文案映射、手动重试按钮（retryable=true 才展示）、客户端 >200MB 文件预检。与后端协调进度数据 JSON 结构协议。
  - 关联模块：web/src
  - 证据：tf-09, tf-10, tf-20
### test
- **task-10** 全链路测试：状态机、错误分类、重试幂等、超时检测、性能 ｜ 风险 `high`
  - test/ 目录新增：各 error_type 分类的单元测试、8 阶段状态机流转集成测试、重试幂等性端到端测试（断言重试后无重复 chunk/索引）、心跳超时检测定时任务测试、前端进度条与错误展示 Playwright E2E 测试、10+ 大文件并发解析性能测试（断言 DB 写入压力 < 基线 20%）。
  - 关联模块：test, rag/svr, api/apps, web/src
  - 证据：tf-01, tf-02, tf-19, tf-20
### ops_support
- **task-11** 部署配置：celery beat 调度与监控告警 ｜ 风险 `high`
  - docker 部署配置新增心跳扫描任务的 celery beat/cron 调度（≤60s 频率）；配置扫描任务健康检查与自动重启；配置解析任务成功率与失败分布的可观测告警（7 天滚动窗口 ≥95% 成功率，失败任务 ≥90% 携带结构化错误分类）。
  - 关联模块：docker, rag/svr
  - 证据：tf-01, tf-19
### doc
- **task-12** error_type 枚举规范与 API 协议文档 ｜ 风险 `low`
  - 编写 error_type 枚举规范文档（含每类错误的触发条件、retryable 取值、用户友好文案映射表）、前端进度数据 JSON 结构协议文档、状态机流转图、重试策略说明文档。
  - 关联模块：docs, api/apps, web/src
  - 证据：tf-09, tf-10, tf-22

## Implementation Plan

1. **完成任务状态表 schema 设计与 migration 脚本编写，包含存量数据兼容方案与回滚脚本，与 DBA 评审确认迁移窗口**（模块：api/db）
   - 验证：migration 在测试库空库和有存量数据两种场景下均执行成功；回滚脚本验证可逆；字段定义经 DBA 评审通过
   - 风险：存量正在执行的 parsing 任务需妥善处理，上线前需冻结或标记
2. **实现稳定 chunk ID 生成函数（文档 hash + 偏移量）并集成到各分块模板，验证 ID 确定性与唯一性**（模块：rag/nlp, rag/app）
   - 验证：同一文档重复解析 3 次 chunk ID 完全一致；不同文档 chunk ID 不同；全部分块模板（PDF/DOCX/Excel）均使用统一生成函数
   - 风险：现有 chunk ID 格式变化可能影响向量库存量索引，需评估是否需要全量重建
3. **定义 error_type 枚举规范与结构化错误字段标准，编写映射文档，前后端共同评审确认 JSON 数据结构协议**（模块：docs, api/apps, web/src）
   - 验证：error_type 枚举覆盖 6 种错误类型（含 retryable 取值）；前端友好文案映射表经产品确认；进度数据 JSON 结构经前后端双方签字确认
   - 风险：协议未提前确认可能导致前后端联调阻塞
4. **在 task_executor 中实现 8 阶段状态机流转与阶段级进度持久化，含心跳写入与节流批量写入策略**（模块：rag/svr, deepdoc/parser, deepdoc/vision, rag/nlp）
   - 验证：单文件完整解析流程走完 8 阶段，每阶段切换时状态表字段正确；心跳时间戳每 30s 更新；进度写入频率符合节流策略（500ms/10chunk）
   - 风险：现有单一解析流程拆分为 8 阶段改动量大，需保证解析正确性不受影响
5. **实现结构化异常捕获层，在 task_executor 各阶段 try-exext 外层统一拦截异常并按类型映射 error_type**（模块：rag/svr, deepdoc/parser, deepdoc/vision, rag/llm）
   - 验证：注入 mock 的 OOM/OCR 超时/不支持格式/依赖 5xx/文件损坏异常，分别验证被正确分类为对应 error_type 且 retryable 值正确
   - 风险：异常分类逻辑遗漏边界 case 可能导致裸 Exception 逃逸
6. **实现心跳超时定时扫描任务（≤60s 频率），含动态超时阈值配置与扫描任务健康检查/自动重启**（模块：rag/svr, docker）
   - 验证：模拟 worker crash 后在 2× 阶段阈值内被扫描器检测并标记 worker_crash；扫描任务 crash 后自动重启恢复正常
   - 风险：阈值设置不当可能误杀正常任务，灰度阶段需收集实际处理时长校准
7. **实现自动重试调度（指数退避 10s/30s/90s 最多 3 次）与重试前残留数据清理（先删后建 + 稳定 chunk ID upsert），含 CAS 排他锁**（模块：rag/svr, rag/nlp, api/db）
   - 验证：瞬时错误触发重试且间隔符合 10s/30s/90s；确定性错误直接落 failed 不消耗重试额度；重试后向量索引无重复 chunk；并发重试仅一个成功
   - 风险：残留数据清理不完整导致脏数据；幂等覆盖范围仅限分块/索引
8. **确认并实现 GraphRAG 任务重试策略（禁用自动重试 + 手动重试全量清理重建）**（模块：rag/graphrag, rag/svr, rag/flow）
   - 验证：GraphRAG 任务不触发自动重试；手动重试时图谱节点/边全量清理后重建无重复
   - 风险：GraphRAG 任务入口与 task_executor 的关系需先确认
9. **实现后端 API：任务状态批量查询（ETag/304 缓存）、手动重试端点（CAS 幂等）、文件上传 200MB 前置校验**（模块：api/apps, api/db）
   - 验证：批量查询 API 返回多个任务完整状态；ETag 缓存对无变化返回 304；上传 201MB 文件被拒绝；并发重试请求仅一个成功
   - 风险：API 改动需保证向后兼容，现有前端调用不受影响
10. **实现前端分阶段进度条、降级展示、友好化错误文案映射、手动重试按钮、客户端文件大小预检**（模块：web/src）
   - 验证：进度条正确显示 8 阶段流转与 chunk 进度；降级模式显示阶段数/总阶段数；各 error_type 展示对应友好文案；>200MB 文件客户端即时拒绝；done/failed 后停止轮询
   - 风险：轮询间隔与批量查询优化未做好可能导致 API 并发压力
11. **编写全链路测试：单元测试（错误分类/chunk ID/退避/CAS）、集成测试（状态机/重试幂等/超时检测）、E2E 测试（前端交互）、性能测试（并发写入压力）**（模块：test）
   - 验证：所有 error_type 类型有测试用例覆盖；重试后无重复 chunk 断言通过；10+ 并发大文件 DB 写入压力 < 基线 20%；前端 E2E 进度条与错误展示正确
   - 风险：性能测试环境与生产环境差异可能导致结论偏差
12. **部署配置上线：celery beat 调度配置、监控告警配置、灰度发布（先小流量验证阈值配置与误杀率）**（模块：docker, rag/svr）
   - 验证：灰度阶段 7 天滚动窗口解析成功率 ≥95%；失败任务 ≥90% 携带结构化错误分类；无正常任务被误杀
   - 风险：灰度阶段发现阈值需调整时需快速回滚或热更新配置

## 测试建议

- 【单元测试】为每种 error_type（oom/ocr_timeout/unsupported_format/dependency_error/worker_crash/file_corrupted）构造 mock 异常注入点，断言异常捕获层正确分类并写入结构化错误字段
- 【单元测试】验证稳定 chunk ID 生成函数对同一文档内容多次调用结果一致，对不同文档内容结果不同
- 【单元测试】验证指数退避调度器产出 10s/30s/90s 间隔序列且第 4 次不再重试
- 【单元测试】验证 CAS 排他锁在两个并发线程同时触发重试时仅一个成功
- 【集成测试】构造完整的 8 阶段状态机流转测试，断言每阶段切换时状态表字段正确持久化
- 【集成测试】模拟 worker 在 embedding 阶段中途 crash（kill 进程），验证心跳扫描在 2× 阈值内标记 worker_crash 并触发重试，重试后向量索引无重复 chunk
- 【集成测试】故意在 OCR 阶段某批次注入超时，验证重试时跳过已完成批次仅处理超时批次
- 【集成测试】构造 unsupported_format 和 file_corrupted 场景，验证直接落 failed 且 retry_count 不增加
- 【E2E 测试】Playwright 测试前端进度条在正常流程下依次高亮 8 阶段并显示 chunk 进度；模拟 error_type=ocr_timeout 验证友好文案 + 重试按钮展示；模拟 unsupported_format 验证无重试按钮
- 【E2E 测试】验证客户端选择 >200MB 文件时上传按钮禁用并显示「文件超过 200MB 上限」提示
- 【性能测试】10+ 个 100MB 文件同时上传解析，监控数据库写入 QPS 和 P99 延迟，断言写入压力不超过无解析任务时基线的 20%
- 【性能测试】模拟 50+ 个任务状态并发轮询（5s 间隔），验证批量查询 API + ETag/304 缓存下服务端响应延迟可接受

## Changelog 草稿

```
【解析任务稳定性增强】

新增功能：
- 解析任务现支持 8 阶段可视化进度展示（上传→排队→文本提取→OCR→分块→嵌入→索引→完成），每阶段实时显示已处理进度，大文件解析过程一目了然
- 新增 Worker 心跳超时检测机制，解析任务卡死时系统自动识别并在合理时间内标记失败或自动重试，不再永久卡在「解析中」状态
- 解析失败现展示明确的错误原因（如「OCR 处理超时，建议减少单批次页数」「文件格式不支持」「依赖服务暂时不可用」等），替代原有的笼统「解析失败」提示
- 瞬时错误（网络抖动/服务超时）现支持自动重试（最多 3 次，指数退避），提升大文件解析成功率
- 对于可重试的解析失败，前端提供「手动重试」按钮，用户可一键重新发起解析

优化改进：
- 文件大小上限提升至 200MB，上传时客户端与服务端双重校验，超大文件即时拒绝并给出明确提示
- 无法预估总 chunk 数的文档类型，进度条自动降级为阶段进度展示（如「阶段 3/7：正在嵌入」）
- 分块写入使用稳定 ID 保证重试幂等，避免重复解析产生脏数据

已知限制：
- GraphRAG 场景的自动重试暂不支持（图谱幂等性优化将在后续版本提供），手动重试时将全量清理并重建图谱数据
- 进度推送采用轮询模式（≤5s 间隔），实时推送（SSE/WebSocket）将在后续性能优化版本中提供
```

## 风险与待确认

### 高风险影响项
- rag/svr ⚠ 核心模块（high）：task_executor 是本次改造的核心载体：需实现 8 阶段状态机流转与持久化、Worker 心跳定期写入（30s 间隔）、结构化异常捕获与 error_type 分类（oom/ocr_timeout/worker_crash/dependency_error 等）、可重试 vs 不可重试判定、指数退避重试调度（10s/30s/90s 最多 3 次）、重试前残留数据清理（先删后建）、进度节流批量写入（500ms/10 chunk）、动态超时阈值按文件大小配置。
- rag/nlp ⚠ 核心模块（high）：分词、嵌入、检索打分管线需支持稳定 chunk ID 生成（文档 hash + 偏移量），保证重试 upsert 幂等；embedding 阶段需支持进度回调与批次级超时；embedding 模型调用需捕获依赖服务异常并分类为 dependency_error。
- deepdoc/parser ⚠ 核心模块（high）：extracting 阶段的格式解析器（PDF/DOCX/Excel）需支持进度回调与阶段心跳写入；大文件解析需捕获 OOM 异常并向上层透传 error_type=oom；unsupported_format 需在解析入口校验并分类为不可重试错误。
- rag/flow（high）：管线编排层可能需要协调多阶段流转与心跳写入的编排逻辑，但具体改造范围取决于现有编排架构是否已在 task_executor 内完成阶段切换。需确认是否有独立编排入口需要同步改造。
- rag/graphrag（high）：GraphRAG 场景的自动重试安全性依赖图谱幂等性，本期不在 scope 内但需明确策略：对 GraphRAG 任务禁用自动重试或增加跳过已完成子图的前置检查。具体落点取决于 GraphRAG 任务入口与 task_executor 的关系。

### 需人工确认
- rag/svr（核心模块）：task_executor 是本次改造的核心载体：需实现 8 阶段状态机流转与持久化、Worker 心跳定期写入（30s 间隔）、结构化异常捕获与 error_type 分类（oom/ocr_timeout/worker_crash/dependency_error 等）、可重试 vs 不可重试判定、指数退避重试调度（10s/30s/90s 最多 3 次）、重试前残留数据清理（先删后建）、进度节流批量写入（500ms/10 chunk）、动态超时阈值按文件大小配置。
- rag/nlp（核心模块）：分词、嵌入、检索打分管线需支持稳定 chunk ID 生成（文档 hash + 偏移量），保证重试 upsert 幂等；embedding 阶段需支持进度回调与批次级超时；embedding 模型调用需捕获依赖服务异常并分类为 dependency_error。
- deepdoc/parser（核心模块）：extracting 阶段的格式解析器（PDF/DOCX/Excel）需支持进度回调与阶段心跳写入；大文件解析需捕获 OOM 异常并向上层透传 error_type=oom；unsupported_format 需在解析入口校验并分类为不可重试错误。
- rag/flow（uncertain）：管线编排层可能需要协调多阶段流转与心跳写入的编排逻辑，但具体改造范围取决于现有编排架构是否已在 task_executor 内完成阶段切换。需确认是否有独立编排入口需要同步改造。
- rag/graphrag（uncertain）：GraphRAG 场景的自动重试安全性依赖图谱幂等性，本期不在 scope 内但需明确策略：对 GraphRAG 任务禁用自动重试或增加跳过已完成子图的前置检查。具体落点取决于 GraphRAG 任务入口与 task_executor 的关系。

### Critic 待确认
- 【rag/svr 核心模块】task_executor 是本次改造核心载体：需实现 8 阶段状态机流转与持久化、Worker 心跳定期写入（30s 间隔）、结构化异常捕获与 error_type 分类（oom/ocr_timeout/worker_crash/dependency_error）、可重试 vs 不可重试判定、指数退避重试调度（10s/30s/90s 最多 3 次）、重试前残留数据清理（先删后建）、进度节流批量写入（500ms/10 chunk）、动态超时阈值按文件大小配置。请确认现有 task_executor 架构是否能承载如此大范围的改造，以及是否有足够的测试覆盖。
- 【rag/nlp 核心模块】需支持稳定 chunk ID 生成（文档 hash + 偏移量）保证重试 upsert 幂等；embedding 阶段需支持进度回调与批次级超时；embedding 模型调用需捕获依赖服务异常并分类为 dependency_error。请确认嵌入管线当前是否已有进度回调机制，以及 chunk ID 生成方式的改造对已有索引数据的兼容性影响。
- 【deepdoc/parser 核心模块】extracting 阶段的格式解析器（PDF/DOCX/Excel）需支持进度回调与阶段心跳写入；大文件解析需捕获 OOM 异常并向上层透传 error_type=oom；unsupported_format 需在解析入口校验并分类为不可重试错误。请确认各格式解析器是否能安全捕获 OOM（Python OOM 通常不可恢复），以及进度回调在现有解析架构中的可行性。
- 【rag/flow uncertain】管线编排层可能需要协调多阶段流转与心跳写入的编排逻辑，具体改造范围取决于现有编排架构是否已在 task_executor 内完成阶段切换。请人工确认是否有独立编排入口需要同步改造，避免编排层与状态机层产生不一致。
- 【rag/graphraph uncertain】GraphRAG 场景的自动重试安全性依赖图谱幂等性，本期不在 scope 内但需明确策略：对 GraphRAG 任务禁用自动重试或增加跳过已完成子图的前置检查。请人工确认 GraphRAG 任务入口与 task_executor 的关系，以及禁用自动重试是否会导致 GraphRAG 任务在失败后无法恢复。
- 【待确认-阈值类】AC-41 的 200MB 文件大小上限、AC-42 的动态超时阈值具体数值（extracting 10min/ocr 15min/embedding 5min 等）、AC-43 的 95% 成功率指标均为工程决策，上游证据（全部 mock 来源）未提供历史性能基线或压测数据。请人工确认这些数值是否有线上监控数据或容量规划依据。

### 观察项（证据不足，降权）
- cf-03
- cf-08
- tf-04,tf-08,tf-11~tf-14,tf-17,tf-24~tf-26 (外围技术发现)
