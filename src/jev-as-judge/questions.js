/** Default eval questions aligned with LangChain "Jev-as-a-Judge" article (Sep 2026). */
export const DEFAULT_EVAL_QUESTIONS = {
  quality: {
    type: "score",
    instructions:
      "How useful is the agent's final answer to the user? Consider correctness, completeness, and clarity.",
    criteria: [
      "1 — Unhelpful or wrong",
      "2 — Partially helpful",
      "3 — Adequate",
      "4 — Helpful",
      "5 — Highly useful",
    ],
  },
  does_pass: {
    type: "noul",
    instructions:
      "Does this agent run pass the eval (successfully addressed the user request with acceptable quality)?",
    criteria: {
      true: "The agent adequately answered the user's request",
      false: "The agent failed or gave an unacceptable response",
    },
  },
  is_grounded: {
    type: "noul",
    instructions:
      "Is the final answer grounded in the retrieved evidence or tool results shown in the agent state?",
    criteria: {
      true: "Answer is supported by evidence in the trace",
      false: "Answer contradicts or ignores available evidence",
    },
  },
  addressed_request: {
    type: "noul",
    instructions: "Did the agent address what the user asked for?",
    criteria: {
      true: "User's intent was addressed",
      false: "User's question was missed or deflected",
    },
  },
  search_outcome: {
    type: "choice",
    instructions: "Which search outcome best describes this run?",
    criteria: {
      searched_appropriately:
        "Used search or tools when needed and used results appropriately",
      searched_unnecessarily: "Called search or tools when not needed",
      failed_to_search: "Should have searched or used tools but did not",
      not_applicable: "No search or tool retrieval was relevant to this request",
    },
  },
};

export const SAMPLE_WEATHER_AGENT_STATE = {
  scenario: "weather-agent (inspired by LangChain Jev eval blog — sample trace text only)",
  user_request: "What's the weather in San Francisco right now?",
  messages: [
    { role: "user", content: "What's the weather in San Francisco right now?" },
    {
      role: "assistant",
      content: null,
      tool_calls: [
        {
          id: "call_1",
          name: "get_weather",
          arguments: { location: "San Francisco, CA", units: "fahrenheit" },
        },
      ],
    },
    {
      role: "tool",
      tool_call_id: "call_1",
      name: "get_weather",
      content:
        '{"location":"San Francisco, CA","temperature_f":72,"conditions":"Partly cloudy","humidity_pct":65}',
    },
    {
      role: "assistant",
      content:
        "In San Francisco it's currently 72°F and partly cloudy, with about 65% humidity.",
    },
  ],
  final_answer:
    "In San Francisco it's currently 72°F and partly cloudy, with about 65% humidity.",
};
