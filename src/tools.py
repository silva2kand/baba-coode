from __future__ import annotations

import json
import subprocess
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from urllib.parse import urlparse

import httpx

from .models import PortingBacklog, PortingModule
from .permissions import ToolPermissionContext

SNAPSHOT_PATH = Path(__file__).resolve().parent / 'reference_data' / 'tools_snapshot.json'
WORKSPACE_ROOT = Path(__file__).resolve().parent.parent


@dataclass(frozen=True)
class ToolExecution:
    name: str
    source_hint: str
    payload: str
    handled: bool
    message: str


SAFE_BUILTIN_TOOLS = (
    PortingModule(
        name='fs.read',
        responsibility='Read a UTF-8 text file from inside the workspace.',
        source_hint='builtin/fs.read',
        status='implemented',
    ),
    PortingModule(
        name='fs.write',
        responsibility='Write a UTF-8 text file inside the workspace.',
        source_hint='builtin/fs.write',
        status='implemented',
    ),
    PortingModule(
        name='fs.list',
        responsibility='List files and directories inside the workspace.',
        source_hint='builtin/fs.list',
        status='implemented',
    ),
    PortingModule(
        name='web.fetch',
        responsibility='Fetch HTTP or HTTPS content for safe read-only inspection.',
        source_hint='builtin/web.fetch',
        status='implemented',
    ),
    PortingModule(
        name='shell.exec',
        responsibility='Run an explicitly confirmed shell or argv command inside the workspace.',
        source_hint='builtin/shell.exec',
        status='implemented',
    ),
)


@lru_cache(maxsize=1)
def load_tool_snapshot() -> tuple[PortingModule, ...]:
    raw_entries = json.loads(SNAPSHOT_PATH.read_text())
    mirrored = tuple(
        PortingModule(
            name=entry['name'],
            responsibility=entry['responsibility'],
            source_hint=entry['source_hint'],
            status='mirrored',
        )
        for entry in raw_entries
    )
    return mirrored + SAFE_BUILTIN_TOOLS


PORTED_TOOLS = load_tool_snapshot()


@lru_cache(maxsize=1)
def built_in_tool_names() -> frozenset[str]:
    return frozenset(module.name for module in SAFE_BUILTIN_TOOLS)


def build_tool_backlog() -> PortingBacklog:
    return PortingBacklog(title='Tool surface', modules=list(PORTED_TOOLS))


def tool_names() -> list[str]:
    return [module.name for module in PORTED_TOOLS]


def get_tool(name: str) -> PortingModule | None:
    needle = name.lower()
    for module in PORTED_TOOLS:
        if module.name.lower() == needle:
            return module
    return None


def filter_tools_by_permission_context(
    tools: tuple[PortingModule, ...],
    permission_context: ToolPermissionContext | None = None,
) -> tuple[PortingModule, ...]:
    if permission_context is None:
        return tools
    return tuple(module for module in tools if not permission_context.blocks(module.name))


def get_tools(
    simple_mode: bool = False,
    include_mcp: bool = True,
    permission_context: ToolPermissionContext | None = None,
) -> tuple[PortingModule, ...]:
    tools = list(PORTED_TOOLS)
    if simple_mode:
        allowed = {'BashTool', 'FileReadTool', 'FileEditTool', 'fs.read', 'fs.write', 'fs.list'}
        tools = [module for module in tools if module.name in allowed]
    if not include_mcp:
        tools = [
            module
            for module in tools
            if 'mcp' not in module.name.lower() and 'mcp' not in module.source_hint.lower()
        ]
    return filter_tools_by_permission_context(tuple(tools), permission_context)


def find_tools(query: str, limit: int = 20) -> list[PortingModule]:
    needle = query.lower()
    matches = [
        module
        for module in PORTED_TOOLS
        if needle in module.name.lower() or needle in module.source_hint.lower()
    ]
    return matches[:limit]


def _parse_payload(payload: str) -> str | dict[str, object]:
    text = payload.strip()
    if not text:
        return {}
    if text.startswith('{'):
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            return payload
    return payload


