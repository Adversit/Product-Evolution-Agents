"""报告渲染模块（spec §9）。

把最终 EvoPMState 渲染成 4 份 Markdown 报告 + state.json dump，输出到 runs/<ts>/。
"""

from evopm.report.render import render_reports

__all__ = ["render_reports"]
