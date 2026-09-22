# Prompt Engineering Guide

The AI investigator relies on structured prompts to classify errors and explain root causes with confidence.

## Core principles

- Be explicit about the desired output format
- Ask for classification, severity, confidence, root cause, and recommendations
- Keep the prompt grounded in observed evidence such as stack traces and screen captures
- Include failure context and possible affected modules

## Recommended response schema

```json
{
  "test_name": "string",
  "classification": "APPLICATION_BUG | TEST_BUG | FLAKY | ENVIRONMENT | EXTERNAL_SERVICE",
  "severity": "CRITICAL | HIGH | MEDIUM | LOW",
  "confidence": 0.0,
  "root_cause": "string",
  "affected_component": "string",
  "recommendations": ["string"]
}
```

## Example prompt pattern

```text
You are an expert QA investigator.

Analyze the following failing test and surrounding evidence.

Context:
- application: ShopSphere
- test name: {{TEST_NAME}}
- stack trace: {{STACK_TRACE}}
- log output: {{LOGS}}
- screenshot path: {{SCREENSHOT_PATH}}

Return output in JSON only.
Include:
1. classification
2. severity
3. confidence
4. root_cause
5. affected_component
6. recommendations
```

## Prompt tuning tips

- Add constraints such as "do not guess when the evidence is weak"
- Ask the model to cite likely files or functions
- Prefer structured JSON over narrative output
- Use one prompt per failure channel when collecting evidence from logs and screenshots

## Evaluation strategy

Review AI outputs against actual bug fixes and ensure:

- root causes align with code changes
- confidence is calibrated to the evidence
- recommendations are actionable and concrete
