export type Classification = 'APPLICATION_BUG' | 'TEST_BUG' | 'FLAKY' | 'ENVIRONMENT' | 'INFRASTRUCTURE' | 'EXTERNAL_SERVICE' | 'DATA_ISSUE'
export type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'

export interface FailureInput {
  test_name: string
  test_id: string
  test_suite: string
  app_name: string
  environment: string
  browser: string
  run_id: string
  executed_at: string
  failure_message: string
  stack_trace: string
  logs: string
  network_logs: string
  screenshot_summary: string
  module: string
  recent_commits: string
  failure_count: string
  failure_pattern: string
  last_success: string
  artifact_paths: string
}

export interface InvestigationReport {
  bug_id: string
  test_run_id: string
  test_name: string
  test_suite: string
  app_name: string
  environment: string
  browser: string
  executed_at: string
  bug_title: string
  classification: Classification
  subcategory: string
  consolidated_bug_report: string
  severity: Severity
  priority: 'P0' | 'P1' | 'P2' | 'P3'
  confidence_score: number
  consolidated_summary: string
  actual_result: string
  expected_result: string
  how_was_it_found: string
  root_cause: {
    summary: string
    technical_details: string
    affected_component: string
    failure_point: string
    error_type: string
  }
  steps_to_reproduce: string[]
  impact_analysis: {
    user_facing: boolean
    data_loss_risk: boolean
    affected_scope: 'NONE' | 'SOME' | 'MOST' | 'ALL'
    business_impact: string
  }
  flakiness_analysis: {
    is_flaky: boolean
    reproduction_rate: number
    likely_triggers: string[]
  }
  remediation: {
    fix_summary: string
    recommended_fix_steps: string[]
    code_suggestion: string
    prevention_suggestions: string[]
  }
  evidence_used: {
    used_stack_trace: boolean
    used_logs: boolean
    used_screenshot: boolean
    used_network_logs: boolean
    used_failure_history: boolean
    key_evidence: string[]
  }
  ml_ready_data: {
    classification_label: Classification
    severity_label: Severity
    error_keywords: string[]
    is_ui_failure: boolean
    is_api_failure: boolean
    is_auth_failure: boolean
    has_assertion_error: boolean
    has_timeout: boolean
    failure_text_for_embedding: string
    feature_vector_reason: string
  }
  metadata: {
    evidence_quality: 'HIGH' | 'MEDIUM' | 'LOW'
    requires_human_review: boolean
    missing_evidence: string[]
    flags: string[]
    analysis_source: string
    analysis_type: string
  }
}