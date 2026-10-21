# Element Lab

An interactive materials lab for exploring formula estimates, jet behavior, chemical data, and nuclear models.

## Pages

- `/` — overview of the lab tools.
- `/lab` — build and save material formulas, then review estimated properties and safety checks.
- `/shooter` — model a fluid jet's flight, breakup, pressure, and strand behavior.
- `/chemicals` — look up compound properties and hazard classifications from PubChem.
- `/elements` — explore nuclear binding energy and stability estimates.
- `/assistant` — ask a lab assistant about materials and science.

## Run locally

```bash
npm install
npm run dev
```

## Deploy on Vercel

Import this repository into Vercel and use the default Next.js settings. No environment variables are needed to deploy the app.

To enable the assistant, add either `ANTHROPIC_API_KEY` or `OPENAI_API_KEY` in the Vercel project's Environment Variables settings, then redeploy. Only one key is needed; if both are set, Anthropic is used. The optional model settings are `ANTHROPIC_MODEL` and `OPENAI_MODEL`.

All material and physics results are estimates from simplified models and published property ranges, not lab results.
