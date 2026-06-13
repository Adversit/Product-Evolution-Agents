"""EvoPM CLI（WT-6 / T6.2，spec §8）。

typer 应用 ``app``（pyproject 已映射 ``evopm = "evopm.cli:app"``）。

命令：
- ``evopm run [--mock|--replay|--model|--data]``：在 run 入口调 ``llm.reset_budget()`` 与
  ``llm.set_run_mode(...)``，编译并驱动 LangGraph stream 循环，捕获 ``__interrupt__`` →
  hitl 渲染/解析（或 replay 自动应答）→ ``Command(resume=...)`` 续跑；逐节点打印进度
  ``[节点名] Agent名 → 一行结论摘要（耗时 x.xs）``；结束打印 4 份报告路径 + 漏斗统计。
- ``evopm init``：交互式问答生成 ``data/<name>/product.yaml``（可被 ``config.load_product_context`` 解析）。

**graph.py 属 WT-7**：本模块在 ``run`` 命令体内**惰性导入** ``build_graph``，未集成时给出可读提示，
保证 ``import evopm.cli`` 与 ``evopm --help`` 在 graph.py 不存在时也不报错。
"""

from __future__ import annotations

import time
from pathlib import Path
from typing import Optional

import typer
import yaml
from rich.console import Console

from evopm import hitl, llm

app = typer.Typer(
    add_completion=False,
    help="EvoPM Agent — 多智能体产品需求决策系统（黑客松 Demo）。",
)
_console = Console()

# 节点 → 展示用 Agent 名（spec §3.2 / §4），用于进度打印第二段。
_NODE_AGENT: dict[str, str] = {
    "intake": "IntakeAgent",
    "discovery": "DiscoveryAgent",
    "select_cluster": "—",
    "competitor_research": "ResearchAgent(竞品)",
    "tech_research": "ResearchAgent(技术)",
    "quality_gate": "RequirementAgent.draft",
    "enrich": "RequirementAgent.enrich",
    "clarify_human": "—",
    "opportunity": "StrategyAgent.score",
    "solution_design": "StrategyAgent.design",
    "engineering": "EngineeringAgent",
    "critic": "CriticAgent",
    "human_review": "—",
    "report": "ReportRenderer",
}

# 图调用必传配置（spec §3.2 / §11.1）。
_RUN_CONFIG = {
    "recursion_limit": 50,
    "configurable": {"thread_id": "evopm-demo"},
}


# --------------------------------------------------------------------------- #
# run
# --------------------------------------------------------------------------- #
@app.command()
def run(
    mock: bool = typer.Option(
        False, "--mock", help="跳过 GitHub API 与 web_search，全用本地材料。"
    ),
    replay: bool = typer.Option(
        False, "--replay", help="LLM 全走缓存（离线演示）；interrupt 自动应答。"
    ),
    model: Optional[str] = typer.Option(
        None, "--model", help="覆盖模型，如 glm-4.7-flash。"
    ),
    data: str = typer.Option(
        "data/demo_kb", "--data", help="产品上下文数据目录。"
    ),
) -> None:
    """运行全链：mock/replay/live 三模式。"""
    run_mode = "replay" if replay else ("mock" if mock else "live")

    # run 入口：归零预算 + 注入 run_mode（spec §6 / §11.1）。
    llm.reset_budget()
    llm.set_run_mode(run_mode)

    _console.print(
        f"[bold]EvoPM run[/bold] mode=[cyan]{run_mode}[/cyan] "
        f"model=[cyan]{model or '(env EVOPM_MODEL)'}[/cyan] data=[cyan]{data}[/cyan]"
    )

    # graph.py 属 WT-7：惰性导入，未集成时可读降级，不让 import 失败。
    try:
        from evopm.graph import build_graph
    except ImportError as exc:
        _console.print(
            "[yellow]graph 尚未集成（WT-7 的 evopm.graph.build_graph 不可用）。"
            f"\n  详情：{exc}\n  请先合入 graph.py 后再运行全链。[/yellow]"
        )
        raise typer.Exit(code=1)

    initial_state = _load_initial_state(data, run_mode)
    graph = build_graph()

    try:
        _drive(graph, initial_state, run_mode)
    except llm.LLMBudgetExceeded as exc:
        # 顶层捕获预算耗尽：合同要求带半成品进 report，但 report 编排在图内，
        # 此处给出可读提示（图若已自行兜底则不会到这里）。
        _console.print(f"[red]LLM 调用预算耗尽：{exc}[/red]")
        raise typer.Exit(code=1)
    except llm.LLMCallFailed as exc:
        _console.print(
            f"[red]LLM 结构化调用失败：{exc}\n  可尝试 `evopm run --replay` 走缓存。[/red]"
        )
        raise typer.Exit(code=1)


