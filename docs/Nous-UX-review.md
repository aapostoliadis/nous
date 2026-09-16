# Nous UX review

16 September 2026 · Implemented improvements and prioritised findings

Nous now supports a more usable inspection loop: find an object, inspect its context, move between views and preserve the result. The requested red rejection state, Map zoom and audio workflows are implemented. The next product priority should be making relationships as editable and trustworthy as the objects themselves.

This review used UI UX Pro Max's accessibility, interaction, responsive layout, typography, forms and feedback checks. Its generic landing-page recommendation was not applied to an existing workspace. The Nous identity and supplied Figma direction were preserved.

## Changes delivered

| Area | Finding | Implemented result |
|---|---|---|
| Rejection states | Rejected looked neutral and resembled Superseded. | Rejected and Declined use dark red text on a pale red background. Rejected text contrast is **6.07:1**. The text label remains, so colour is not the only signal. Superseded stays neutral. |
| Decision vocabulary | The state legend highlighted Decided regardless of actual decisions. | Removed the misleading fixed highlight; individual objects continue to display their real state. |
| Map navigation | Full screen fitted content, but there was no readable inspection scale or zoom control. | Bottom-right zoom out, zoom in, percentage/Fit and full-screen controls. Background drag pans the view; keyboard arrows pan, +/− zoom and 0 fits. Full screen uses the app viewport consistently. |
| Map completeness | Several existing objects were absent from Map, including other decisions and sources. | Every branch object now appears either in the main diagram or the additional-object grid, with state labels. |
| Audio | Audio models were excluded from the model menu and had no usable input/output workflow. | Four dedicated workflows: transcription, read aloud, audio conversation and live voice. Model groups distinguish these from text models. |
| Audio persistence | Generated audio could not be retained as workspace content. | Preview, save as an artifact, replay and download. Transcripts use workspace storage; audio blobs use local IndexedDB. Reload persistence was checked. |
| Context | The inspector repeated a fixed list of example facts and questions. | Current thinking and open questions now come from the active branch and link directly to their objects. Claims and assumptions are not labelled established facts. |
| Keyboard access | View tabs lacked arrow-key navigation; object selection lost focus during rerendering. | Roving tab focus, Home/End and arrow keys, associated tab panels, a skip link, named dialogs, and focus moved to the selected object's heading. |
| Mobile reading | The sticky command panel covered a substantial portion of the work area. | Command controls now follow the content on mobile. Document views and the inspector avoid nested scrolling there. Map keeps its bounded viewport. |
| Touch and readability | Small controls and text made compact layouts difficult to use. | Larger map, refresh, help, dialog and mobile command targets; larger body/provenance text; visible focus outlines; mobile form text at 16 px. |
| Status accuracy | The local action preview said no external service was connected even with model APIs configured. | Copy now correctly describes the scope of that particular local action. |
| Motion and feedback | New asynchronous audio work needed the same feedback as Ask. | Thinking-orbs show connection/work status, with adjacent text, disabled duplicate submission and cancellation. Reduced-motion behaviour remains supported. |

## Audio interaction details

| Mode | Input and result | Storage and control |
|---|---|---|
| Transcribe recording | Audio file, maximum 12 MB. Produces text; diarization models add speaker labels and timestamps. | Review and save a transcript artifact. Keep the original recording separately for verification. |
| Read aloud | Up to 4,000 characters and a voice. Produces AI-generated speech. | Preview, download or save an audio artifact. |
| Audio conversation | A question, optionally with WAV/MP3 audio. Produces a spoken answer and transcript. | Output remains a draft until saved. |
| Live voice | Start voice explicitly requests microphone access and opens a WebRTC session. | Stop ends the session and prepares its transcript for saving. Close/Escape release the microphone. Five-minute automatic limit. |

The verified account catalogue contains **28 supported OpenAI audio variants**: 7 transcription, 7 speech, 6 audio conversation and 8 live voice. Availability is discovered from the account rather than promised from a fixed list. Claude remains available through Ask to analyse saved transcripts. GPT-Live, live translation, transcription-only Realtime sessions, image generation and specialist research are separate, unimplemented workflows.

Only text/topic and recordings entered in Audio tools are sent to OpenAI. The entire workspace is not sent automatically. Voices are explicitly labelled AI-generated. Keys stay on the local server. Browser-stored audio and credentials are excluded from the prototype ZIP.

