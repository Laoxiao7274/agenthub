const translations: Record<string, string> = {
// Sidebar
    "nav.projects": "项目",
    "nav.settings": "设置",

    // Projects
    "projects.title": "项目",
    "projects.start": "启动",
    "projects.open": "打开",
    "projects.add": "添加项目",
    "projects.addDesc": "点击添加新项目",
    "projects.name": "项目名",
    "projects.namePlaceholder": "输入项目名称",
    "projects.parentFolder": "父文件夹",
    "projects.parentPlaceholder": "选择父文件夹",
    "projects.selectParent": "选择父文件夹",
    "projects.willCreate": "将创建",
    "projects.creating": "正在创建项目...",
    "projects.creatingDesc": "正在下载技能包并初始化...",
    "projects.initializing": "初始化中...",
    "projects.empty": "暂无项目",

    // Tabs
    "tab.provider": "服务商",
    "tab.mcp": "MCP 服务器",
    "tab.skills": "技能",
    "tab.claudeMd": "CLAUDE.md",
    "tab.permissions": "权限",
    "tab.hooks": "钩子",

    // Provider
    "provider.title": "服务商",
    "provider.service": "服务商",
    "provider.apiKey": "API Key",
    "provider.apiKeyPlaceholder": "输入 {name} API Key",
    "provider.baseUrl": "Base URL",
    "provider.model": "模型",
    "provider.smallModel": "小模型",
    "provider.advisorModel": "审核模型",
    "provider.customModel": "自定义模型...",
    "provider.modelPlaceholder": "provider/model-name",
    "provider.active": "使用中",
    "provider.switch": "切换",
    "provider.addCustom": "添加自定义服务商",
    "provider.cancel": "取消",

    // MCP
    "mcp.title": "MCP 服务器",
    "mcp.add": "添加",
    "mcp.empty": "暂未配置 MCP 服务器",
    "mcp.namePlaceholder": "服务器名称",
    "mcp.command": "命令",
    "mcp.commandPlaceholder": "npx / node / python",
    "mcp.args": "参数",
    "mcp.argsPlaceholder": "-y @mcp/server-filesystem ./src",

    // Skills
    "skills.title": "技能",
    "skills.add": "添加",
    "skills.empty": "暂无自定义技能",
    "skills.namePlaceholder": "技能名称",
    "skills.prompt": "系统提示",
    "skills.promptPlaceholder": "描述此技能的行为...",
    "skills.model": "模型",
    "skills.modelPlaceholder": "留空则使用项目默认模型",
    "skills.tools": "可用工具",

    // CLAUDE.md
    "claudeMd.title": "CLAUDE.md",
    "claudeMd.subtitle": "此文件将写入项目根目录，作为 Claude Code 的系统上下文加载",
    "claudeMd.placeholder": "# 项目规范\n\n- 构建命令: npm run build\n- 测试命令: npm test",

    // Permissions
    "permissions.title": "权限模式",
    "permissions.default": "默认",
    "permissions.defaultDesc": "每次操作都询问用户",
    "permissions.plan": "计划模式",
    "permissions.planDesc": "只读，不执行修改操作",
    "permissions.auto": "自动接受编辑",
    "permissions.autoDesc": "自动允许编辑，Bash 仍需确认",
    "permissions.bypass": "跳过所有权限",
    "permissions.bypassDesc": "跳过所有权限检查（危险）",

    // Hooks
    "hooks.title": "生命周期钩子",
    "hooks.subtitle": "在特定事件触发时执行自定义命令",
    "hooks.preToolUse": "PreToolUse — 工具执行前",
    "hooks.postToolUse": "PostToolUse — 工具执行后",
    "hooks.notification": "Notification — 通知时",
    "hooks.stop": "Stop — Agent 停止时",
    "hooks.placeholder": "例: notify-send 'Agent' '$NOTIFICATION'",

    // Settings
    "settings.title": "设置",
    "settings.general": "通用",
    "settings.language": "语言",
    "settings.theme": "主题",
    "settings.themeLight": "浅色",
    "settings.themeDark": "深色",
    "settings.themeSystem": "跟随系统",
    "settings.autoStart": "开机自启",
    "settings.minimizeToTray": "最小化到托盘",
    "settings.updates": "更新",
    "settings.checkNow": "检查更新",
    "settings.autoUpdate": "自动更新",
    "settings.updateChannel": "更新渠道",
    "settings.channelStable": "稳定版",
    "settings.channelBeta": "测试版",
    "settings.about": "关于",
    "settings.version": "版本",
    "settings.runtime": "运行时",

    // CC Switch Import
    "ccswitch.import": "从 CC Switch 导入",
    "ccswitch.importBtn": "一键导入",
    "ccswitch.title": "从 CC Switch 导入服务商",
    "ccswitch.desc": "检测到 CC Switch 已安装，选择要导入的服务商配置",
    "ccswitch.notFound": "未检测到 CC Switch",
    "ccswitch.notFoundDesc": "请先安装 CC Switch 并配置服务商",
    "ccswitch.loading": "正在读取...",
    "ccswitch.empty": "CC Switch 中暂无服务商配置",
    "ccswitch.current": "当前使用",
    "ccswitch.appType": "类型",
    "ccswitch.selectAll": "全选",
    "ccswitch.deselectAll": "取消全选",
    "ccswitch.imported": "已导入 {count} 个服务商",

    // Agent
    "agent.title": "Agent 类型",
    "agent.select": "选择 Agent",
    "agent.claudeCode": "Claude Code",
    "agent.codex": "Codex",
    "agent.geminiCli": "Gemini CLI",
    "agent.opencode": "OpenCode",
    "agent.hermes": "Hermes",
    "agent.comingSoon": "即将支持",
    "agent.tab": "Agent",
    "agent.saveConfig": "保存配置",

    // Confirm dialog
    "confirm.title": "确认删除",
    "confirm.cancel": "取消",
    "confirm.delete": "删除",
    "confirm.deleteProject": "确定删除项目「{name}」？",
    "confirm.deleteProvider": "确定删除服务商「{name}」？",
    "confirm.deleteMcp": "确定删除 MCP「{name}」？",
    "confirm.deleteSkill": "确定删除技能「{name}」？",
    "confirm.deleteFolder": "同时删除文件夹：{path}",

    // Languages
    "lang.zh-CN": "简体中文",
    "lang.zh-TW": "繁體中文",
    "lang.en": "English",
    "lang.ja": "日本語",
    "lang.ko": "한국어",
}

export default translations
