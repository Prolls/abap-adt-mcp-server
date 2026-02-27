# ABAP ADT MCP Server

A [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) server that wraps SAP ADT (ABAP Development Tools) REST APIs, enabling AI models to autonomously develop ABAP applications.

## Features

- **66 tools** across 13 categories covering the full ABAP development lifecycle
- **16 object types** supported (classes, CDS views, service bindings, tables, etc.)
- **2 transport modes**: STDIO (CLI) and Streamable HTTP (web)
- **Automatic management** of SAP locks, sessions, and transport requests
- **Full interactive debugging**: attach, step, inspect/modify variables, stack traces
- **gCTS integration**: manage Git-enabled Change and Transport System repositories
- **Translation support**: read/write texts in multiple languages, compare translations
- **DDIC metadata**: explore data dictionary elements, CDS annotations

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

### Debug (10 tools)

| Tool | Description |
|------|-------------|
| `debug_listen` | Listen for debug sessions (blocking) |
| `set_breakpoints` | Set breakpoints in source code |
| `debug_delete_breakpoints` | Remove a breakpoint |
| `debug_attach` | Attach to a running debug session |
| `debug_stack_trace` | Get the current call stack |
| `debug_variables` | Inspect variables (names, types, values) |
| `debug_child_variables` | Expand complex variables (structures, tables, objects) |
| `debug_step` | Step into/over/return/continue/terminate |
| `debug_set_variable` | Modify a variable value at runtime |
| `get_traces` | List execution traces |

### Git / abapGit (2 tools)

| Tool | Description |
|------|-------------|
| `list_git_repos` | List abapGit repositories linked to the system |
| `git_pull` | Pull changes from an abapGit repository |

### gCTS (10 tools)

| Tool | Description |
|------|-------------|
| `gcts_list_repositories` | List all gCTS repositories |
| `gcts_get_repository` | Get repository details by ID |
| `gcts_create_repository` | Create a new repository (link Git URL to ABAP package) |
| `gcts_delete_repository` | Delete a repository |
| `gcts_clone_repository` | Clone a repository from remote |
| `gcts_pull` | Pull latest changes |
| `gcts_commit` | Commit local changes |
| `gcts_list_branches` | List branches |
| `gcts_switch_branch` | Switch to a different branch |
| `gcts_get_history` | Get commit history |

### System (7 tools)

| Tool | Description |
|------|-------------|
| `list_dumps` | List ABAP runtime dumps (ST22) |
| `list_feeds` | List ADT activity feeds |
| `get_object_revisions` | Version history of an object |
| `list_inactive_objects` | List all non-activated objects |
| `get_abap_documentation` | F1 help for a symbol |
| `run_class` | Execute an IF_OO_ADT_CLASSRUN class |
| `run_sql_query` | Execute SQL queries (JOINs, aggregations, WHERE) |

### DDIC Metadata (3 tools)

| Tool | Description |
|------|-------------|
| `get_ddic_element` | Get DDIC element metadata (types, lengths, keys, labels) |
| `get_ddic_repo_access` | Get DDIC repository access references |
| `get_annotation_definitions` | List all available CDS annotation definitions |

### Translation (7 tools)

| Tool | Description |
|------|-------------|
| `get_object_texts_in_language` | Read object source in a specific language |
| `get_data_element_labels` | Get data element labels (short/medium/long/heading) in a language |
| `get_message_class_texts` | Get all messages of a message class in a language |
| `write_message_class_texts` | Write/update translated message texts |
| `write_data_element_labels` | Write/update translated data element labels |
| `get_text_pool_in_language` | Get text elements (TEXT-xxx) in a language |
| `compare_object_languages` | Compare texts between two languages (find missing translations) |

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

## Typical Workflows

### Create and activate an object

```
create_object → write_object_source → syntax_check → activate_objects
```

### Full OData service

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

### Interactive debugging

```
1. set_breakpoints           # Set breakpoints in source
2. debug_listen              # Wait for a debug session (blocking)
3. debug_attach              # Attach to the debuggee
4. debug_stack_trace         # Inspect the call stack
5. debug_variables           # Inspect variable values
6. debug_step (stepOver)     # Step through code
7. debug_set_variable        # Modify a variable at runtime
8. debug_step (stepContinue) # Continue execution
```

### Translation workflow

```
1. compare_object_languages    # Compare EN vs FR to find missing translations
2. get_message_class_texts     # Read source texts in EN
3. (AI translates the texts)
4. write_message_class_texts   # Write translated texts in FR
5. activate_objects             # Activate
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
    ├── tools/                 # 66 tool definitions
    │   ├── exploration.ts     # Search, read, navigate
    │   ├── modification.ts    # Create, write, delete, activate
    │   ├── quality.ts         # Syntax check, unit tests, ATC
    │   ├── transports.ts      # Transport management
    │   ├── refactoring.ts     # Rename, extract, completion
    │   ├── data-services.ts   # Table contents, service bindings
    │   ├── debug.ts           # Full interactive debugging
    │   ├── git.ts             # abapGit integration
    │   ├── gcts.ts            # gCTS (Git-enabled CTS)
    │   ├── system.ts          # Dumps, feeds, revisions, SQL
    │   ├── ddic.ts            # DDIC metadata, CDS annotations
    │   ├── translation.ts     # Multi-language text management
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
