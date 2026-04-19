/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export enum CriterionType {
  TECHNICAL = 'Technical',
  FINANCIAL = 'Financial',
  COMPLIANCE = 'Compliance',
  DOCUMENTATION = 'Documentation',
}

export interface Criterion {
  id: string;
  name: string;
  type: CriterionType;
  description: string;
  isMandatory: boolean;
  evidenceRequirement: string;
}

export enum EvaluationStatus {
  ELIGIBLE = 'Eligible',
  INELIGIBLE = 'Ineligible',
  MANUAL_REVIEW = 'Manual Review',
}

export enum Verdict {
  PASS = 'Pass',
  FAIL = 'Fail',
  AMBIGUOUS = 'Ambiguous',
}

export interface CriterionEvaluation {
  criterionId: string;
  verdict: Verdict;
  foundValue: string;
  sourceReference: string;
  explanation: string;
}

export interface Bidder {
  id: string;
  name: string;
  status: EvaluationStatus;
  criteriaEvaluations: Record<string, CriterionEvaluation>;
  overallExplanation: string;
}

export interface ProjectState {
  tenderName: string;
  criteria: Criterion[];
  bidders: Bidder[];
}
