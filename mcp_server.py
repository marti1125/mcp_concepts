import json
from typing import Optional
from pathlib import Path
from mcp.server.fastmcp import FastMCP, Context
from pydantic import BaseModel, Field
from uuid import uuid4


class Task(BaseModel):
    """A simple task item."""

    id: str = Field(default_factory=lambda: uuid4().hex)
    title: str
    done: bool = False
    tags: list[str] = []


Task.model_rebuild()

STORE: dict[str, dict] = (
    json.loads(Path("tasks.json").read_text()) if Path("tasks.json").exists() else {}
)

mcp = FastMCP(name="MyMCP", debug=True, json_response=True)


@mcp.tool("add")
def add(a: int, b: int) -> int:
    return a + b


@mcp.tool("subtract")
def subtract(a: int, b: int) -> int:
    return a - b


@mcp.tool("add_task")
def add_task(title: str, ctx: Context, tags: Optional[list[str]] = None) -> Task:
    task = Task(title=title, tags=tags or [])
    STORE[task.id] = task.model_dump()
    Path("tasks.json").write_text(json.dumps(STORE, indent=2))
    ctx.log(message=f"Added task: {task.title} (ID: {task.id})", level="info")
    return task


@mcp.resource("task://all")
def list_tasks(ctx: Context) -> list[dict]:
    ctx.log(message=f"Listing all tasks. Total: {len(STORE)}", level="info")
    return [Task.model_validate(task).model_dump() for task in STORE.values()]


@mcp.tool("complete_task")
def complete_task(task_id: str, ctx: Context) -> Task:
    task = Task.model_validate(STORE[task_id])
    task.done = True
    STORE[task_id] = task.model_dump()
    Path("tasks.json").write_text(json.dumps(STORE, indent=2))
    ctx.log(message=f"Completed task: {task.title} (ID: {task.id})", level="info")
    return task


@mcp.resource("task://{task_id}")
def get_task(task_id: str, ctx: Context) -> Task:
    return Task.model_validate(STORE[task_id])


@mcp.tool("clear_completed_tasks")
def clear_completed_tasks(ctx: Context) -> None:
    global STORE
    STORE = {
        task_id: task
        for task_id, task in STORE.items()
        if not Task.model_validate(task).done
    }
    Path("tasks.json").write_text(json.dumps(STORE, indent=2))
    ctx.log(message="Cleared completed tasks.", level="info")


@mcp.prompt(title="Write a status note")
def status_note(title: str):
    """Suggest a short status line for a task title."""
    return [
        {
            "role": "system",
            "content": {
                "type": "text",
                "text": "You are a concise assistant who writes status notes.",
            },
        },
        {
            "role": "user",
            "content": {
                "type": "text",
                "text": f'Create a one-line status note for the task: "{title}"',
            },
        },
    ]


# app = mcp.streamable_http_app()
if __name__ == "__main__":
    mcp.run(transport="streamable-http")