def _resolve_workspace_path(value: str) -> Path:
    candidate = Path(value)
    resolved = candidate.resolve() if candidate.is_absolute() else (WORKSPACE_ROOT / candidate).resolve()
    if resolved != WORKSPACE_ROOT and WORKSPACE_ROOT not in resolved.parents:
        raise ValueError('Path must stay inside the workspace root')
    return resolved


def _truncate_text(value: str, limit: int = 4000) -> str:
    if len(value) <= limit:
        return value
    return value[:limit] + '\n...[truncated]'


def _execute_fs_read(payload: str) -> ToolExecution:
    parsed = _parse_payload(payload)
    path_value = parsed.get('path', '') if isinstance(parsed, dict) else str(parsed)
    if not path_value:
        return ToolExecution('fs.read', 'builtin/fs.read', payload, False, 'fs.read requires a file path.')
    try:
        target = _resolve_workspace_path(str(path_value))
    except ValueError as exc:
        return ToolExecution('fs.read', 'builtin/fs.read', payload, False, str(exc))
    if not target.exists() or not target.is_file():
        return ToolExecution('fs.read', 'builtin/fs.read', payload, False, f'File not found: {target}')
    return ToolExecution('fs.read', 'builtin/fs.read', payload, True, _truncate_text(target.read_text(encoding='utf-8')))


def _execute_fs_list(payload: str) -> ToolExecution:
    parsed = _parse_payload(payload)
    if isinstance(parsed, dict):
        path_value = str(parsed.get('path', '.'))
        recursive = bool(parsed.get('recursive', False))
        limit = int(parsed.get('limit', 100))
    else:
        path_value = str(parsed) if parsed else '.'
        recursive = False
        limit = 100
    try:
        target = _resolve_workspace_path(path_value)
    except ValueError as exc:
        return ToolExecution('fs.list', 'builtin/fs.list', payload, False, str(exc))
    if not target.exists() or not target.is_dir():
        return ToolExecution('fs.list', 'builtin/fs.list', payload, False, f'Directory not found: {target}')

    entries = target.rglob('*') if recursive else target.iterdir()
    lines: list[str] = []
    for entry in entries:
        rel = entry.relative_to(WORKSPACE_ROOT).as_posix()
        lines.append(rel + ('/' if entry.is_dir() else ''))
        if len(lines) >= max(1, limit):
            break
    return ToolExecution('fs.list', 'builtin/fs.list', payload, True, '\n'.join(lines) or '(empty directory)')


def _execute_fs_write(payload: str) -> ToolExecution:
    parsed = _parse_payload(payload)
    if not isinstance(parsed, dict):
        return ToolExecution('fs.write', 'builtin/fs.write', payload, False, 'fs.write requires JSON payload with path and content.')
    path_value = str(parsed.get('path', ''))
    content = parsed.get('content', '')
    if not path_value:
        return ToolExecution('fs.write', 'builtin/fs.write', payload, False, 'fs.write requires a path field.')
    if not isinstance(content, str):
        return ToolExecution('fs.write', 'builtin/fs.write', payload, False, 'fs.write content must be a string.')
    try:
        target = _resolve_workspace_path(path_value)
    except ValueError as exc:
        return ToolExecution('fs.write', 'builtin/fs.write', payload, False, str(exc))
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content, encoding='utf-8')
    relative = target.relative_to(WORKSPACE_ROOT).as_posix()
    return ToolExecution('fs.write', 'builtin/fs.write', payload, True, f'Wrote {len(content)} bytes to {relative}')


def _execute_web_fetch(payload: str) -> ToolExecution:
    parsed = _parse_payload(payload)
    url = parsed.get('url', '') if isinstance(parsed, dict) else str(parsed)
    if not url:
        return ToolExecution('web.fetch', 'builtin/web.fetch', payload, False, 'web.fetch requires a URL.')
    parsed_url = urlparse(url)
    if parsed_url.scheme not in {'http', 'https'}:
        return ToolExecution('web.fetch', 'builtin/web.fetch', payload, False, 'web.fetch only supports http and https URLs.')
    try:
        response = httpx.get(url, follow_redirects=True, timeout=15)
        response.raise_for_status()
        return ToolExecution('web.fetch', 'builtin/web.fetch', payload, True, _truncate_text(response.text))
    except httpx.HTTPError as exc:
        return ToolExecution('web.fetch', 'builtin/web.fetch', payload, False, f'web.fetch failed: {exc}')


