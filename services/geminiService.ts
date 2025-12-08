import { GoogleGenAI, Chat } from "@google/genai";
import { MachinerySpec, ScheduleTask } from "../types";

// DEBUG: Log status of API Key (Masked) to help user debug connection issues
const rawKey = process.env.API_KEY;
if (!rawKey) {
  console.error("CRITICAL ERROR: API Key is missing. Please check your Vercel Environment Variables and ensure you have REDEPLOYED after adding the key.");
} else {
  console.log("AgriSmart: API Key is present (" + rawKey.substring(0, 4) + "...)");
}

const ai = new GoogleGenAI({ apiKey: rawKey || "MISSING_KEY" });

// Optimized System Instruction to save tokens (TPM - Tokens Per Minute quota)
const SYSTEM_INSTRUCTION = `You are AgriSmart, an expert Agricultural Machinery Operations AI. Assist with machinery selection, scheduling, and diagnostics.
OUTPUT RULES:
Provide helpful text. For complex data, append a JSON block wrapped in \`\`\`json \`\`\`.

1. Machinery Selection: If recommending machine, output JSON key "machinery":
{"machinery": {"type": "Tractor"|"Harvester"|"Seeder", "brand": "Str", "model": "Str", "horsepower": "Str", "width": "Str", "suitableFor": "Str"}}

2. Scheduling: If planning tasks, output JSON key "schedule":
{"schedule": [{"id": "1", "taskName": "Str", "machine": "Str", "startDate": "YYYY-MM-DD", "durationDays": Num, "status": "Pending"}]}

3. Sensor Diagnostics: If analyzing vibration/sensor data, give clear text advice. No JSON needed.

Tone: Professional, agricultural.`;

let chatSession: Chat | null = null;

export const initializeChat = () => {
  try {
    // Switch to gemini-2.0-flash-exp which often has better availability/quota for free tier users than 2.5-flash
    chatSession = ai.chats.create({
      model: 'gemini-2.0-flash-exp',
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
      },
    });
  } catch (e) {
    console.error("Failed to initialize chat session:", e);
  }
};

export const sendMessageToGemini = async (message: string): Promise<string> => {
  if (!chatSession) {
    initializeChat();
  }
  
  try {
    if (!chatSession) throw new Error("Chat session not initialized - Check API Key");
    
    const result = await chatSession.sendMessage({ message });
    const responseText = result.text;
    return responseText ? responseText : "";
  } catch (error: any) {
    console.error("Gemini API Error Details:", error);
    
    // Parse the error message string (it often comes as a JSON string inside the message)
    const errorString = JSON.stringify(error);
    const errorMessageLower = (error.message || errorString).toLowerCase();
    
    let userMessage = "Sorry, I encountered an error.";

    if (errorMessageLower.includes("429") || errorMessageLower.includes("quota") || errorMessageLower.includes("exhausted")) {
      userMessage = "🛑 **Quota Limit Exceeded (429)**\n\nThe free API limit has been reached. This is common with new keys.\n\n**Try this:**\n1. Wait 1-2 minutes and try again.\n2. Do not send messages too rapidly.";
    } else if (errorMessageLower.includes("api key") || errorMessageLower.includes("400")) {
      userMessage = "⚠️ **API Key Error**\n\nThe API Key is invalid or missing. Please check your Vercel settings.";
    } else if (errorMessageLower.includes("503") || errorMessageLower.includes("overloaded")) {
      userMessage = "🐢 **Server Busy**\n\nThe AI model is currently overloaded. Please try again in a few seconds.";
    } else {
      userMessage = `⚠️ **Connection Error**\n\nUnable to connect to Google Gemini. (Details: ${error.message || "Unknown error"})`;
    }
    
    return userMessage;
  }
};

/**
 * Helper to extract JSON data embedded in the AI's response for the UI to consume.
 */
export const extractDataFromResponse = (text: string): { 
  machinery?: MachinerySpec, 
  schedule?: ScheduleTask[], 
  cleanText: string 
} => {
  const jsonRegex = /```json([\s\S]*?)```/;
  const match = text.match(jsonRegex);

  let machinery: MachinerySpec | undefined;
  let schedule: ScheduleTask[] | undefined;
  let cleanText = text;

  if (match && match[1]) {
    try {
      const parsed = JSON.parse(match[1]);
      if (parsed.machinery) machinery = parsed.machinery;
      if (parsed.schedule) schedule = parsed.schedule;
      
      // Remove the JSON block from the text shown to the user to keep chat clean
      cleanText = text.replace(jsonRegex, '').trim();
    } catch (e) {
      console.warn("Failed to parse JSON from model response", e);
    }
  }

  return { machinery, schedule, cleanText };
};