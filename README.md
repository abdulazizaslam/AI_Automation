# AI Automation

This repository contains the project configuration and local guidance for building and managing AI-powered automations with Claude Code, n8n, Supabase, Vercel, and Git.

## Project structure

```text
Ai Automation/
├── .mcp.json                 # Project MCP configuration (Vercel)
├── CLAUDE.md                 # Project instructions for Claude Code
├── README.md                 # Project documentation
└── .claude/
    ├── settings.local.json   # Local Claude Code permissions and MCP settings
    └── skills/               # Project skills and API references
        └── ghl/              # GoHighLevel API skill
```

## Available skills

The `.claude/skills/` directory contains reusable project guidance for Claude Code. The current installed skill is:

- **GHL** — GoHighLevel API reference for contacts, proposals, contracts, opportunities, invoices, payments, and subscriptions.

Skills are kept inside `.claude/skills/` so they remain scoped to this project and can be invoked when needed.

## MCP and service access

This project is configured to work with the following services:

| Service | Access / purpose |
|---|---|
| **n8n** | MCP access for reading, creating, validating, testing, executing, updating, publishing, and managing workflows. The project instructions in `CLAUDE.md` require workflow structures to be read through n8n MCP and execution status to be reported clearly. |
| **Supabase** | MCP access for inspecting projects and tables, running SQL, applying migrations, deploying Edge Functions, checking logs, generating types, and reviewing security/performance advisors. |
| **Vercel** | Project MCP configuration is declared in `.mcp.json` for `https://mcp.vercel.com`. |
| **Git / GitHub** | Local Git repository management, commits, remote synchronization, and authorized pushes to the configured GitHub repository. |

### Current connected project references

- **n8n personal project:** `Abdu Aziz <azizi0072003@gmail.com>`
- **Supabase project:** `abdulazizaslam's Project`
- **Supabase project URL:** `https://drpymjqvyetxhszhxtdd.supabase.co`
- **GitHub repository:** `https://github.com/abdulazizaslam/AI_Automation`

Access depends on the credentials and permissions available to the current Claude Code session. Secrets and API keys must not be committed to this repository.

## Claude Code configuration

- `CLAUDE.md` contains project-wide instructions.
- `.claude/settings.local.json` contains local permission and MCP settings.
- `.mcp.json` contains project MCP server configuration.
- Temporary agent worktrees and generated test files should not be kept in the project root.

## Safety and security notes

- Review changes before committing or pushing them to GitHub.
- Do not store API keys, access tokens, database secrets, or private credentials in tracked files.
- Enable Supabase Row Level Security and define appropriate policies before exposing application tables to client-side users.
- Validate n8n workflows before publishing or running them in production.