def _load_initial_state(data: str, run_mode: str) -> dict:
    """从 data 目录组装图初始 state（输入字段，下游产物留空）。"""
    from evopm import config

    base = Path(data)
    pc = config.load_product_context(base / "product.yaml")
    existing = config.load_existing_requirements(base / "existing_requirements.md")
    repo_map = config.load_repo_map(base / pc.repo_map_path.split("/")[-1]) \
        if (base / Path(pc.repo_map_path).name).exists() \
        else config.load_repo_map(pc.repo_map_path)
    return {
        "product_context": pc,
        "existing_requirements": existing,
        "repo_map": repo_map,
        "run_mode": run_mode,
    }


def _summarize_node(node: str, value: object) -> str:
    """从节点输出 state 片段提取一行结论摘要（评委可读）。"""
    if not isinstance(value, dict):
        return ""
    if "signals" in value:
        return f"标注 {len(value['signals'])} 条信号"
    if "clusters" in value:
        return f"聚出 {len(value['clusters'])} 个问题簇"
    if "selected_cluster_id" in value:
        return f"选定焦点簇 {value['selected_cluster_id']}"
    if "competitor_findings" in value:
        return f"竞品发现 {len(value['competitor_findings'])} 条"
    if "tech_findings" in value:
        return f"技术发现 {len(value['tech_findings'])} 条"
    if "focus_candidate" in value:
        fc = value["focus_candidate"]
        q = getattr(fc, "quality", None)
        if q is not None:
            return f"质量评分 total={q.total} gate={q.gate.value}"
        return "生成需求候选"
    if "opportunity" in value:
        op = value["opportunity"]
        pr = getattr(op, "priority", None)
        return f"机会评分 优先级={getattr(pr, 'value', pr)}"
    if "solution" in value:
        return "生成方案规格"
    if "execution" in value:
        ex = value["execution"]
        return f"研发提案（blocked={getattr(ex, 'blocked', '?')}）"
    if "critic_review" in value:
        cr = value["critic_review"]
        return f"对抗审查 {len(getattr(cr, 'findings', []))} 条发现"
    if "report_paths" in value:
        return f"生成 {len(value['report_paths'])} 份报告"
    return ""


def _drive(graph, initial_state: dict, run_mode: str) -> None:
    """驱动 stream 循环：逐节点进度打印 + interrupt 处理 + resume 续跑。"""
    from langgraph.types import Command

    pending: object = initial_state
    final_state: dict = {}
    node_start = time.perf_counter()

    while True:
        interrupted = False
        for chunk in graph.stream(pending, config=_RUN_CONFIG):
            # interrupt：chunk 形如 {"__interrupt__": (Interrupt(value=payload), ...)}
            if "__interrupt__" in chunk:
                payload = _extract_interrupt_payload(chunk["__interrupt__"])
                resume_value = (
                    hitl.auto_resume(payload)
                    if run_mode == "replay"
                    else hitl.handle_interrupt(payload)
                )
                pending = Command(resume=resume_value)
                interrupted = True
                break

            # 普通节点输出：{node_name: state_delta}
            for node, value in chunk.items():
                elapsed = time.perf_counter() - node_start
                node_start = time.perf_counter()
                agent = _NODE_AGENT.get(node, "—")
                summary = _summarize_node(node, value)
                _console.print(
                    f"[bold cyan]\\[{node}][/bold cyan] {agent} → "
                    f"{summary}（耗时 {elapsed:.1f}s）"
                )
                if isinstance(value, dict):
                    final_state.update(value)

        if not interrupted:
            break

    _print_funnel(graph, final_state)


def _extract_interrupt_payload(interrupt_obj: object) -> dict:
    """从 stream 的 __interrupt__ 条目取出 payload dict。

    LangGraph 把它包成 tuple[Interrupt, ...]，Interrupt.value 即节点 interrupt(payload) 的实参。
    """
    item = interrupt_obj[0] if isinstance(interrupt_obj, (tuple, list)) else interrupt_obj
    payload = getattr(item, "value", item)
    if not isinstance(payload, dict):
        raise ValueError(f"interrupt payload 非 dict：{payload!r}")
    return payload


