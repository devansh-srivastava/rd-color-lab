# RD Color Lab

Level 1 of a cooperative color sorting game for Devansh and Riddsss.

Open the site on both phones, enter **112211**, and choose one name per phone. The game begins when both screens show **Connected**. Each player sees their own colors and the shared tube. Private colors start hidden from the other player; **Reveal mine** shows them until that player hides them again.

The room uses Firebase Anonymous Authentication and Realtime Database. Firebase Web config is public browser configuration, but this repository keeps it out of source files. Put the seven values in the ignored `.env.local` file for local development and in GitHub Actions secrets for deployment. Never use a service-account key.

## Local development

```bash
npm ci
npm run dev
```

Use `npm test` for the established Level 1 rules and `npm run build` for the production bundle. Deploy `database.rules.json` to the Firebase project before using the hosted game.
