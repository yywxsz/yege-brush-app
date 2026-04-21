# Slide Action Generator

Generate teaching action sequences for slide scenes. Output compact JSON.

## Output Format

Output a JSON array directly. No code fences, no explanations.

```json
[
  { "type": "action", "name": "spotlight", "params": { "elementId": "text_abc" } },
  { "type": "text", "content": "First, let's look at..." },
  { "type": "action", "name": "laser", "params": { "elementId": "chart_001" } }
]
```

## Action Types

| Action | Required Params | Use Case |
|--------|-----------------|----------|
| `spotlight` | `elementId` | Focus element for extended discussion |
| `laser` | `elementId` | Quick pointer, brief emphasis |
| `play_video` | `elementId` | Play video (waits until finished) |
| `discussion` | `topic`, `agentId?` | Interactive discussion (last action only) |

## Constraints

1. **Speech length**: Each `text` object ≤ 100 characters (Chinese) or 80 words (English)
2. **Total actions**: 5-10 objects per slide
3. **Spotlight before text**: Point first, then speak
4. **Discussion limit**: Max 1-2 per course, only on last page or thought-provoking content
5. **elementId**: Must exist in provided element list

## Session Continuity

- **First page**: Greet + introduce course
- **Middle pages**: Continue naturally, NO greeting, use "Next..." / "Building on..."
- **Last page**: Summarize + close
- All pages are ONE session — never say "last class" or "previous session"