def _print_funnel(graph, final_state: dict) -> None:
    """结束打印 4 份报告路径 + 漏斗统计（spec §8）。"""
    # 优先用最终 checkpoint 的完整 state 补全（stream delta 可能不全）。
    try:
        snapshot = graph.get_state(_RUN_CONFIG)
        if snapshot is not None and getattr(snapshot, "values", None):
            merged = dict(snapshot.values)
            merged.update(final_state)
            final_state = merged
    except Exception:
        pass

    signals = final_state.get("signals", []) or []
    clusters = final_state.get("clusters", []) or []
    n_signals = len(signals)
    n_filtered = sum(
        1
        for s in signals
        if str(getattr(s, "actionability", "")) in
        ("Actionability.EMOTIONAL", "Actionability.SUSPECTED_MISUSE",
         "Actionability.INSUFFICIENT", "emotional", "suspected_misuse", "insufficient")
        or getattr(getattr(s, "actionability", None), "value", None)
        in ("emotional", "suspected_misuse", "insufficient")
    )
    k_clusters = len(clusters)
    opp = final_state.get("opportunity")
    p_top = getattr(getattr(opp, "priority", None), "value", "—") if opp else "—"

    _console.print(
        f"\n[bold]漏斗统计：[/bold] {n_signals} 条信号 → {n_filtered} 过滤 → "
        f"{k_clusters} 簇 → 1 深挖 → {p_top}"
    )

    paths = final_state.get("report_paths", []) or []
    if paths:
        _console.print("[bold]报告：[/bold]")
        for p in paths:
            _console.print(f"  • {p}")
    else:
        _console.print("[yellow]未产出报告路径（report 节点未写 report_paths）。[/yellow]")

    used = llm.get_budget_used()
    _console.print(f"[dim]LLM 真实调用次数：{used}[/dim]")


# --------------------------------------------------------------------------- #
# init
# --------------------------------------------------------------------------- #
@app.command()
def init(
    out_dir: str = typer.Option(
        "data", "--out", help="生成 product.yaml 的父目录（实际写入 <out>/<name>/）。"
    ),
) -> None:
    """交互式问答生成 data/<name>/product.yaml（可被 config.load_product_context 解析）。"""
    _console.print("[bold]EvoPM init[/bold] — 交互式生成 product.yaml\n")

    name = typer.prompt("产品名称", default="RAGFlow")
    description = typer.prompt("一句话描述", default="基于深度文档理解的开源 RAG 引擎")
    target_users = _prompt_list("目标用户（逗号分隔）", "企业知识库团队,开发者")
    module = typer.prompt("被分析模块", default="文件上传与问答质量")
    stage = typer.prompt(
        "产品阶段 [mvp/growth/commercial/mature/oss_commercial]", default="growth"
    )
    analysis_goals = _prompt_list(
        "分析目标（逗号分隔）", "发现高频问题,竞品对标,需求质量评估,代码影响分析,生成路线图"
    )
    team_preference = typer.prompt(
        "团队偏好 [快速修复/提升体验/增强商业化/降低维护成本/提升架构质量]",
        default="提升体验",
    )
    github_repo = typer.prompt("GitHub 仓库", default="infiniflow/ragflow")
    tech_topics = _prompt_list(
        "技术主题（逗号分隔）", "RAG 检索质量,文档解析,上传状态机,失败重试,引用溯源"
    )
    core_modules = _prompt_list("核心模块前缀（逗号分隔）", "rag/nlp,deepdoc/parser,rag/svr")

    competitors = []
    _console.print("\n输入竞品（名称留空结束）：")
    while True:
        cname = typer.prompt("  竞品名称", default="").strip()
        if not cname:
            break
        homepage = typer.prompt("  主页 URL", default="").strip()
        mock_file = typer.prompt("  兜底材料文件名（competitors/ 下）", default="").strip()
        competitors.append(
            {"name": cname, "homepage": homepage, "mock_file": mock_file}
        )

    product = {
        "name": name,
        "description": description,
        "target_users": target_users,
        "module": module,
        "stage": stage,
        "analysis_goals": analysis_goals,
        "team_preference": team_preference,
        "github_repo": github_repo,
        "competitors": competitors,
        "tech_topics": tech_topics,
        "core_modules": core_modules,
    }

    target = Path(out_dir) / name / "product.yaml"
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(
        yaml.safe_dump(product, allow_unicode=True, sort_keys=False),
        encoding="utf-8",
    )
    _console.print(f"\n[green]已生成：{target}[/green]")


def _prompt_list(label: str, default: str) -> list[str]:
    raw = typer.prompt(label, default=default)
    return [x.strip() for x in raw.split(",") if x.strip()]


# 无参 `evopm` = run --data data/demo_kb（spec §8）。
@app.callback(invoke_without_command=True)
def _default(ctx: typer.Context) -> None:
    if ctx.invoked_subcommand is None:
        run()


if __name__ == "__main__":
    app()
