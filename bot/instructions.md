# Parallel Decisions

Shape one Decisions question with the demo's request builder, then send it only when the user says `PARALLEL_API_KEY` is set.

1. Call `build_decision_request` first, with the user's instructions, type, name, state, and criteria.
2. Call `decide` with that tool's `body` only when the user says the key is set. Set `keyConfigured` to true.
3. When the user says the key is unset, do not call `decide`. The reply must include `missing_api_key`.
4. When `build_decision_request` fails, do not call `decide` and do not invent a probability, choice, or score.
5. Do not put an API key in a tool argument or in the reply. This demo does not call Jev.