def _execute_shell_exec(payload: str) -> ToolExecution:
    parsed = _parse_payload(payload)
    if not isinstance(parsed, dict):
        return ToolExecution('shell.exec', 'builtin/shell.exec', payload, False, 'shell.exec requires JSON payload and explicit confirmation.')
    if parsed.get('confirm') is not True:
        return ToolExecution('shell.exec', 'builtin/shell.exec', payload, False, 'shell.exec requires {"confirm": true} in the payload.')

    timeout = min(max(int(parsed.get('timeout', 30)), 1), 60)
    cwd_value = str(parsed.get('cwd', '.'))
    try:
        cwd = _resolve_workspace_path(cwd_value)
    except ValueError as exc:
        return ToolExecution('shell.exec', 'builtin/shell.exec', payload, False, str(exc))

    argv = parsed.get('argv')
    command = parsed.get('command')
    blocked_tokens = ('rm -rf', 'del /f', 'format ', 'shutdown', 'reboot', 'reg delete', 'remove-item')

    try:
        if isinstance(argv, list) and argv and all(isinstance(part, str) for part in argv):
            result = subprocess.run(argv, capture_output=True, text=True, cwd=str(cwd), timeout=timeout, shell=False, check=False)
        elif isinstance(command, str) and command.strip():
            lowered = command.lower()
            if any(token in lowered for token in blocked_tokens):
                return ToolExecution('shell.exec', 'builtin/shell.exec', payload, False, 'shell.exec blocked a potentially destructive command.')
            result = subprocess.run(command, capture_output=True, text=True, cwd=str(cwd), timeout=timeout, shell=True, check=False)
        else:
            return ToolExecution('shell.exec', 'builtin/shell.exec', payload, False, 'shell.exec requires either an argv list or command string.')
    except Exception as exc:
        return ToolExecution('shell.exec', 'builtin/shell.exec', payload, False, f'shell.exec failed: {exc}')

    combined = '\n'.join(
        part
        for part in [result.stdout.strip(), result.stderr.strip(), f'exit_code={result.returncode}']
        if part
    )
    return ToolExecution('shell.exec', 'builtin/shell.exec', payload, result.returncode == 0, _truncate_text(combined))


def _execute_builtin_tool(name: str, payload: str) -> ToolExecution | None:
    handlers = {
        'fs.read': _execute_fs_read,
        'fs.list': _execute_fs_list,
        'fs.write': _execute_fs_write,
        'web.fetch': _execute_web_fetch,
        'shell.exec': _execute_shell_exec,
    }
    handler = handlers.get(name)
    if handler is None:
        return None
    return handler(payload)


def execute_tool(name: str, payload: str = '') -> ToolExecution:
    builtin = _execute_builtin_tool(name, payload)
    if builtin is not None:
        return builtin
    module = get_tool(name)
    if module is None:
        return ToolExecution(name=name, source_hint='', payload=payload, handled=False, message=f'Unknown mirrored tool: {name}')
    action = f"Mirrored tool '{module.name}' from {module.source_hint} would handle payload {payload!r}."
    return ToolExecution(name=module.name, source_hint=module.source_hint, payload=payload, handled=True, message=action)


def render_tool_index(limit: int = 20, query: str | None = None) -> str:
    modules = find_tools(query, limit) if query else list(PORTED_TOOLS[:limit])
    lines = [f'Tool entries: {len(PORTED_TOOLS)}', '']
    if query:
        lines.append(f'Filtered by: {query}')
        lines.append('')
    lines.extend(f'- {module.name} — {module.source_hint}' for module in modules)
    return '\n'.join(lines)
