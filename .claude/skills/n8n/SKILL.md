---
name: n8n
description: Operate n8n workflows safely through the connected n8n MCP server: discover, inspect, validate, execute, and report workflow status.
user-invocable: true
---

# n8n Workflow Skill

Use this skill for n8n workflow discovery, inspection, validation, testing, execution, and management through the project’s n8n MCP server.

## Operating rules

1. Use the available n8n MCP tools for workflow structures and executions. Do not substitute guessed API calls or local workflow files when MCP is available.
2. Before changing or executing a workflow, identify the target unambiguously by workflow ID or exact name.
3. Read the workflow structure and relevant node configuration before making recommendations or running it.
4. Validate the workflow before publishing or running it in production. Check node configuration, connections, required credentials, expressions, and likely input shape.
5. Treat execution as an external side effect. Execute only when the user explicitly requests it or has clearly authorized the operation.
6. Never reveal credential values, access tokens, cookies, or secret headers. Report credential names and whether a credential appears configured, not secret contents.
7. For destructive, production, or irreversible actions, summarize the intended effect and obtain confirmation unless the user already gave explicit authorization for that exact action.
8. After an execution, report the status clearly: workflow identity, execution result, execution ID if available, start/end information if available, and any error summary. Do not claim success without an MCP result confirming it.

## Discovery and inspection sequence

- Search projects or workflows using n8n MCP.
- Resolve the exact workflow target.
- Retrieve workflow details and inspect nodes, connections, trigger type, credentials by name, and active/published state.
- Search nodes or retrieve the SDK reference when designing or repairing workflow code.
- Validate the proposed change or workflow before execution or publication.

## Execution sequence

- Confirm the target and requested inputs.
- Check whether execution is test, manual, or production-facing.
- Execute through n8n MCP only after authorization.
- Capture the complete MCP result and distinguish completed, failed, waiting, cancelled, and unknown states.
- Report the result plainly, including actionable error details without exposing secrets.

## Safety checklist

- Is the workflow target unambiguous?
- Was its structure read through n8n MCP?
- Were credentials and external side effects identified?
- Was validation performed before execution or publication?
- Was explicit authorization given for execution?
- Is the final execution status supported by the MCP response?
