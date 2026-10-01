# Writing standard

How we write everything in modelWrecker: docs, comments, CLI help, reports, commit messages. The goal is
simple: anyone, including a strong junior engineer or a new teammate, can read a page once and understand
it. Follow this for every document.

## Rules

1. **Use simple, plain English.** Short sentences. Common words. Explain it the way you would to a smart
   person who is new to the topic.
2. **No em dashes.** Use a hyphen `-` instead. (Em dash `—` and en dash `–` are both banned; use `-`.)
3. **No emoji.** Anywhere. Not in docs, headings, tables, commit messages, or code comments.
4. **Explain a term the first time it appears.** For example: "the judge (the part that decides if an
   attack worked)". After that, just use the term.
5. **Say the important thing first.** Lead with what the reader needs; put detail after.
6. **Active voice.** "The planner picks a strategy", not "a strategy is picked by the planner".
7. **One source of truth per topic.** Do not copy a long explanation into five files. Link to the one
   place that owns it.
8. **Small examples beat long prose.** Show a short config, command, or snippet.
9. **Keep lists and tables short.** If a table has twenty rows, split it or summarize.
10. **Do not sound academic to sound smart.** "The judge checks if the attack worked" beats "the
    evaluation subsystem performs semantic verification of adversarial objective satisfaction".

## Diagrams (Mermaid)

- Every major system gets a **small** Mermaid diagram. Several small diagrams beat one giant one.
- Prefer `flowchart TD`, `flowchart LR`, or `sequenceDiagram`.
- **Do not use `<br>`.**
- **Do not put parentheses `()` in a subgraph title or a node label** - Mermaid fails to parse them. Use
  words instead, or quote a subgraph title: `subgraph id ["Title with safe text"]`.
- Keep diagrams readable; if a diagram needs a legend, it is too big - split it.

## Structure of an architecture doc

Each important doc should cover, in simple terms: Purpose, Responsibilities, Inputs, Outputs,
Dependencies, Failure cases, Security considerations, an Example, and a Mermaid diagram. Not every doc
needs all of these, but a core one usually does.

## Checklist before you finish a doc

- [ ] No em dashes or en dashes (only `-`).
- [ ] No emoji.
- [ ] New terms explained on first use.
- [ ] Mermaid parses (no `<br>`, no parentheses in subgraph titles or node labels).
- [ ] Links instead of copied explanations.
- [ ] Matching rows updated in [`../DOCUMENTATION.md`](../DOCUMENTATION.md).
