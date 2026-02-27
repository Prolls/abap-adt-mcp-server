# ABAP ADT MCP Server

A [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) server that wraps SAP ADT (ABAP Development Tools) REST APIs, enabling AI models to autonomously develop ABAP applications.

## Features

- **32 tools** across 8 categories covering the full ABAP development lifecycle
- **16 object types** supported (classes, CDS views, service bindings, tables, etc.)
- **2 transport modes**: STDIO (CLI) and Streamable HTTP (web)
- **Automatic management** of SAP locks, sessions, and transport requests

## Prerequisites

- Node.js >= 18
- An SAP system with ADT APIs enabled (S/4HANA, BTP ABAP Environment)
- An SAP user with development authorizations (S_DEVELOP, etc.)

## Installation

```bash
npm install
npm run build
```

## Configuration

Copy `.env.example` to `.env` and fill in the parameters:

```env
# SAP Connection
SAP_HOST=https://your-sap-server:44300
SAP_USER=your_username
SAP_CLIENT=100
SAP_LANGUAGE=EN

# Password is prompted interactively at startup.
# For CI/automation only: SAP_PASSWORD=xxx

# HTTP Server (Streamable mode only)
MCP_HOST=127.0.0.1
MCP_PORT=3122

# Logging: DEBUG | INFO | WARN | ERROR
LOG_LEVEL=INFO
```

## Getting Started

### STDIO Mode (for Claude Code, Cursor, etc.)

```bash
npm start
```

### Streamable HTTP Mode (for web clients)

```bash
npm run start:streamable
```

Endpoints:
| Method | URL | Description |
|--------|-----|-------------|
| `POST /mcp` | JSON-RPC requests | |
| `GET /mcp` | SSE stream (notifications) | |
| `DELETE /mcp` | Close session | |
| `GET /health` | Health check | |

## Claude Code Integration

Add to `.mcp.json` at your project root:

```json
{
  "mcpServers": {
    "abap-adt": {
      "command": "node",
      "args": ["<path>/abap-adt-mcp-server/dist/src/server.js"],
      "cwd": "<path>/abap-adt-mcp-server",
      "env": {
        "SAP_HOST": "https://your-sap-server:44300",
        "SAP_USER": "your_username",
        "SAP_PASSWORD": "your_password",
        "SAP_CLIENT": "100",
        "SAP_LANGUAGE": "EN"
      }
    }
  }
}
```

## Available Tools

### Exploration (8 tools)

| Tool | Description |
|------|-------------|
| `search_objects` | Search by pattern with wildcards (`ZCL_*`, `*SALES*`) |
| `list_package_contents` | List all objects in a package |
| `read_object_source` | Read full source code |
| `get_object_structure` | Object tree (includes, sub-objects) |
| `get_class_components` | Methods, attributes, constants of a class |
| `get_type_hierarchy` | Inheritance hierarchy (super/sub-classes) |
| `find_references` | Where-used list |
| `find_definition` | Navigate to symbol definition |

### Modification (5 tools)

| Tool | Description |
|------|-------------|
| `create_object` | Create an ABAP object (class, CDS view, program, etc.) |
| `write_object_source` | Write source code (automatic lock management) |
| `delete_object` | Delete an object (irreversible) |
| `activate_objects` | Activate/compile an object |
| `pretty_print` | Format code with SAP Pretty Printer |

### Quality (3 tools)

| Tool | Description |
|------|-------------|
| `syntax_check` | Syntax check before activation |
| `run_unit_tests` | Run ABAP Unit tests |
| `run_atc_checks` | ATC static analysis (security, performance, conventions) |

### Transports (4 tools)

| Tool | Description |
|------|-------------|
| `list_transports` | List user's transport requests |
| `create_transport` | Create a transport request (CTS project support) |
| `get_transport_info` | Transport info (lock status, layer) |
| `release_transport` | Release a transport request |

### Refactoring (4 tools)

| Tool | Description |
|------|-------------|
| `rename_symbol` | Rename a symbol across the codebase |
| `extract_method` | Extract a code block into a new method |
| `code_completion` | Completion suggestions at a given position |
| `get_fix_proposals` | Quick-fix proposals for errors |

### Data Services (3 tools)

| Tool | Description |
|------|-------------|
| `read_table_contents` | Read contents of a table or CDS view |
| `publish_service_binding` | Publish an OData service |
| `unpublish_service_binding` | Unpublish an OData service |

### Debug (3 tools)

| Tool | Description |
|------|-------------|
| `debug_listen` | Listen for debug sessions (blocking) |
| `set_breakpoints` | Set breakpoints in source code |
| `get_traces` | List execution traces |

### Git (2 tools)

| Tool | Description |
|------|-------------|
| `list_git_repos` | List abapGit repositories linked to the system |
| `git_pull` | Pull changes from an abapGit repository |

## Supported Object Types

| Type | Description |
|------|-------------|
| `CLAS/OC` | ABAP Classes |
| `INTF/OI` | Interfaces |
| `PROG/P` | Programs |
| `PROG/I` | Includes |
| `FUGR/F` | Function Groups |
| `FUGR/FF` | Function Modules |
| `DDLS/DF` | CDS Views (Data Definition) |
| `DDLX/EX` | Metadata Extensions (CDS annotations) |
| `DCLS/DL` | Access Controls (DCL) |
| `SRVD/SRV` | Service Definitions |
| `SRVB/SVB` | Service Bindings |
| `TABL/DT` | Database Tables |
| `DTEL/DE` | Data Elements |
| `DOMA/DD` | Domains |
| `DEVC/K` | Packages |
| `MSAG/N` | Message Classes |

## Typical Workflow

```
create_object → write_object_source → syntax_check → activate_objects
```

For a full OData service:

```
1. create_transport          # Create a transport request
2. create_object (DDLS/DF)   # Interface CDS View
3. write_object_source       # Write CDS source
4. activate_objects           # Activate
5. create_object (DDLS/DF)   # Consumption CDS View
6. create_object (DDLX/EX)   # Metadata Extension
7. create_object (SRVD/SRV)  # Service Definition
8. create_object (SRVB/SVB)  # Service Binding
9. publish_service_binding    # Publish the service
```

## Architecture

```
src/
├── server.ts                  # STDIO entry point
├── streamable-http-server.ts  # HTTP entry point
├── types/index.ts             # Shared schemas (Zod)
└── lib/
    ├── adt-client.ts          # ADT client (singleton, auto-reconnect)
    ├── config.ts              # Configuration (env vars, password prompt)
    ├── logger.ts              # Structured JSON logging (stderr)
    ├── tools/                 # 32 tool definitions
    │   ├── exploration.ts
    │   ├── modification.ts
    │   ├── quality.ts
    │   ├── transports.ts
    │   ├── refactoring.ts
    │   ├── data-services.ts
    │   ├── debug.ts
    │   ├── git.ts
    │   └── index.ts           # Tool registry
    └── helpers/
        ├── url-builder.ts     # ADT URL construction
        └── lock-manager.ts    # Lock management (lock/unlock)
```

## Development

```bash
npm run dev    # TypeScript watch mode
npm test       # Run tests (Vitest)
```

## Key Dependencies

| Package | Role |
|---------|------|
| `@modelcontextprotocol/sdk` | MCP protocol implementation |
| `abap-adt-api` | REST client for SAP ADT APIs |
| `zod` | Input schema validation |
| `express` | HTTP server (Streamable mode) |
| `dotenv` | Environment variable loading |
