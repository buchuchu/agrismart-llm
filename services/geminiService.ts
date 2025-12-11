import { MessageRole, ChatMessage } from "../types";

// CONFIGURATION
// Security: Read from .env file (via process.env provided by Vite)
const API_KEY = process.env.API_KEY || "";
// 您的 OpenAI 代理地址 (ChatAnywhere)
const API_BASE_URL = "https://api.chatanywhere.tech/v1/chat/completions";

// 核心系统提示词：这里定义了三个功能的具体行为
const SYSTEM_INSTRUCTION = `你是一个专业的农业机械智能运维助手，名字叫“农机智脑 (AgriSmart)”。
你拥有三个核心功能模块，请根据用户的当前上下文进行回答。

1. **农机运营 (选型)**：
   - 根据用户提供的地点、作物、面积、预算等，推荐最合适的农机品牌与型号。
   - 输出格式：请使用 Markdown 表格列出推荐机型参数（品牌、型号、马力、幅宽、参考价格、适用场景）。

2. **作业调度 (排期)**：
   - 解决多地块、多农机的调度优化问题。
   - 输出格式：必须输出一个 Markdown 表格列出具体计划。
   - **关键要求**：必须在回复中包含一个 Mermaid 格式的甘特图 (gantt) 代码块，用于直观展示时间轴。
     *Mermaid 示例:*
     \`\`\`mermaid
     gantt
       title 作业进度表
       dateFormat YYYY-MM-DD
       axisFormat %m-%d
       section 地块A
       收割作业 :active, t1, 2023-10-01, 3d
       section 地块B
       收割作业 :t2, after t1, 2d
     \`\`\`

3. **故障诊断 (维修)**：
   - 分析工况、振动数据或用户描述的异响/故障现象。
   - 输出格式：
     - **故障判断**：明确指出可能性最大的故障点。
     - **原因分析**：解释物理/机械原因。
     - **维修方案**：分步骤列出排查和维修方法。

**通用规则：**
- 使用中文（简体）。
- 语气专业、严谨、乐于助人。
- 不要输出 JSON 代码块，直接输出 Markdown 渲染文本。
`;

// 本地维护的消息历史记录 (OpenAI 格式)
let messageHistory: Array<{ role: string, content: string }> = [];

// 初始化聊天：设置系统提示词
export const initializeChat = () => {
  messageHistory = [
    { role: "system", content: SYSTEM_INSTRUCTION }
  ];
  console.log("Chat Service Initialized (New Session via OpenAI/ChatAnywhere)");
};

// 恢复聊天记录：将 UI 的消息格式转换为 OpenAI 的消息格式
export const restoreChatSession = (history: ChatMessage[]) => {
  // 重置并带上系统提示词
  messageHistory = [{ role: "system", content: SYSTEM_INSTRUCTION }];
  
  // 填充历史
  history.forEach(msg => {
    messageHistory.push({
      role: msg.role === MessageRole.USER ? "user" : "assistant",
      content: msg.text
    });
  });
  console.log("Chat Session Restored. Messages:", messageHistory.length);
};

// 发送消息
export const sendMessageToGemini = async (message: string): Promise<string> => {
  // 如果历史为空（虽然 App.tsx 会调用 initialize，但做个兜底）
  if (messageHistory.length === 0) initializeChat();
  
  // 将用户消息加入历史
  messageHistory.push({ role: "user", content: message });

  if (!API_KEY) {
    return getFallbackResponse(message);
  }

  try {
    const response = await fetch(API_BASE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-3.5-turbo", // 或者 gpt-4
        messages: messageHistory,
        temperature: 0.7,
        stream: false
      })
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error("API Error Detail:", errorData);
      throw new Error(`API Error: ${response.status}`);
    }

    const data = await response.json();
    const botContent = data.choices?.[0]?.message?.content || "";

    // 将 AI 回复加入历史，保持上下文
    messageHistory.push({ role: "assistant", content: botContent });
    return botContent;

  } catch (error: any) {
    console.error("Service Connection Failed:", error);
    return "连接服务器失败，请检查您的 API Key 是否正确，或网络是否通畅。";
  }
};

/**
 * 离线/演示模式 (当没有 API Key 时触发)
 */
const getFallbackResponse = (query: string): string => {
  const lower = query.toLowerCase();
  
  if (lower.includes("排期") || lower.includes("计划") || lower.includes("调度")) {
    return `**(演示模式 - 未配置 Key)** 网络连接失败。这里是一个示例排期表：

| 任务名称 | 农机型号 | 开始日期 | 工期 | 状态 |
| :--- | :--- | :--- | :--- | :--- |
| 玉米抢收 | 约翰迪尔 8R | 2023-10-01 | 3天 | 进行中 |
| 小麦播种 | 雷肯播种机 | 2023-10-05 | 4天 | 待定 |

\`\`\`mermaid
gantt
  title 离线示例排期
  dateFormat YYYY-MM-DD
  axisFormat %m-%d
  section 抢收
  玉米抢收 :active, t1, 2023-10-01, 3d
  section 播种
  小麦播种 :t2, after t1, 4d
\`\`\`
    `;
  }

  if (lower.includes("推荐") || lower.includes("选型") || lower.includes("买")) {
    return `**(演示模式 - 未配置 Key)** 网络连接失败。为您推荐以下机型：

| 品牌 | 型号 | 马力 | 幅宽 | 适用场景 |
| :--- | :--- | :--- | :--- | :--- |
| 芬特 (Fendt) | 1050 Vario | 517 HP | N/A | 适合大面积重负荷深翻作业 |
| 凯斯 (Case IH) | Magnum 400 | 396 HP | N/A | 适合牵引重型播种机 |
    `;
  }

  return `抱歉，无法连接到服务器。请检查网络或 API Key 设置。`;
};