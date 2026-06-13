# glm-5.1 replay 缓存 fixture

主链 `glm-5.1` 跑通一次完整 mock 全链后落的 LLM 缓存（12 次调用），用于**离线复现最高质量的一次 demo**（断网兜底）。

剧情：质量门禁 **61 → 86**（enrich 后 PASS）、`execution.blocked=False`、产出 4 份报告。

## 离线复现（无需 key）

```bash
EVOPM_MODEL=glm-5.1 \
EVOPM_CACHE_DIR=tests/replay_cache_glm51 \   # 若实现了该环境变量；否则在脚本里 monkeypatch llm.CACHE_DIR
evopm run --replay
```

或在脚本里：

```python
from evopm import llm
llm.CACHE_DIR = Path("tests/replay_cache_glm51")
llm.set_run_mode("replay")   # 缓存命中，全程不联网
```

> 默认 CI 的 `test_replay_e2e` 用的是 `tests/replay_cache/`（glm-4.5-air，更快）。本目录是 glm-5.1 的高质量版本，单独保存。
