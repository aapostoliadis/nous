# Agents user-test script

Moderated usability test for the Agents view in Nous. Each session runs about 45 minutes with one participant and one facilitator. A second person taking notes is optional.

## What we want to learn

1. Can people go from a goal to a working agent without help?
2. Do they understand what the agent can reach? This covers the web search toggle on the CONNECTIONS step and the "Unavailable" rows.
3. While a run is in progress, do the live steps and the timer tell them what is happening?
4. Can they read the report card and act on it? This covers the stats, the ranked items with Urgent / Drafted / Uncertain tags, the sources, and "Handed back".
5. Can they find earlier results and agents again in Ready for you and My agents, and change things in Settings?

## Participants

- 5 to 6 people. That is enough to find most problems in one round.
- Screener:
  - They use ChatGPT or Claude at least weekly.
  - They do recurring knowledge work, such as inbox triage, weekly reports or research.
  - They have not used Nous before.
- Mix: at least two people who have never set up an automation or "agent" tool, and at least one who has (for example Zapier, Custom GPTs or Robyn).

## Setup (before each session)

- [ ] Open https://nous-omega-murex.vercel.app/#agents in a fresh browser profile, so localStorage `nous-agents-v1` starts empty.
- [ ] Add the facilitator's test API key through Settings → Manage API keys. Never ask the participant for their own key. Cap spend on the provider dashboard first.
- [ ] Pick a model that supports web search for task 4.
- [ ] Start screen and audio recording only after consent.
- [ ] Have a stopwatch ready to time each task.
- [ ] After the session, use Settings → delete all agents, results and drafts, then close the profile.

## Introduction (3 min, read aloud)

> Thanks for helping. We're testing the product, not you. There are no wrong answers. If something is confusing, that's exactly what we need to hear.
>
> Please think aloud as you go: what you're looking at, what you expect to happen, what surprises you. I may not answer questions during tasks, because I want to see what you'd do alone. I'll help at the end.
>
> The tool uses a real AI model, so its answers can be wrong. Treat them as you would a draft from a new colleague.
>
> Is it OK if I record the screen and audio? The recording is only used by the team and is deleted after analysis.

## Warm-up (3 min)

- "Tell me about a task you repeat every week that you'd like someone else to do first."
- Write down their answer. Task 2 uses it as the goal.

## Tasks

Read each task aloud and hand it over on a card. Don't name buttons or tabs. Record for each task: success (unaided / with a hint / failed), time taken, and the observations listed below it.

### Task 1: First look (2 min)

> "You've just opened this. Without clicking anything, what do you think this page is for, and what would you do first?"

Observe:
- Do they work out that the tabs are Ready for you, My agents, Templates and Settings?
- Do they notice "+ New agent"?
- What do they think "Thinking workspace ↗" is?

### Task 2: Build your own agent (10 min)

> "Set up something that would handle the weekly task you just told me about."

Success: an agent is saved and shows in My agents.

Observe:
- Is the goal they type specific enough? How do they react to the follow-up questions?
- Do they use the "YOUR AGENT" side panel (ANSWERS / WORKS WITH / RESULTS / RUNS)?
- Do they notice "AUTOSAVES" and "Save & exit"? Do they expect to lose their work if they leave?
- On the name and instructions step: do they edit what the model wrote, or accept it?

### Task 3: What can it reach? (5 min, on the CONNECTIONS step)

Ask this when they reach "What can it work with?":

> "Before you continue, tell me in your own words what this agent will and won't be able to see."

Follow-up probes:
- "Is web search on or off right now? What would change if you turned it on?" (It is off by default.)
- "What does 'Unavailable' next to Email and calendar mean to you?"
- "Where do you think your data goes when it runs?"
  - The correct answer: your browser and your chosen provider, plus the web if search is on.

Success: they correctly state the default (no web) and the effect of turning it on.

### Task 4: Run it (6 min)

> "Turn on web search if it's not already on, and get the agent to do its job now."

While it runs, ask once: "What's it doing right now?"

Observe:
- Can they read the live steps: "Searching the web", "Searching “…”", "Reading N sources", "Writing"?
- Do they notice the timer? Does the wait feel acceptable?
- Do they try Stop? Do they understand what it does?
- If a run fails (for example "search ran long"), can they recover?

### Task 5: Read the result (6 min)

> "Tell me what the agent found and what you'd do next."

Probes:
- "Which item needs you most urgently? How can you tell?" This checks the order of the ranked list and the Urgent tag.
- "What does 'Uncertain' mean here? What would you do about it?"
- "Where did this information come from?" This checks whether they open SOURCES.
- "How long did it take?" This checks "Handed back · Xm Ys".
- "How much do you trust this? What would change that?"

Success: they name the top item, explain one tag correctly and find a source.

### Task 6: Templates (4 min)

> "A colleague says there's a ready-made agent for turning meeting notes into actions. Find it and set it up."

Success: they find Meeting to actions in Templates and use Use template.

Observe: do they notice what a template already filled in, and do they change it?

### Task 7: Come back later (4 min)

Reload the page first.

> "It's the next morning. Find what your agent produced yesterday, mark it as dealt with, then run it again."

Success: they find the run in Ready for you, use Mark reviewed, and start Run again from My agents or from the result.

Observe: do they understand the difference between Ready for you and My agents?

### Task 8: Settings (3 min)

> "You'd like to use a different AI model for your agents, and get a notice when a run finishes. Then run your agent again with a short answer."

Success: they change the model in Settings, turn on "Tell me when a run finishes", and pick Short in the answer-length menu next to the run box.

Observe:
- Do they look for answer length in Settings first? It is set for each run.
- Do they understand that the model choice also applies to Ask in the workspace?

## Post-test questionnaire (5 min)

1. System Usability Scale: the standard 10 items, each rated 1–5.
2. Single Ease Question for Task 2 and Task 5: "How easy was this?" rated 1–7.
3. Open questions:
   - "What would stop you using this every week?"
   - "What did you expect it to do that it didn't?"
   - "If you could connect one more thing (email, calendar, drive…), which would it be and why?"
   - "Compared to just asking ChatGPT or Claude directly, what's better or worse here?"

## Debrief (3 min)

- Answer any questions they held back during the tasks.
- Explain anything they got wrong if it affects their trust in the tool, for example what web search sends out.
- Thank them and arrange the incentive.

## Facilitator rules

- Don't help during a task. If they are stuck for 90 seconds, give one hint ("What would you look for?"), then a direct pointer. Record the level of help each time.
- Never say "agent", "template" or "report" before the participant does. Use their words.
- If a run costs more than expected or returns something inappropriate, stop the run and move on.

## Note-taking grid

| Task | Success (U / H / F) | Time | Quotes | Problems seen | Severity (0–4) |
|---|---|---|---|---|---|
| 1 First look | | | | | |
| 2 Build | | | | | |
| 3 Connections | | | | | |
| 4 Run | | | | | |
| 5 Result | | | | | |
| 6 Templates | | | | | |
| 7 Come back | | | | | |
| 8 Settings | | | | | |

Severity: 0 not a problem, 1 cosmetic, 2 minor, 3 major, 4 blocks the task.

## After all sessions

- Merge the problems seen across participants. Count how many people hit each one and rank by severity × frequency.
- Report: the top 5 problems with clips or quotes, task success rates, average SUS, and what worked.
