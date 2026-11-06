# DELTIX — Go Coding Rules

These rules apply to all DELTIX backend code.

## 1. Functions

- Write small functions with one clear responsibility.
- Use multiple focused functions to make the main workflow easy to read.
- A function should perform one logical task, not an entire feature.
- Split validation, transformation, persistence, policy evaluation and execution into separate functions when they have distinct responsibilities.
- Keep orchestration functions readable: they should describe the sequence of work.
- Do not create tiny helper functions that add no meaningful abstraction.
- Avoid deeply nested conditionals; use early returns.
- Keep function parameters limited and meaningful. Group related values into a type when that improves clarity.

## 2. Naming

- Use names that explain intent and domain meaning.
- Prefer `NormalizePaymentEvent` over `Process`.
- Prefer `sourceEvent` over `e` and `incidentRepository` over `repo` when the longer name improves understanding.
- Use consistent terminology across the project.
- Avoid unclear abbreviations and generic names such as `data`, `handler`, `manager` or `util` when a domain-specific name is possible.
- Follow standard Go naming conventions: `MixedCaps`, not `snake_case`.

## 3. Packages and responsibilities

- Each package must have one clear domain responsibility.
- Keep related types and functions together.
- Do not mix HTTP handling, business rules, database queries and external API calls in one function.
- Keep domain logic independent of HTTP and database implementation details.
- Avoid circular dependencies.
- Do not create packages solely to hold one trivial function.

## 4. Dependencies

- Pass dependencies explicitly through constructors.
- Define interfaces where they provide a useful boundary, especially around storage and external services.
- Keep interfaces small and focused.
- Do not use global mutable state.
- Do not hide important dependencies inside helper functions.
- Make time, ID generation and external clients replaceable in tests when needed.

## 5. Error handling

- Always handle returned errors.
- Never silently ignore an error.
- Add useful context while preserving the original error with `%w`.
- Return errors to the layer that can make the correct decision.
- Do not log an error and then pretend the operation succeeded.
- Use sentinel or typed errors for conditions callers need to distinguish.
- Keep transport-specific errors, such as HTTP status codes, out of domain logic.

Example:

```go
normalized, err := normalizer.Normalize(event)
if err != nil {
    return fmt.Errorf("normalize payment event: %w", err)
}
```

## 6. Context and concurrency

- Pass `context.Context` as the first parameter to operations that perform database, network or other interruptible work.
- Do not store request contexts in structs.
- Respect cancellation and deadlines.
- Protect shared state from concurrent access.
- Do not start goroutines without a clear owner and shutdown strategy.
- Avoid introducing concurrency when sequential execution is sufficient.

## 7. Validation and data handling

- Validate untrusted input at system boundaries.
- Keep validation rules close to the domain type they protect.
- Do not assume webhook payloads or event fields are trustworthy until their source has been verified.
- Use explicit types for important domain concepts and states.
- Use UTC for stored timestamps.
- Avoid passing unstructured maps when a defined struct is practical.
- Do not store API secrets, access tokens, card data or unnecessary personal data in logs or incident evidence.

## 8. Database and external side effects

- Keep database operations behind repository or storage boundaries.
- Use transactions when multiple database changes must succeed together.
- Do not keep a database transaction open while calling an LLM or external provider.
- Make writes and external side effects explicit.
- Use unique constraints and idempotency keys to protect against duplicate processing.
- Persist action intent before executing an action.
- If an external request times out, treat its outcome as unknown until it is reconciled.
- Never retry a money-moving operation merely because the response was lost.

## 9. DELTIX AI and action-safety rules

- Treat LLM output as untrusted input.
- Require structured output and validate it before use.
- Every factual claim in an investigation must reference evidence.
- Keep verified facts, hypotheses and unknowns separate.
- The LLM may investigate and propose actions; it must not authorize them.
- Only deterministic policy code can allow, require approval for or deny an action.
- Execute only explicitly registered action types.
- Check action preconditions immediately before execution.
- Require human approval for sensitive actions.
- Verify the postcondition independently before marking an incident resolved.
- Never let model-generated text become executable code, SQL or shell commands.

## 10. Comments

- Write comments to explain why something is necessary, a non-obvious constraint or a surprising behavior.
- Do not write comments that repeat the code.
- Keep comments short and accurate.
- Update or remove comments when behavior changes.
- Add Go documentation comments to exported identifiers when their purpose or constraints are not obvious.

Good:

```go
// A provider timeout does not prove that the capture failed.
// Reconcile provider state before considering another attempt.
```

Avoid:

```go
// Validate the event.
if err := event.Validate(); err != nil {
    return err
}
```

## 11. Testing

- Test observable behavior, not private implementation details.
- Cover normal cases, invalid input and failure paths.
- Test duplicate event delivery and idempotency.
- Test database and provider failures.
- Test unknown external outcomes.
- Test policy decisions for allowed, approval-required and denied actions.
- Test that failed verification never marks an incident as resolved.
- Use table-driven tests when multiple inputs exercise the same behavior.
- Use fakes for external dependencies in unit tests and real PostgreSQL in integration tests.

## 12. Code quality

Before submitting code:

- Run `gofmt`.
- Run `go vet ./...`.
- Run `go test ./...`.
- Run `go test -race ./...` when practical.
- Remove dead code, unused variables and debug prints.
- Do not add dependencies without a clear need.
- Do not add abstractions for hypothetical future requirements.
- Keep changes focused and reviewable.

## Core standard

**Write code that is easy to understand, test and safely change. Use meaningful names, multiple focused functions, explicit dependencies, clear errors and minimal useful comments.**
