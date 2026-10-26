# RD Color Lab

Level 1 of a cooperative color sorting game for Devansh and Ridhima.

Open the site on both phones, enter **112211**, and choose one name per phone. Devansh's phone hosts the room; keep that browser tab open while playing. The game starts when both phones show **Connected**.

Each player sees their own colors and the shared tube. Their private colors start hidden from the other player. **Reveal mine** lets a player show their colors to the other phone; they can hide them again at any time.

The two browsers connect using PeerJS's public signaling service and a direct WebRTC data channel. There is no Firebase project or key to configure. The room state is saved in Devansh's browser so a refresh can restore it. Both phones need an active internet connection, and some restrictive networks may block direct connections.

## Local development

```bash
npm ci
npm run dev
```

Use `npm test` to check the established Level 1 rules and `npm run build` to check the production bundle. Sound and background music start after the first tap, as required by phone browsers.
