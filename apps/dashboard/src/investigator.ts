import type { FailureInput, InvestigationReport, Classification, Severity } from './types'

export const emptyFailure: FailureInput = {
  test_name: '', test_id: '', test_suite: '', app_name: 'ShopSphere', environment: 'Staging', browser: 'Chromium',
  run_id: '', executed_at: new Date().toISOString().slice(0, 16), failure_message: '', stack_trace: '', logs: '',
  network_logs: '', screenshot_summary: '', module: '', recent_commits: '', failure_count: '', failure_pattern: '',
  last_success: '', artifact_paths: '',
}

export function investigate(input: FailureInput): InvestigationReport {
  const evidence = [input.failure_message, input.stack_trace, input.logs, input.network_logs, input.screenshot_summary].filter(Boolean)
  const allEvidence = evidence.join('\n')
  const lower = allEvidence.toLowerCase()
  const missing: string[] = []
  if (!input.stack_trace.trim()) missing.push('Stack trace')
  if (!input.logs.trim()) missing.push('Application and test logs')
  if (!input.failure_message.trim()) missing.push('Failure message')
  if (!input.test_name.trim()) missing.push('Test name')

  let classification: Classification = 'APPLICATION_BUG'
  let cause = 'The available evidence identifies a test failure, but does not establish a specific underlying defect.'
  let errorType = 'Not identified from evidence'
  let failedPoint = 'Not identified from evidence'
  let fix = 'Collect and inspect the failing assertion, stack trace, and relevant application logs before changing code.'
  let codeSuggestion = 'Insufficient evidence to suggest code changes.'
  let severity: Severity = 'MEDIUM'

  if (/timeout|timed out|deadline exceeded/i.test(lower)) {
    classification = input.failure_pattern.toLowerCase().includes('intermittent') ? 'FLAKY' : 'ENVIRONMENT'
    cause = 'The test did not complete within its reported time limit. The evidence does not identify whether the delay originated in the application, test synchronization, or environment.'
    errorType = 'Timeout (reported in evidence)'
    fix = 'Use the stack trace and timing logs to identify the stalled operation, then address its source before adjusting timeouts.'
    failedPoint = input.failure_message || 'A timed operation did not complete before its deadline.'
  } else if (/assertionerror|assertion failed|expected .+ (?:to equal|but got|got)/i.test(lower)) {
    classification = 'APPLICATION_BUG'
    cause = 'An assertion reported a mismatch between the expected and observed result. The supplied evidence does not establish which side is incorrect.'
    errorType = 'AssertionError (reported in evidence)'
    failedPoint = input.failure_message || 'The failing assertion described in the supplied trace or logs.'
    fix = 'Verify the expected behavior against the observed value, then correct the application behavior or test expectation as appropriate.'
    const cartEvidence = allEvidence.match(/cart contains\s+(\d+)\s+items?\s+at\s+\$?((?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?)\s+each\.[\s\S]*?reported total:\s*\$?((?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?)/i)
    if (cartEvidence) {
      const quantity = Number(cartEvidence[1])
      const unitPrice = Number(cartEvidence[2].replaceAll(',', ''))
      const reportedTotal = Number(cartEvidence[3].replaceAll(',', ''))
      if (quantity > 1 && Math.abs(unitPrice - reportedTotal) < 0.01) {
        cause = `The logs show ${quantity} items at $${unitPrice.toFixed(2)} each, but the reported total is one item price. The cart calculation appears to omit item quantity.`
        severity = 'HIGH'
        fix = 'Multiply each product price by its cart-item quantity when calculating the cart total.'
        codeSuggestion = 'Accumulate product.price * item.quantity for each cart line.'
      }
    }
  } else if (/\b(401|403)\b|unauthorized|forbidden|authentication failed/i.test(lower)) {
    classification = 'APPLICATION_BUG'
    cause = 'The supplied evidence reports an authorization or authentication failure; it does not identify whether credentials, configuration, or application behavior caused it.'
    errorType = 'Authentication/authorization failure (reported in evidence)'
    severity = 'HIGH'
    fix = 'Inspect the recorded request, response, and test credentials to locate the source of the authorization failure.'
  } else if (/\b(500|502|503|504)\b|internal server error|service unavailable|connection refused|name resolution/i.test(lower)) {
    classification = 'EXTERNAL_SERVICE'
    cause = 'The supplied evidence indicates a service or connection failure, but does not establish whether the dependency or the test environment is responsible.'
    errorType = 'Service/connection failure (reported in evidence)'
    severity = 'HIGH'
    fix = 'Correlate the request timestamp with dependency health and network logs, then restore the failing dependency or correct its configuration.'
  }

  const hasStrongEvidence = Boolean(input.stack_trace.trim() && (input.failure_message.trim() || input.logs.trim()))
  let confidence = hasStrongEvidence ? 0.76 : evidence.length >= 2 ? 0.58 : evidence.length === 1 ? 0.42 : 0.2
  if (input.failure_count && Number(input.failure_count) > 1 && input.failure_pattern.toLowerCase().includes('intermittent')) {
    classification = 'FLAKY'
    confidence = Math.min(confidence, 0.66)
  }
  if (classification === 'APPLICATION_BUG' && !/assertionerror|assertion failed|expected .+ (?:to equal|but got|got)/i.test(lower)) {
    classification = 'TEST_BUG'
    cause = 'A failing test is recorded, but the supplied evidence does not demonstrate an application defect. The failure source remains undetermined.'
  }

  const priority: InvestigationReport['priority'] = severity === 'HIGH' ? 'P1' : 'P2'
  const historyRate = input.failure_pattern.match(/(\d+)\s+failures?\s+in\s+(\d+)\s+runs?/i)
  const keyEvidence = evidence.flatMap((part) => part.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)).slice(0, 5)
  const evidenceDescription = [input.failure_message, input.stack_trace, input.logs, input.network_logs, input.screenshot_summary]
    .map((part, index) => part ? `${['Failure message', 'Stack trace', 'Logs', 'Network activity', 'Screenshot summary'][index]}: ${part}` : '')
    .filter(Boolean).join(' ')
  const summary = `${cause} ${evidenceDescription || 'No failure evidence was supplied.'}`
  const bugId = `BL-${input.run_id || 'UNASSIGNED'}-${input.test_id || 'UNASSIGNED'}`
  const titleSource = input.failure_message || input.test_name || 'Automated test failure'
  const title = `${input.test_name || 'Unidentified test'}: ${titleSource}`.slice(0, 110)
  const absentExpected = 'Not provided in available evidence.'
  const recommendations = [fix]
  const expectedMatch = allEvidence.match(/expected(?: cart total)?\s+((?:[$€£]\s*)?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?)/i)
  const actualMatch = allEvidence.match(/(?:received|got)\s+((?:[$€£]\s*)?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?)/i)
  const actualResult = actualMatch?.[1].trim() || input.failure_message || absentExpected
  const expectedResult = expectedMatch?.[1].trim() || absentExpected
  const steps = input.test_name ? [`Run automated test "${input.test_name}"${input.test_suite ? ` in suite "${input.test_suite}"` : ''}.`, ...(input.environment ? [`Use the ${input.environment} environment${input.browser ? ` with ${input.browser}` : ''}.`] : [])] : ['Cannot be determined from available evidence']
  const businessImpact = classification === 'APPLICATION_BUG' ? 'A potential application behavior issue is indicated; the user impact cannot be quantified from the supplied evidence.' : 'No user or business impact can be established from the supplied test evidence.'
  const howFound = evidenceDescription || 'The test failure record contains no stack trace, logs, network activity, or screenshot summary to explain how the failure was detected.'
  const subcategory = /timeout|timed out|deadline exceeded/i.test(lower) ? 'TIMEOUT'
    : /assertionerror|assertion failed|expected .+ (?:to equal|but got|got)/i.test(lower) ? 'ASSERTION_FAILURE'
      : /\b(500|502|503|504)\b|internal server error|service unavailable|connection refused|name resolution/i.test(lower) ? 'SERVICE_RESPONSE'
        : 'UNDETERMINED'

  return {
    bug_id: bugId,
    test_run_id: input.run_id,
    test_name: input.test_name,
    test_suite: input.test_suite,
    app_name: input.app_name,
    environment: input.environment,
    browser: input.browser,
    executed_at: input.executed_at,
    bug_title: title,
    consolidated_summary: summary,
    classification,
    subcategory,
    severity,
    priority,
    confidence_score: confidence,
    actual_result: actualResult,
    expected_result: expectedResult,
    how_was_it_found: howFound,
    root_cause: {
      summary: cause,
      technical_details: evidenceDescription || 'No technical evidence was supplied; a specific cause cannot be established.',
      affected_component: input.module || 'Not identified from evidence',
      failure_point: failedPoint,
      error_type: errorType,
    },
    steps_to_reproduce: steps,
    impact_analysis: {
      user_facing: classification === 'APPLICATION_BUG',
      data_loss_risk: false,
      affected_scope: classification === 'APPLICATION_BUG' ? 'SOME' : 'NONE',
      business_impact: businessImpact,
    },
    flakiness_analysis: {
      is_flaky: classification === 'FLAKY',
      reproduction_rate: historyRate ? Math.min(1, Number(historyRate[1]) / Math.max(Number(historyRate[2]), 1)) : /consistent/i.test(input.failure_pattern) ? 1 : 0,
      likely_triggers: input.failure_pattern ? [input.failure_pattern] : [],
    },
    remediation: {
      fix_summary: fix,
      recommended_fix_steps: recommendations,
      code_suggestion: codeSuggestion,
      prevention_suggestions: ['Retain the failure message, stack trace, and relevant logs with each test result.', 'Compare expected and actual behavior before assigning an application root cause.'],
    },
    consolidated_bug_report: [
      `Bug Title: ${title}`,
      `What Failed: ${actualResult}`,
      `Where It Failed: ${failedPoint}`,
      `Why It Failed: ${cause}`,
      `How It Was Found: ${howFound}`,
      `Impact: ${businessImpact}`,
      `Steps to Reproduce: ${steps.join(' ')}`,
      `Recommended Fix: ${fix}`,
    ].join('\n'),
    evidence_used: {
      used_stack_trace: Boolean(input.stack_trace.trim()),
      used_logs: Boolean(input.logs.trim()),
      used_screenshot: Boolean(input.screenshot_summary.trim()),
      used_network_logs: Boolean(input.network_logs.trim()),
      used_failure_history: Boolean(input.failure_count || input.failure_pattern || input.last_success),
      key_evidence: keyEvidence,
    },
    ml_ready_data: {
      classification_label: classification,
      severity_label: severity,
      error_keywords: (input.failure_message.match(/[a-zA-Z][a-zA-Z0-9_-]{2,}/g) || []).slice(0, 10),
      is_ui_failure: Boolean(input.screenshot_summary.trim()),
      is_api_failure: Boolean(input.network_logs.trim()),
      is_auth_failure: /\b(401|403)\b|unauthorized|forbidden|authentication failed/i.test(lower),
      has_assertion_error: /assertionerror|assertion failed/i.test(lower),
      has_timeout: /timeout|timed out|deadline exceeded/i.test(lower),
      failure_text_for_embedding: [input.test_name, errorType, input.failure_message, input.module || 'Not identified from evidence'].filter(Boolean).join(' | '),
      feature_vector_reason: 'Classification, severity, evidence availability, and failure keywords provide structured features for comparing similar test failures.',
    },
    metadata: {
      evidence_quality: confidence >= 0.7 ? 'HIGH' : confidence >= 0.45 ? 'MEDIUM' : 'LOW',
      requires_human_review: confidence < 0.7,
      missing_evidence: missing,
      flags: [!input.stack_trace.trim() && 'INSUFFICIENT_STACK_TRACE', !input.logs.trim() && 'INSUFFICIENT_LOGS', classification === 'FLAKY' && 'INTERMITTENT'].filter(Boolean) as string[],
      analysis_source: 'BUGLENS_AI_INVESTIGATOR',
      analysis_type: 'AUTOMATED_TEST_FAILURE_INVESTIGATION',
    },
  }
}

export function makeSampleReports(): InvestigationReport[] {
  const base = (overrides: Partial<FailureInput>): InvestigationReport => investigate({
    ...emptyFailure,
    test_name: 'test_cart_total_calculation', test_id: 'TC-104', test_suite: 'checkout-regression', app_name: 'ShopSphere',
    environment: 'Staging', browser: 'Chromium', run_id: 'RUN-2841', executed_at: new Date(Date.now() - 1000 * 60 * 38).toISOString(),
    failure_message: 'Expected cart total $2,999.97, received $999.99',
    stack_trace: 'AssertionError: Expected cart total $2,999.97, received $999.99\n  at test_cart_total_calculation (test_shopsphere.py:84)',
    logs: 'Cart contains 3 items at $999.99 each. Reported total: $999.99.',
    module: 'Cart totals', failure_count: '4', failure_pattern: 'Consistent across the last 4 runs', last_success: '2026-09-25 14:22 UTC', ...overrides,
  })

  return [
    base({}),
    base({
      test_name: 'test_checkout_with_coupon', test_id: 'TC-208', run_id: 'RUN-2838',
      failure_message: 'POST /api/payment returned HTTP 500 when coupon_code was present',
      stack_trace: 'HTTPError: 500 Server Error\n  at submit_order (checkout.spec.ts:142)',
      logs: 'Payment request rejected after coupon validation. Response status: 500.',
      network_logs: 'POST /api/payment -> 500 Internal Server Error', module: 'Payment / coupon checkout',
      failure_count: '3', failure_pattern: 'Intermittent: 3 failures in 5 runs',
    }),
    base({
      test_name: 'test_checkout_payment_failure', test_id: 'TC-311', run_id: 'RUN-2834',
      failure_message: 'Expected failed payment to preserve cart; cart was empty after request',
      stack_trace: 'AssertionError: expected cart item count 1, received 0\n  at test_checkout_payment_failure (test_shopsphere.py:176)',
      logs: 'Payment processing failed: gateway declined request. Cart cleared.',
      module: 'Checkout error handling', failure_count: '2', failure_pattern: 'Consistent after payment decline',
    }),
  ]
}