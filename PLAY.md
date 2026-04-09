# Google Play Console Setup Guide

Reference for completing the "Finish setting up your app" checklist for BracketUp.

---

## Let us know about the content of your app

### Set privacy policy
- The LICENSE file is **not** a privacy policy — you need a separate one.
- Create a `PRIVACY.md` in the repo with the text below, then link to its raw URL.
- URL: `https://raw.githubusercontent.com/lbellows/bracket-up/refs/heads/main/PRIVACY.md`
- Paste this URL into the Play Console field.

**Suggested PRIVACY.md content:**
```
# Privacy Policy for BracketUp

Last updated: 2026-04-08

BracketUp does not collect, transmit, store, or share any personal data.

All tournament data you create is stored locally on your device using Android's
standard app storage. It is never sent to any server, third party, or cloud service.

The app does not use analytics, advertising, crash reporting, or any network services.

If you have questions, contact: [your email]
```

### App access
- Select **"All functionality is available without special access"** — no login required.

### Ads
- Select **"No, my app does not contain ads"** — BracketUp has no advertising.

### Content rating
- Complete the IARC questionnaire.
- Expected answers: no violence, no sexual content, no user-generated content shared online, no location data, no personal info collected.
- Expected rating: **Everyone (E)** / PEGI 3.

### Target audience
- Primary age group: **18 and over** (adults organizing tournaments).
- If you want to include teens: **13 and over** is reasonable since there is no chat, UGC, or social features.
- Does not appeal primarily to children: confirm **No**.

### Data safety
BracketUp collects and shares **no data**. Fill out the form as follows:
- Does your app collect or share any of the required user data types? **No**
- Is all data encrypted in transit? N/A (no data transmitted)
- Does your app provide a way for users to request data deletion? N/A (no account, data is local only)

### Government apps
- Select **"No"** — BracketUp is not a government app.

### Financial features
- Select **"No"** — BracketUp does not handle payments, banking, or financial transactions.

### Health
- Select **"No"** — BracketUp does not involve health or medical data.

---

## Manage how your app is organized and presented

### Select an app category and provide contact details
- **Category:** Sports  *(or "Games > Board" if you prefer)*
- **Tags:** Tournament, Bracket, Sports, Competition
- **Email:** your contact email
- **Website:** optional (repo URL or landing page)
- **Phone:** optional

### Set up your store listing
Fill in the following:

| Field | Suggested content |
|---|---|
| App name | BracketUp |
| Short description (80 chars) | Create and track double-elimination tournament brackets |
| Full description (4000 chars) | See template below |
| App icon | 1024×1024 PNG, no alpha (`assets/icon.png`) |
| Feature graphic | 1024×500 PNG banner |
| Screenshots | At least 2 phone screenshots (1080×1920 or similar) |

**Full description template:**
```
BracketUp makes it easy to run double-elimination tournaments for any sport or game.

• Add your participants, generate a full bracket automatically
• Record match results with scores on the spot
• Track wins, losses, and automatic advancement through Winners and Losers brackets
• Grand Final reset support — because every comeback story deserves a chance
• Export results as JSON or a plain-text summary to share with your group

No account needed. No internet required. All your tournament data stays on your device.

Perfect for table tennis, ping pong, pool, darts, foosball, esports, chess, or any head-to-head competition.
```

---

## Set up pricing

### Create a merchant account
- Required since you are charging for the app.
- Fill out the public merchant profile as an individual (no business entity needed).
- Business name: your real name or a DBA like "LB Apps"
- Website: GitHub repo URL is fine
- What do you sell: "Apps and games"
- Credit card statement name: something short like "BRACKETUP" or "LB APPS"
- You are agreeing as an individual — this is normal and fine for solo developers.

### Set the price of your app
- Set your price in the "Countries and regions" section after saving the merchant profile.
- Note: once an app is set to paid, you **cannot** change it to free later (Google policy). You can lower the price or run sales, but not go free.
- Consider starting at $0.99–$2.99 for a utility app.
