import { MessageRole, ChatMessage } from "../types";

// CONFIGURATION
// Security: Read from .env file (via process.env provided by Vite)
const API_KEY = process.env.API_KEY || "";
const API_BASE_URL = "https://api.chatanywhere.tech/v1/chat/completions";

// System Instruction optimized for Text-Only Output (Markdown)
const SYSTEM_INSTRUCTION = `你是一个专业的农业机械智能运维助手，名字叫“农机智脑 (AgriSmart)”。
请使用中文（简体）回答所有问题。

**重要规则：**
1. **直接回答**：所有的信息（包括农机推荐、作业排期、诊断建议）都必须直接在对话中展示，不要试图调用外部UI。
2. **格式要求**：
   - **农机推荐**：请使用 Markdown 表格列出参数（品牌、型号、马力、幅宽、适用场景）。
   - **作业排期**：请使用 Markdown 表格列出计划（任务名、农机、开始时间、工期、状态）。
     **必须同时**生成一个 Mermaid 格式的甘特图 (gantt) 代码块，以便直观展示进度。
     
     *Mermaid 示例:*
     \`\`\`mermaid
     gantt
       title 2023年秋季作业计划
       dateFormat YYYY-MM-DD
       axisFormat %m-%d
       section 玉米
       玉米抢收 :active, t1, 2023-10-01, 3d
       section 小麦
       深翻整地 :t2, after t1, 2d
       小麦播种 :t3, after t2, 4d
     \`\`\`
     
   - **故障诊断**：请根据用户提供的以下信息：
     1. 当前工况（如作物类型、环境参数）；
     2. 异常参数（如振动值、负载等超标数据）；
     3. 故障特征（如振动频率、变化趋势）；

     **必须按以下结构回复**：
     - **故障类型**：明确判断可能的故障（如切割刀磨损、输送链卡滞等）；
     - **原因分析**：简要说明故障产生的可能原因；
     - **维修建议**：分点列出具体可操作的维修步骤（专业、实用）。

     回复语言简洁明了，符合农业机械维修场景。

请保持语气专业、乐于助人。不要输出任何用于程序解析的 JSON 代码块。`;

// Local history state
let messageHistory: Array<{ role: string, content: string }> = [];

// Initialize a fresh chat
export const initializeChat = () => {
  messageHistory = [
    { role: "system", content: SYSTEM_INSTRUCTION }
  ];
  console.log("Chat Service Initialized (New Session)");
};

// Restore chat history from App state (for when user clicks history item)
export const restoreChatSession = (history: ChatMessage[]) => {
  // Reset with system prompt
  messageHistory = [{ role: "system", content: SYSTEM_INSTRUCTION }];
  
  // Map UI messages to API messages
  history.forEach(msg => {
    messageHistory.push({
      role: msg.role === MessageRole.USER ? "user" : "assistant",
      content: msg.text
    });
  });
  console.log("Chat Session Restored. Messages:", messageHistory.length);
};

export const sendMessageToGemini = async (message: string): Promise<string> => {
  if (messageHistory.length === 0) initializeChat();
  messageHistory.push({ role: "user", content: message });

  if (!API_KEY) {
    return "配置错误：未找到 API_KEY。请在 .env 文件中配置您的密钥。";
  }

  try {
    const response = await fetch(API_BASE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-3.5-turbo",
        messages: messageHistory,
        temperature: 0.7,
        stream: false
      })
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }

    const data = await response.json();
    const botContent = data.choices?.[0]?.message?.content || "";

    messageHistory.push({ role: "assistant", content: botContent });
    return botContent;

  } catch (error: any) {
    console.error("Service Connection Failed:", error);
    return getFallbackResponse(message);
  }
};

/**
 * OFFLINE / FALLBACK MODE
 */
const getFallbackResponse = (query: string): string => {
  const lower = query.toLowerCase();
  
  if (lower.includes("排期") || lower.includes("计划")) {
    return `**(离线模式)** 网络连接失败。这里是一个示例排期表：

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

  if (lower.includes("推荐") || lower.includes("拖拉机")) {
    return `**(离线模式)** 网络连接失败。为您推荐以下机型：

| 品牌 | 型号 | 马力 | 幅宽 | 适用场景 |
| :--- | :--- | :--- | :--- | :--- |
| 芬特 (Fendt) | 1050 Vario | 517 HP | N/A | 适合大面积重负荷深翻作业 |
| 凯斯 (Case IH) | Magnum 400 | 396 HP | N/A | 适合牵引重型播种机 |
    `;
  }

  return `抱歉，无法连接到服务器。请检查网络或 API Key 设置。`;
};