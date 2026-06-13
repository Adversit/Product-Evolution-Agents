# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 仓库状态

本仓库（Product-Evolution-Agents）目前处于初始阶段，尚无代码。远程仓库：https://github.com/Adversit/Product-Evolution-Agents.git（origin），主分支为 `main`。

## 版本管理（必须遵守）

后续所有开发必须使用 git 进行版本管理：

- 每完成一个独立的功能、修复或文档变更，及时 `git add` + `git commit`，不要积累大量未提交的改动。
- Commit message 使用简洁的祈使句描述改动内容；一次 commit 只做一件事。
- 推送到远程：`git push -u origin main`（首次），之后 `git push`。
- 涉及实验性或大型改动时，先创建分支开发，完成后再合并回 `main`。
- 删除、重构等破坏性操作前，确认当前工作区是干净的（`git status`），以便随时回退。

## 待补充

项目代码与构建/测试命令尚未建立。引入技术栈后，请在此文件补充：构建、lint、测试命令，以及项目架构说明。
