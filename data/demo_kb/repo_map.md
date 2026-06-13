# RAGFlow 代码地图（repo_map，2026-06 快照）

```text
ragflow/
├── deepdoc/            # 文档深度解析引擎【核心模块】
│   ├── parser/         #   PDF/DOCX/Excel 等格式解析器【核心模块】
│   └── vision/         #   OCR、版面分析、表格结构识别
├── rag/                # RAG 核心管线
│   ├── app/            #   按文档类型的分块(chunking)模板
│   ├── nlp/            #   分词、混合检索打分【核心模块】
│   ├── svr/            #   task_executor 异步解析任务队列【核心模块】
│   ├── llm/            #   嵌入/对话/重排模型适配层
│   ├── flow/ graphrag/ #   管线编排、GraphRAG
│   └── prompts/        #   提示词（含引用注入）
├── api/                # Python 后端服务
│   ├── apps/           #   HTTP 路由：document 上传、kb 管理、chat 问答
│   ├── db/             #   数据模型与 service 层（文档/解析状态）
│   └── ragflow_server.py
├── web/                # React/TS 前端
│   └── src/            #   上传 UI、解析进度展示、引用高亮
├── agent/              # Agent 工作流组件
├── test/               # testcases(API)/unit_test/playwright(E2E)
├── sdk/  mcp/  docker/ docs/
```

## 核心模块

命中以下路径前缀的改动视为高风险，强制人工确认：

- `rag/nlp`
- `deepdoc/parser`
- `rag/svr`
