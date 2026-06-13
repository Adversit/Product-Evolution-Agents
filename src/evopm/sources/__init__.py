"""外部数据源（spec §7）。

``github.fetch_issues`` 拉取 RAGFlow issues；失败抛 ``GithubUnavailable``，
intake 节点捕获后降级读 ``issues_mock.json``。
"""

from evopm.sources.github import GithubUnavailable, fetch_issues

__all__ = ["GithubUnavailable", "fetch_issues"]
