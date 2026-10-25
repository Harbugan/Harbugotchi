# 🦀 Harbugotchi

En lille manga-krabbe (tamagotchi) der kører i browseren – bygget til telefonen.

## Kør den
Ingen build. Server mappen statisk og åbn på telefonen:

```
python3 -m http.server 8000
```

Åbn siden i mobilbrowseren og vælg *Føj til hjemmeskærm* for at få den som app (virker offline).

## Version 1
- Æg → Baby → Barn → Teen → Voksen (udseende afhænger af hvor godt du har passet den)
- Behov: mad, glæde, energi, renlighed – falder også mens appen er lukket (mildere)
- **Mad** (rejer/slik), **Kæl** (knap eller stryg hen over krabben), **Leg** (minispil), **Sov** (sluk lyset), **Vask** (bæ), **Medicin** (syg)
- **Straf** virker kun når krabben driller (❗) – straffer du uden grund bliver den ked af det
- Gemmes automatisk i `localStorage`

Tip: tilføj `?speed=60` til URL'en for at spole tiden frem (test).
