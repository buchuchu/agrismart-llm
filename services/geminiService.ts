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

const SYSTEM_INSTRUCTION = `
You are AgriSmart, an expert Agricultural Machinery Operations and Maintenance AI Assistant.
Your goal is to assist farmers with machinery selection, operational scheduling, and diagnostic troubleshooting.

**CRITICAL OUTPUT RULES:**
You must provide helpful text responses. ADDITIONALLY, if the user asks for specific complex data, you MUST include a JSON block at the very end of your response strictly following these schemas. Wrap the JSON in \`\`\`json \`\`\`.

1. **Machinery Selection:** If the user provides location, crop, soil, etc., and asks for a recommendation:
   Output JSON with key "machinery":
   {
     "machinery": {
       "type": "Tractor" | "Harvester" | "Seeder",
       "brand": "Brand Name",
       "model": "Model Number",
       "horsepower": "e.g. 300 HP",
       "width": "e.g. 12m working width",
       "suitableFor": "Brief reason why this fits"
     }
   }

2. **Scheduling:** If the user asks for a schedule or dispatch plan:
   Output JSON with key "schedule":
   {
     "schedule": [
       { "id": "1", "taskName": "Plowing", "machine": "Tractor A", "startDate": "2023-10-25", "durationDays": 2, "status": "Pending" },
       ...
     ]
   }

3. **Sensor Diagnostics:** If the user provides vibration/sensor data:
   Analyze the data in text. If the vibration is high (>10mm/s), suggest specific checks (bearings, unbalance). 
   You do not need to output JSON for diagnostics, just clear textual advice.

**Tone:** Professional, practical, and agricultural-focused.
`;

let chatSession: Chat | null = null;

export const initializeChat = () => {
  try {
    chatSession = ai.chats.create({
      model: 'gemini-2.5-flash',
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
    
    // Provide a more specific error message to the user based on the error code
    let errorMessage = "Sorry, I encountered an error connecting to the agricultural database.";
    
    if (error.message?.includes("API key")) {
      errorMessage += " (Error: Invalid or Missing API Key)";
    } else if (error.message?.includes("403")) {
      errorMessage += " (Error: Access Denied/Location not supported)";
    } else if (error.message?.includes("429")) {
      errorMessage += " (Error: Quota Exceeded)";
    } else {
      errorMessage += ` (Details: ${error.message || "Unknown error"})`;
    }
    
    return errorMessage;
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