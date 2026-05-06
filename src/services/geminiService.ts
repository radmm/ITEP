import { GoogleGenAI, Type } from "@google/genai";
import { Criterion, CriterionType, Bidder, Verdict, EvaluationStatus, CriterionEvaluation } from "../types";

// Safety check for API key to prevent module load crash in non-configured environments
const apiKey = process.env.GEMINI_API_KEY;

// Initialize lazily or with a dummy check to avoid crashing the whole app
let ai: GoogleGenAI | null = null;
if (apiKey && apiKey !== "MY_GEMINI_API_KEY" && apiKey !== "") {
  ai = new GoogleGenAI({ apiKey });
}

export const isAiReady = !!ai;

async function callGeminiWithRetry(params: any, retries = 2): Promise<any> {
  if (!ai) {
    throw new Error("Gemini API key is not configured. Please add GEMINI_API_KEY to your environment variables.");
  }
  
  let lastError;
  for (let i = 0; i < retries; i++) {
    try {
      const response = await ai.models.generateContent({
        model: params.model,
        contents: params.contents,
        config: {
          systemInstruction: params.config?.systemInstruction,
          responseMimeType: params.config?.responseMimeType,
          responseSchema: params.config?.responseSchema
        }
      });

      const text = response.text;
      
      if (!text) {
        throw new Error("Empty response from AI");
      }
      
      // Clean up markdown blocks if the model returned them
      const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
      
      try {
        return JSON.parse(cleanText);
      } catch (parseError) {
        console.error("Failed to parse JSON response:", cleanText);
        throw new Error("AI returned invalid JSON format. Retrying...");
      }
    } catch (error: any) {
      console.warn(`Gemini attempt ${i + 1} failed:`, error.message);
      lastError = error;
      await new Promise(r => setTimeout(r, 1500 * (i + 1)));
    }
  }
  throw lastError;
}

/**
 * Extracts eligibility criteria from one or more tender documents.
 */
export async function extractCriteria(files: { base64: string; mimeType: string }[]): Promise<{ tenderName: string; criteria: Criterion[] }> {
  const model = "gemini-3-flash-preview";
  
  const systemInstruction = `
    You are an expert procurement officer specialized in Indian Government Tenders (CRPF).
    Your task is to analyze the provided tender document(s) and extract all ELIGIBILITY CRITERIA.
    
    Categorize them into: Technical, Financial, Compliance, and Documentation.
    Distinguish between Mandatory and Optional.
    
    For each criterion, provide:
    1. A concise name.
    2. The type.
    3. A clear description of what is required.
    4. Whether it is mandatory.
    5. What specific evidence/value should be looked for (e.g., "GST Number").
  `;

  const fileParts = files.map(f => ({ inlineData: { data: f.base64, mimeType: f.mimeType } }));

  return await callGeminiWithRetry({
    model,
    contents: [
      {
        parts: [
          ...fileParts,
          { text: "Extract the tender name and all eligibility criteria in JSON format from the provided document(s)." }
        ]
      }
    ],
    config: {
      systemInstruction,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        required: ["tenderName", "criteria"],
        properties: {
          tenderName: { type: Type.STRING },
          criteria: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              required: ["id", "name", "type", "description", "isMandatory", "evidenceRequirement"],
              properties: {
                id: { type: Type.STRING },
                name: { type: Type.STRING },
                type: { type: Type.STRING, enum: Object.values(CriterionType) },
                description: { type: Type.STRING },
                isMandatory: { type: Type.BOOLEAN },
                evidenceRequirement: { type: Type.STRING }
              }
            }
          }
        }
      }
    }
  });
}

/**
 * Evaluates a single bidder against the extracted criteria.
 */
export async function evaluateBidder(
  bidderName: string,
  files: { base64: string; mimeType: string; name: string }[],
  criteria: Criterion[]
): Promise<Bidder> {
  const model = "gemini-3-flash-preview";

  const systemInstruction = `
    You are an AI-based Tender Evaluation Specialist. 
    Evaluate bidder "${bidderName}" against these criteria: ${JSON.stringify(criteria)}
    
    For each criterion, provide a confidence score (0-100) based on how clearly the evidence is stated in the documents.
    Also provide an overall confidence score for the entire evaluation.
  `;

  const fileParts = files.map(f => ({ inlineData: { data: f.base64, mimeType: f.mimeType } }));
  
  const parsed = await callGeminiWithRetry({
    model,
    contents: [
      {
        parts: [
          ...fileParts,
          { text: `Evaluate bidder "${bidderName}" and return JSON.` }
        ]
      }
    ],
    config: {
      systemInstruction,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        required: ["status", "overallExplanation", "confidenceScore", "criteriaEvaluations"],
        properties: {
          status: { type: Type.STRING, enum: Object.values(EvaluationStatus) },
          overallExplanation: { type: Type.STRING },
          confidenceScore: { type: Type.NUMBER, description: "Overall confidence score (0-100)" },
          criteriaEvaluations: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              required: ["criterionId", "verdict", "foundValue", "sourceReference", "explanation", "confidenceScore"],
              properties: {
                criterionId: { type: Type.STRING },
                verdict: { type: Type.STRING, enum: Object.values(Verdict) },
                foundValue: { type: Type.STRING },
                sourceReference: { type: Type.STRING },
                explanation: { type: Type.STRING },
                confidenceScore: { type: Type.NUMBER, description: "Confidence score for this specific criterion (0-100)" }
              }
            }
          }
        }
      }
    }
  });

  const evaluationsRecord: Record<string, CriterionEvaluation> = {};
  parsed.criteriaEvaluations.forEach((evalItem: CriterionEvaluation) => {
    evaluationsRecord[evalItem.criterionId] = evalItem;
  });

  return {
    id: Math.random().toString(36).substr(2, 9),
    name: bidderName,
    status: parsed.status,
    overallExplanation: parsed.overallExplanation,
    confidenceScore: parsed.confidenceScore,
    criteriaEvaluations: evaluationsRecord
  };
}
