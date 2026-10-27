# RD Color Lab

A cooperative color sorting game for Devansh and Riddsss with six selectable levels.

Open the site on both phones, enter **112211**, choose one name per phone, and pick any level. Either player can switch levels with the **Back to levels** button. Each level keeps its own progress in the shared room. The game shows who it is waiting for and lets you pour when both screens show **Connected**. Use **Disconnect** to free your station immediately; closing the browser also frees it when Firebase detects the lost connection. Each player sees their own colors and the shared tube. Private colors start hidden from the other player; **Reveal mine** shows them until that player hides them again.

Levels 2–6 have shortest verified solutions of 20, 22, 26, 30, and 38 combined pours. Both players have to use the shared tube. Level 1 remains the original 13-pour puzzle.

The room uses Firebase Anonymous Authentication and Realtime Database. Firebase Web config is public browser configuration, but this repository keeps it out of source files. Put the seven values in the ignored `.env.local` file for local development and in GitHub Actions secrets for deployment. Never use a service-account key.

## Local development

```bash
npm ci
npm run dev
```

Use `npm run build` for the production bundle. Deploy `database.rules.json` to the Firebase project before using the hosted game.
