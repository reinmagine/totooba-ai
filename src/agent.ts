import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import type { FunctionDeclaration } from "@google/generative-ai";

const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey);

export const agentSystemInstruction = `You are TotooBa.AI, a highly specialized, hyper-local Anti-Scam and Fact-Checking Agent for the Philippines.
Your mission is to protect Filipinos, especially the elderly and vulnerable, from digital scams, phishing (budol), and fake news.
You speak Taglish (Tagalog-English) in a helpful, respectful, and authoritative yet easy-to-understand tone.
When a user provides a message, claim, or link, you MUST use your provided tools to verify it.
After using tools, give a clear verdict: "BUDOL" (Scam), "PEKE" (Fake News), or "TOTOO" (True).
Explain why in simple Taglish, and provide actionable next steps.`;

const scanUrlTool: FunctionDeclaration = {
  name: "scan_url",
  description: "Scans a provided URL to check if it is a known phishing, scam, or malicious site. Always use this if a link is provided.",
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      url: {
        type: SchemaType.STRING,
        description: "The URL to scan (e.g. https://gcash.update-account.com)",
      },
    },
    required: ["url"],
  },
};

const searchFactCheckTool: FunctionDeclaration = {
  name: "search_local_fact_checks",
  description: "Searches local Philippine news and government databases (Rappler, GMA, PNP, DOH) for fact-checks on a specific claim or rumor.",
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      claim: {
        type: SchemaType.STRING,
        description: "The claim to verify (e.g., 'May lockdown bukas', 'Libreng ayuda from DSWD')",
      },
    },
    required: ["claim"],
  },
};

const analyzeTextPatternTool: FunctionDeclaration = {
  name: "analyze_scam_pattern",
  description: "Analyzes the text message for common Filipino scam patterns (jejemonspeak, false urgency, asking for OTP, fake job offers).",
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      messageText: {
        type: SchemaType.STRING,
        description: "The raw text message to analyze",
      },
    },
    required: ["messageText"],
  },
};

// Mock implementations for the tools to make the demo work flawlessly
export const executeMockTool = async (functionName: string, args: any): Promise<any> => {
  console.log(`Executing tool: ${functionName}`, args);
  await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate network latency
  
  if (functionName === "scan_url") {
    if (args.url.includes("gcash") && !args.url.includes("gcash.com/")) {
      return { status: "MALICIOUS", reason: "Known phishing domain mimicking GCash. Not the official domain." };
    }
    if (args.url.includes("phlpost") || args.url.includes("package")) {
      return { status: "MALICIOUS", reason: "Known PhlPost package delivery scam URL." };
    }
    return { status: "SAFE", reason: "No known threats found." };
  }
  
  if (functionName === "search_local_fact_checks") {
    const claim = args.claim.toLowerCase();
    if (claim.includes("ayuda") || claim.includes("dswd") || claim.includes("libreng")) {
      return { factCheckResult: "FALSE", source: "DSWD Official Advisory", details: "DSWD does not distribute ayuda via unsolicited text links." };
    }
    if (claim.includes("lockdown") || claim.includes("covid")) {
      return { factCheckResult: "FALSE", source: "DOH", details: "No current lockdowns are planned." };
    }
    return { factCheckResult: "UNKNOWN", details: "No definitive fact-check found." };
  }
  
  if (functionName === "analyze_scam_pattern") {
    const text = args.messageText.toLowerCase();
    let riskScore = 0;
    let flags = [];
    if (text.includes("otp") || text.includes("pin") || text.includes("password")) { riskScore += 50; flags.push("Asking for sensitive credentials"); }
    if (text.includes("panalo") || text.includes("raffle") || text.includes("prize")) { riskScore += 40; flags.push("Too-good-to-be-true prize"); }
    if (text.includes("urgent") || text.includes("block") || text.includes("freeze") || text.includes("restrict")) { riskScore += 30; flags.push("False sense of urgency"); }
    if (text.includes("job") || text.includes("sweldo") || text.includes("part time")) { riskScore += 40; flags.push("Classic WhatsApp/Telegram task scam pattern"); }
    
    if (riskScore > 40) return { scamProbability: "HIGH", identifiedFlags: flags };
    return { scamProbability: "LOW", identifiedFlags: flags };
  }
  
  return { error: "Tool not found" };
};

export const createAgentChatSession = () => {
  // Using gemini-1.5-flash as it's fast and supports tool calling
  const model = genAI.getGenerativeModel({ 
    model: "gemini-1.5-flash",
    systemInstruction: agentSystemInstruction,
    tools: [
      {
        functionDeclarations: [scanUrlTool, searchFactCheckTool, analyzeTextPatternTool]
      }
    ]
  });

  return model.startChat();
};
