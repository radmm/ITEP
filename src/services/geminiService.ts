import { GoogleGenAI, Type } from "@google/genai";
import { Criterion, CriterionType, Bidder, Verdict, EvaluationStatus, CriterionEvaluation } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

/**
 * Extracts eligibility criteria from a tender document.
 */
export async function extractCriteria(fileBase64: string, mimeType: string): Promise<{ tenderName: string; criteria: Criterion[] }> {
  const model = "gemini-3.1-pro-preview";
  
  const systemInstruction = `
    You are an expert procurement officer specialized in Indian Government Tenders (CRPF).
    Your task is to analyze a tender document and extract all ELIGIBILITY CRITERIA.
    
    Categorize them into: Technical, Financial, Compliance, and Documentation.
    Distinguish between Mandatory and Optional based on the language (e.g., "must", "shall", "mandatory" vs "desirable", "optional").
    
    For each criterion, provide:
    1. A concise name.
    2. The type.
    3. A clear description of what is required.
    4. Whether it is mandatory.
    5. What specific evidence/value should be looked for (e.g., "GST Number", "Turnover amount", "ISO Certificate date").
  `;

  const response = await ai.models.generateContent({
    model,
    contents: [
      {
        parts: [
          { inlineData: { data: fileBase64, mimeType } },
          { text: "Extract the tender name and all eligibility criteria in JSON format." }
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

  return JSON.parse(response.text!);
}

/**
 * Evaluates a single bidder against the extracted criteria.
 */
export async function evaluateBidder(
  bidderName: string,
  files: { base64: string; mimeType: string; name: string }[],
  criteria: Criterion[]
): Promise<Bidder> {
  const model = "gemini-3.1-pro-preview";

  const systemInstruction = `
    You are an AI-based Tender Evaluation Specialist. 
    You are given a list of eligibility criteria and several documents from a bidder named "${bidderName}".
    
    Your goal is to evaluate the bidder against EACH criterion.
    
    Strict rules:
    1. Explainability: Every verdict must reference the document name and the specific value/evidence found.
    2. Auditability: If you find evidence, quote it or describe exactly where it is.
    3. Honesty/Ambiguity: If a document is a scan and you can't read a value clearly, or if information is missing, mark as "Ambiguous" and state the reason. NEVER silently disqualify.
    4. Verdicts: "Pass", "Fail", or "Ambiguous".
    
    The output must define an overall status and a per-criterion breakdown.
  `;

  const criteriaText = JSON.stringify(criteria, null, 2);
  const fileParts = files.map(f => ({ inlineData: { data: f.base64, mimeType: f.mimeType } }));
  
  const response = await ai.models.generateContent({
    model,
    contents: [
      {
        parts: [
          ...fileParts,
          { text: `Evaluate bidder "${bidderName}" against these criteria:\n\n${criteriaText}` }
        ]
      }
    ],
    config: {
      systemInstruction,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        required: ["status", "overallExplanation", "criteriaEvaluations"],
        properties: {
          status: { type: Type.STRING, enum: Object.values(EvaluationStatus) },
          overallExplanation: { type: Type.STRING },
          criteriaEvaluations: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              required: ["criterionId", "verdict", "foundValue", "sourceReference", "explanation"],
              properties: {
                criterionId: { type: Type.STRING },
                verdict: { type: Type.STRING, enum: Object.values(Verdict) },
                foundValue: { type: Type.STRING },
                sourceReference: { type: Type.STRING },
                explanation: { type: Type.STRING }
              }
            }
          }
        }
      }
    }
  });

  const parsed = JSON.parse(response.text!);
  
  // Transform array back to record for easier frontend use
  const evaluationsRecord: Record<string, CriterionEvaluation> = {};
  parsed.criteriaEvaluations.forEach((evalItem: CriterionEvaluation) => {
    evaluationsRecord[evalItem.criterionId] = evalItem;
  });

  return {
    id: Math.random().toString(36).substr(2, 9),
    name: bidderName,
    status: parsed.status,
    overallExplanation: parsed.overallExplanation,
    criteriaEvaluations: evaluationsRecord
  };
}
