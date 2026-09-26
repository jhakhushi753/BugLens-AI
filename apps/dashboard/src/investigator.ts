import type { FailureInput } from './types'

export const emptyFailure: FailureInput = {
  test_name: '',
  test_id: '',
  test_suite: '',
  app_name: 'ShopSphere',
  environment: 'Staging',
  browser: 'Chromium',
  run_id: '',
  executed_at: new Date().toISOString().slice(0, 16),
  failure_message: '',
  stack_trace: '',
  logs: '',
  network_logs: '',
  screenshot_summary: '',
  module: '',
  recent_commits: '',
  failure_count: '',
  failure_pattern: '',
  last_success: '',
  artifact_paths: '',
}
