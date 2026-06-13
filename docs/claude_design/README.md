# Claude Design 上传包

为前端做 Claude Design 视觉初稿。**两套界面 = 两次独立 design session**，各对应一个子文件夹；每个文件夹里是该 session 要**一次性全部上传**的文件。

| 文件夹 | 界面 | 何时用 |
|---|---|---|
| `product/` | 产品级决策网页（重审美/可信/决策导向） | 给 PM/团队/评委看结论的成品界面 |
| `demo/` | 过程演示 / 流水线透视台（酷炫但过程清晰、便于定位问题） | 现场演示多智能体执行过程 + 排障 |

用法：进对应文件夹看 `UPLOAD.md` → 把该文件夹全部文件上传 Claude Design → 粘贴 `design_handoff_*.md` 里的 Kickoff Prompt → 先做 Hero 屏再迭代。

> 更完整的背景：仓库 `docs/frontend_api.md`（接口契约）、`docs/frontend_product_ui.md` / `docs/frontend_demo_ui.md`（完整需求）、`docs/sample_reports/`（glm-5.1 真实报告）。