The endpoint choices follow the official [file transcription](https://developers.openai.com/api/docs/guides/speech-to-text), [text-to-speech](https://developers.openai.com/api/docs/guides/text-to-speech), [audio conversation](https://developers.openai.com/api/docs/guides/audio-chat-completions) and [WebRTC](https://developers.openai.com/api/docs/guides/voice-webrtc) documentation.

## Remaining priorities

P1 means address before relying on Nous for sustained real project work. P2 means the next usability iteration. These are recommendations, not features claimed as implemented.

| Priority | Issue and user consequence | Recommended next change | Acceptance criterion |
|---|---|---|---|
| P1 | The main Map connectors are still a composed illustration. Additional objects have inspectable links but no generated edges. Visual relationships can diverge from the underlying objects. | Derive every edge and label from explicit relationship data; add accessible relationship editing and automatic layout. | Adding, changing or removing a relationship updates both the diagram and inspector; no decorative edge claims a relationship absent from the data. |
| P1 | Evidence cards infer “supports” or “complicates” from list position. New evidence therefore inherits an interpretation that the user did not choose. | Record the relationship's meaning explicitly, with a neutral unclassified state. | Reordering evidence does not change its meaning; users can mark support, contradiction or context. |
| P1 | “Ready” means a credential is configured and discovery succeeded. It does not establish generation access or sufficient credits. | Separate “Connected” from request health; keep actionable quota/access failures visible beside the selected model. | A billing failure cannot immediately appear as a healthy generation connection without qualification. |
| P1 | Persistence is tied to browser origin. There is no restorable workspace backup, and clearing site data removes objects and audio. | Add an explicit local backup/recovery strategy as a separate product decision, without restoring the removed Export workspace button by default. | Recovery restores branch identities, links, decision rationale and audio references together. |
| P2 | A catalogue approaching 100 models is demanding to navigate. Task grouping helps, but discovery still requires knowing model names. | Search, favourites and short capability labels, with an expandable dated-version group. | Users can find a named model by typing and understand whether it supports text, speech, transcription or live voice. |
| P2 | Objects have no workspace-wide search/filter. Large maps and the five-item context summary become difficult to scan. | Add object search and filters for type, state and branch; keep selection shared across views. | Find any object by title without panning through the entire map. |
| P2 | Object states are not fully tailored to their types. Questions lack a direct resolved workflow; branch “Active” metadata can differ from the branch being viewed. | Define type-specific states and separate branch lifecycle from “You are here”. | Users can resolve and reopen questions; exactly one branch is labelled the current location. |
| P2 | Closing or changing an audio workflow discards an unsaved preview. Editing a saved spoken draft's text does not regenerate its audio. | Retain recoverable audio drafts and expose an explicit regenerate action with version provenance. | A changed script cannot imply that an older recording contains the new wording. |
| P2 | Compact secondary labels and scaled map content still need closer inspection at high zoom and on real touch devices. | Complete a contrast inventory and test large text, screen readers and mobile gestures on actual devices. | Meet the chosen accessibility target with measured evidence, rather than infer conformance from visible focus rings alone. |

## Verification performed

| Check | Result |
|---|---|
| Map, Branches, Evidence, Decisions and Document at 375, 768, 1024 and 1440 px widths | All **20 combinations** had no page-level horizontal overflow. Map controls appeared only in Map. |
| Rejected pill | Computed colours verified: `#ad231b` on `#feeceb`; 6.07:1 contrast. |
| Map controls | Zoom in/out, fit, keyboard pan, app full screen and Escape tested. Full-screen surface overflow remained hidden. |
| Cross-view decisions | Changed the pilot to Rejected with a rationale in an isolated workspace; Document reflected that state. |
| Branching | Created a branch and reloaded; the new branch and copied objects persisted. |
| Keyboard navigation | Arrow-key transition between Decisions and Document verified. Focus and semantic relationships inspected. |
| Speech fixture | Generated preview controls, saved artifact and audio download link, then verified audio reference persistence after reload. |
| Transcription fixture | Uploaded a synthetic WAV to a local fixture server; observed loading and transcript preview. No personal recording was used. |
| Audio failures | Provider-error feedback and cancellation retained input. Duplicate submission was disabled during processing. |
| Provider adapters | Tests passed for transcription, diarization, speech, audio conversation and WebRTC request formatting; file validation, unsafe/unsupported input rejection and safe error handling. |
| Existing text workflow | Request lifecycle, draft provenance, candidate decisions, stale-context rejection, cancellation, missing credentials and local-command tests passed. |
| Motion | Existing orb tests passed for reduced motion, visibility pause, cleanup and pixel-density limits. |
| Browser errors | No JavaScript errors were reported in the final isolated review tab. |

These checks combine browser interaction, rendered-state inspection and fixture-based provider tests. **No paid audio request or actual microphone session was run.** Live voice needs an end-to-end acceptance test with microphone permission and provider access. Desktop responsive emulation does not validate physical-device gestures, screen readers, Safari/Firefox behaviour or every possible large workspace. This is a UX review, not accessibility certification.

The original Medium figures predate these changes and remain labelled as earlier captures in the README. They were not regenerated in this update.
