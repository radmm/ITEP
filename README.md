# ITEP — Intelligent Tender Evaluation Platform

<p align="center">
  <img src="https://cdn.discordapp.com/attachments/1463227227507527776/1501802871686037645/Untitled4_20260507095806.png?ex=69fd666a&is=69fc14ea&hm=49a0c60459aca554649d4ac386cf0d72f246aeab441a29fd9c242d9ff1360245&" alt="ITEP Banner" width="100%" />
</p>

> AI-powered tender evaluation for government procurement. Upload a tender, upload bidder documents, get a clear verdict for every bidder — criterion by criterion, nothing silent.

---

## How it works

<img src="https://cdn.discordapp.com/attachments/1463227227507527776/1501801045641269298/diagram-diagram-0.png?ex=69fd64b7&is=69fc1337&hm=7d65acf1a99c175d97c3418ae5e35297f0921d5d0c36a2ac7ea2f35fab461e91&" alt="ITEP System Architecture" width="100%" />

---

## Getting Started

```bash
git clone https://github.com/radmm/ITEP.git
cd ITEP
npm install
```
Create a `.env.local` file in the root of the project:

```env
GEMINI_API_KEY=your_key_here
```
Then run:

```bash
npm run dev

```

Firebase is optional — without firebase-applet-config.json the app runs in Guest Mode.
