# DSH Sisyphus 预设

DeepSeek Harness 智能体预设:**Sisyphus**(编排者)与 **Sisyphus Oracle**(只读顾问),移植自 oh-my-openagent(OMO)的 Sisyphus 工作流。

[English README](README.md)

| 预设 | 角色 | 简介 |
|---|---|---|
| `sisyphus` | 编排者 | 分解任务、并行委派给六条专家子代理车道、验证结果、推动任务完成。 |
| `sisyphus-oracle` | 只读顾问 | 诊断、架构设计、权衡评估、安全/性能审查。绝不修改任何内容。 |

> 本项目是 oh-my-openagent 的 Sisyphus persona 与编排工作流的**衍生作品**,采用 SUL-1.0 许可(见 [LICENSE](LICENSE))。

---

## 目录

- [功能特性](#功能特性)
- [与官方预设对比](#与官方预设对比)
- [与 oh-my-openagent(OMO)对比](#与-oh-my-openagentomo对比)
- [安装](#安装)
- [前置条件](#前置条件)
- [模型策略](#模型策略)
- [Sisyphus(编排者)](#sisyphus编排者)
- [Sisyphus Oracle(只读顾问)](#sisyphus-oracle只读顾问)
- [验证方法](#验证方法)
- [常见问题](#常见问题)
- [许可证](#许可证)

---

## 功能特性

### Sisyphus —— 带六条专家委派车道的编排者

- **意图门(Intent Gate)**:行动前先分类请求(解释/实现/调查/评估/修复/重构);对提问绝不擅自实现。
- **三种模式**:Orchestrate(默认编排)、Advise(问答)、Execute(琐碎单文件工作直接执行)。
- **六条只读、可续接的子代理车道**(支持后台运行、`send_message` 续接、完成通知):

| 车道 | 用途 | toolFilter 白名单要点 |
|---|---|---|
| `subagent_explore` | 内部代码库检索("上下文 grep") | read/glob/grep/lsp/session_* |
| `subagent_oracle` | 硬问题的高 IQ 咨询 | 另含 get_goal/job_list/job_output |
| `subagent_vision` | 图像理解(多模态) | read_image/read/glob/grep |
| `subagent_librarian` | 外部参考检索(文档/开源) | web_search/read/glob/grep |
| `subagent_metis` | 规划前分析:隐藏意图、歧义、AI 失败点 | read/glob/grep/lsp/session_* |
| `subagent_momus` | 对抗式计划评审(PASS / PASS-WITH-FIXES / FAIL) | read/glob/grep/lsp/session_* |

- **规划闭环**:METIS → 计划 → MOMUS → 修订 → 用户批准(小任务跳过)。
- **并行执行纪律**:多角度任务并发 2–5 个后台子代理;绝不重复已委派的搜索。
- **验证循环**:证据落地、lsp 诊断、测试、构建、手动 QA、独立核验委派结果。
- **硬性不变量**:禁止类型错误抑制、禁止空 catch、禁止破坏性 git、禁止伪造引用/验证。
- **分类路由**:`workflow` 工具 + `team-orchestration` skill 的 `category-router.js` 模板,按任务域在运行时把单元路由到不同模型(视觉→多模态、硬逻辑→重推理、琐碎→便宜模型)。

### Sisyphus Oracle —— 只读顾问

- **三层只读强制**:
  1. `restrict.js` 插件——监听 `agent/created`,在 agent 自身作用域调用 `tools.restrict({allow: [...]})`,屏蔽全部继承的全局工具(MCP github/playwright/blender、write/edit、bash/pwsh、schedule、goals、jobs)。
  2. persona 硬约束(绝不编辑、绝不执行副作用命令)。
  3. 宿主审批策略(`ask`)。
- 保留工具:`read`、`read_image`、`glob`、`grep`、`lsp`、`web_search`、`ask_user_question`(+ 无害的 agent 级 `schedule_*`)。
- 模型:跟随用户当前会话模型(见[模型策略](#模型策略))。

---

## 与官方预设对比

DSH 官方自带四个预设。以下是 `sisyphus` / `sisyphus-oracle` 与它们的关系:

| 能力 | standard | code | cordis | minimal | **sisyphus** | **sisyphus-oracle** |
|---|---|---|---|---|---|---|
| Persona | 短 | 短 | 长(两平面) | 固定(`complete: true`) | ~500 行编排协议 | 只读顾问 |
| bash / pwsh | ✅ | ✅ | ✅ | 持久 PTY | ✅ | ✅(restrict.js 屏蔽) |
| fs 读写 | ✅ | ✅ | ✅ | fs-local | ✅ | 只读(restrict.js) |
| str_replace_editor | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ |
| 后台任务 | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ |
| goal | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ |
| 计划模式 | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ |
| 压缩 | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| skills | ✅ | ✅ | ✅ + 编辑技能 | ❌ | ✅ | ❌ |
| 子代理委派 | ✅ | ✅ | ✅ | ❌ | ✅ + **6 条角色车道** | ❌ |
| workflow / ralph | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ |
| run_code(Code Mode) | ❌ | ✅ | ❌ | ❌ | ✅(mode: both) | ❌ |
| tool-cordis(自改运行时) | ❌ | ❌ | ✅ | ❌ | ✅ | ❌ |
| lsp | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| 会话检索 | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| 角色车道(explore/oracle/vision/librarian/metis/momus) | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| 注册表级只读强制 | ❌ | ❌ | ❌ | ❌ | ❌ | ✅(restrict.js) |
| 车道模型集中配置(lane-models.js) | ❌ | ❌ | ❌ | ❌ | ✅ | 不适用 |

**如何选择**:

- **standard** — 日常编码的纯净基线。
- **code** — 与 standard 相同,但通过 `run_code` 批量执行多步操作。
- **cordis** — 想让 agent 自己编写/修改 DSH 预设时(自引用工具集 + 编辑技能)。
- **minimal** — 固定提示词、两个持久工具,确定性优先,无任何 agent 机制。
- **sisyphus** — 需要编排能力时:意图门、六条专家车道、METIS→计划→MOMUS 闭环、并行委派、分类路由。是 standard 的超集,另含 LSP/会话检索/run_code/cordis。
- **sisyphus-oracle** — 需要"零副作用硬保证"的咨询时(注册表级工具屏蔽)。

---

## 与 oh-my-openagent(OMO)对比

`sisyphus` 是 OMO 的 Sisyphus 工作流向 DSH 平台的移植。两者共享编排**哲学**,但**机制**不同:

| 方面 | oh-my-openagent(opencode 插件) | DSH Sisyphus | 说明 |
|---|---|---|---|
| Agent 构建 | 动态(`createSisyphusAgent(model, availableAgents, tools, skills, categories)`——提示词随模型族变化并注入实时环境) | 静态 persona(手写、模型无关) | DSH 预设是声明式文件,无运行时提示词生成 |
| 委派 API | `task()` + `category`(8 类别)+ `subagent_type`(explore/librarian/oracle/metis/momus) | `subagent` 工具 + 6 条固定车道(explore/oracle/vision/librarian/metis/momus) | 角色集相同,载体不同 |
| 动态分类路由 | 原生 `category` 参数调用时选模型 | **workflow** 脚本 `agent(prompt, {provider, model})` 运行时覆盖,`category-router.js` 模板 | DSH 用 workflow 引擎实现等价能力 |
| Metis / Momus | 预规划顾问 + 计划评审(昂贵模型) | ✅ 移植为 `subagent_metis` / `subagent_momus` 车道 | 规划闭环:METIS → 计划 → MOMUS |
| Librarian | 外部参考 agent(GitHub/Context7/Web) | ✅ 移植为 `subagent_librarian` 车道(web_search) | |
| Vision | multimodal-looker | ✅ `subagent_vision` 车道 | |
| 技能注入 | 动态 `availableSkills` 注入 persona | 静态技能引用 + `tool-skill` | persona 写使用规则,非实时目录 |
| 会话延续 | continuation session id | 持久子代理 id + `send_message` | 等价 |
| 并行后台探索 | `run_in_background` + `background_output` | `backgroundMode: continuable` + 完成通知 | 等价 |
| 工作流引擎 | 无原生等价(hyperplan = skill 模拟) | **原生 `workflow` 工具**(JS 编排脚本) | DSH 优势 |
| Ralph 循环 | 无原生等价 | **原生 `ralph` 工具**(自引用循环) | DSH 优势 |
| 自我修改 | 无 | **`tool-cordis`**(inspect/define/run/stop/undefine 活运行时) | DSH 优势 |
| Code Mode | 无 | **`run_code`**(TypeScript SDK 批量执行) | DSH 优势 |
| 只读保证 | 仅 persona | **注册表级**(`restrict.js` 从目录屏蔽工具) | sisyphus-oracle 的 DSH 优势 |
| 许可证 | SUL-1.0 | SUL-1.0(衍生) | 见 LICENSE |

**OMO 有而 DSH Sisyphus 没有的**:

- 按模型族动态生成提示词(OMO 为 kimi/gpt/claude 各烘焙不同提示词)。
- 实时环境注入(persona 直接列出会话真实可用的 agents/tools/skills)。
- `task()` 的原生 `category` 参数(DSH 需要 workflow 脚本实现等价)。

**DSH Sisyphus 有而 OMO 没有的**:

- 原生 `workflow` 引擎、`ralph` 循环、`run_code`、`tool-cordis` 自我修改。
- 注册表级只读强制(restrict.js)。
- 声明式预设文件——复制目录即安装,无需构建步骤。

### 1. 安装预设

将每个预设目录复制到 DSH 用户预设根目录(`$DSH_HOME/.agent-presets/`):

```powershell
# 在本仓库目录下
Copy-Item .\sisyphus        <DSH_HOME>\.agent-presets\sisyphus        -Recurse
Copy-Item .\sisyphus-oracle <DSH_HOME>\.agent-presets\sisyphus-oracle -Recurse
```

预设会以 "Sisyphus" 和 "Sisyphus Oracle" 的名称出现在 Web UI 的预设选择器中。

### 2. 安装 team-orchestration skill(推荐)

`sisyphus` 的 persona 会引用 `team-orchestration` skill 中的工作流模板(hyperplan、安全研究、并行探索、分类路由):

```powershell
Copy-Item .\skills\team-orchestration <DSH_HOME>\skills\team-orchestration -Recurse
```

### 3. 重启 DSH

```powershell
# 使用你惯常的重启方式
scripts\stop-dsh.ps1
scripts\start-dsh.ps1
```

---

## 前置条件

| 要求 | 说明 |
|---|---|
| DSH 版本 | 0.1.0-rc.6(基于此构建;更新的 rc 版本应可工作) |
| 宿主平面服务 | `lsp`(LSP)、`session-query`(会话检索)、`schedule`、`tool-web`(web_search)必须挂载在宿主组合(`cordis.patch.yml`)中。官方 web profile 自带这些。 |
| 插件版本 | profile 插件版本必须与 app 主包版本一致——注意 DSH 官方 AGENTS.md §1 提到的 `latest` tag 陷阱。 |
| 模型 provider | `settings.yaml` → `llm-pi-ai.providers` 中配置的任意 provider(见模型策略)。 |

---

## 模型策略

**两个预设都不固定模型。** 所有子代理车道与 Oracle 预设都继承**父 agent 的模型路由(在会话/agent 创建时快照)**——即会话启动时选择的模型(默认取部署默认值)。这让预设跨部署可移植:没有任何 provider 或模型名被硬编码,在任何 DSH 安装上都能工作,无论配置了哪家 LLM provider。

> ⚠️ **会话中途切换模型不会重路由子代理。** 子代理在委派时继承 `parent.options.model`(已实测:通过 `session.selectModel` 切到更重的模型后,父会话自身请求会切换,但已创建的子代理车道保持创建时的模型)。Oracle 预设的顶层 agent *会*跟随会话切换(其请求解析当前会话模型);它的子代理车道不会。

### 车道路由模型优先级

```
1. lane-models.js 中固定配置的 { provider, model }   ← 显式单车道覆盖(最高)
2. 否则:父 agent 创建时的模型                         ← 默认(会话启动时的模型)
```

### 自定义单车道模型——编辑 `lane-models.js`,无需改 YAML

每条车道的模型从 `sisyphus/lane-models.js`(随预设旅行的纯 JS 模块)解析。`null` = 继承会话模型(默认);`{ provider, model }` = 固定该车道。编辑文件后重启 DSH:

```js
// sisyphus/lane-models.js
module.exports = {
  explore:   null,                                                    // 继承
  oracle:    { provider: 'deepseek-official', model: 'deepseek-v4-pro' },  // 固定示例
  vision:    { provider: 'opencode-go', model: 'mimo-v2.5' },         // read_image 需多模态
  librarian: null,
  metis:     null,
  momus:     null,
};
```

- `provider` 必须是你的 `settings.yaml` → `llm-pi-ai.providers` 中的 key。
- `agent.cordis.yml` 中的六条车道通过 loader 的 `!!js` + `createRequire` 机制读取该文件——你永远不需要编辑 YAML 结构。
- 修改固定配置需要重启 DSH(配置在 preset 挂载时读取)。

> ⚠️ **Vision 车道注意**:`read_image` 仅当路由模型声明支持图像输入时才可用。如果会话模型是纯文本,要么把会话切换到支持图像的模型,要么通过 `lane-models.js` 把 `subagent_vision` 固定为多模态模型。

### 运行时分类路由(workflow)

对于多领域任务,`workflow` 工具的 `agent(prompt, { provider, model })` 支持**运行时模型覆盖**。`team-orchestration` skill 内置 `references/category-router.js` 模板,把每个单元路由到其类别对应的模型:

| category | 模型 |
|---|---|
| `visual-engineering` | mimo-v2.5(多模态) |
| `ultrabrain` / `deep` | deepseek-v4-pro(仅真硬推理) |
| `artistry` / `writing` / `quick` / `unspecified-low` | deepseek-v4-flash |
| `unspecified-high` / 未传 / `inherit` | 当前会话模型 |

---

## Sisyphus(编排者)

- **意图门** — 行动前分类(解释/实现/调查/评估/修复/重构)。
- **三种操作模式** — Orchestrate(默认)、Advise(问答)、Execute(琐碎单文件工作)。
- **六条专家委派车道** — 全部只读、全部可续接(可后台、持久子代理 id、`send_message` 续接、完成通知)。
- **规划闭环** — METIS → 计划 → MOMUS → 修订 → 用户批准(小任务跳过)。
- **并行执行纪律** — 多角度工作并发 2–5 个后台子代理;绝不重复已委派的搜索。
- **验证循环** — 证据落地、lsp 诊断、测试、构建、手动 QA、独立核验委派结果。
- **硬性不变量** — 禁止类型错误抑制、禁止空 catch、禁止破坏性 git、禁止伪造引用/验证、咨询中的子代理未返回前绝不交付最终答案。

## Sisyphus Oracle(只读顾问)

- 只读三层强制:
  1. `restrict.js` 插件——监听 `agent/created`,在 agent 自身作用域调用 `tools.restrict({allow: [...]})`,屏蔽全部继承的全局工具(MCP github/playwright/blender、write/edit、bash/pwsh、schedule、goals、jobs)。
  2. persona 硬约束(绝不编辑、绝不执行副作用命令)。
  3. 宿主审批策略(`ask`)。
- 保留工具:`read`、`read_image`、`glob`、`grep`、`lsp`、`web_search`、`ask_user_question`(+ 无害的 agent 级 `schedule_*`)。
- 模型:跟随当前会话模型(可随时切换)。

---

## 验证方法

```powershell
# 1) 两个预设都能挂载(ok: true)
$body = '{"type":"client-request","rpcId":"t","method":"session.create","payload":{"workspaceId":"<ws-id>","agentPreset":"sisyphus"}}'
Invoke-WebRequest -Uri "http://127.0.0.1:3080/api/session.create" -Method POST -ContentType "application/json" -Body $body -UseBasicParsing
# 用 agentPreset "sisyphus-oracle" 重复一次

# 2) Oracle 会话不暴露任何修改类工具
#    提示词: "List every tool name in your catalog" → 应只显示
#    read/read_image/glob/grep/lsp/web_search/ask_user_question/schedule_*
```

---

## 常见问题

**Q: 我切换会话模型后,为什么子代理还在用旧模型?**
A: 子代理继承的是父 agent 的模型路由,**在会话/agent 创建时快照**(`parent.options.model`)。切换会话模型只影响父会话自身之后的请求。要改车道模型:新开会话、编辑 `lane-models.js`、或在 workflow 的 `agent()` 调用中传 `{provider, model}`。

**Q: 我用的 LLM provider 和示例不同,需要改什么?**
A: 默认(继承)行为下什么都不用改——车道跟随会话模型。只有固定车道时,使用你自己的 `settings.yaml → llm-pi-ai.providers` 中的 provider key。

**Q: Oracle 预设真的绝不修改任何东西吗?**
A: 是的。`restrict.js` 在注册表层面从工具目录中屏蔽 write/edit/bash/pwsh 和全部 MCP 工具,加上 persona 约束与宿主审批策略(`ask`)。已端到端验证:尝试 `write` 的提示词得到"我的可用函数集中不存在该工具"的回复。

**Q: 可以添加自己的车道吗?**
A: 可以。复制 `sisyphus/agent.cordis.yml` 中任意车道块,给它唯一的 `toolName` 和 `id`,在 `lane-models.js` 添加对应条目,(可选)配置 `toolFilter` 白名单。

**Q: 必须安装 `team-orchestration` skill 吗?**
A: 只有使用工作流模板(hyperplan、安全研究、并行探索、分类路由)时才需要。六条子代理车道不依赖它。

---

## 许可证

SUL-1.0(Sustainable Use License v1.0)——oh-my-openagent(© YeonGyu-Kim)的衍生作品,上游同样采用 SUL-1.0。完整条款见 [LICENSE](LICENSE)。

非商业/个人使用免费。商业使用需另行授权。再分发必须保留本声明与原始许可条款。
