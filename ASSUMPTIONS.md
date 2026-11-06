ASSUMPTIONS I MADE (please correct anything wrong – tell me the rule and I'll change the engine)

SCOPE
- Pre-APOC game only. When SHTF triggers, everyone does the Panic Grab, the board is cleared, and the game ends telling you which Mission Pack (AI / Virus / Nuclear) to open. Post-APOC is not built.
- 5 same-type news cards on the stand escalate DEFCON (green → yellow → orange → red/SHTF). End Times event cards in the PDF were lorem ipsum, so they have no effect.

BOARD (I read it from the image – use Graph mode to check it!)
- Press "Graph" once to see the movement graph, twice to EDIT: drag nodes into place, then "Export board.json" and send it to me.
- Sectors are an even 3×3 split of the board. Building entrances are snapped to the nearest street segment (some may be wrong).
- Orange/yellow outlines on buildings: meaning guessed. Theater, Gas Station, Music Store/Pet Store entrances are ambiguous.
- Bridges for the Boat are not modelled. Subway stations = the "S" markers; ride costs 1 PrepCoin to any other station.
- Board aspect is 3:2 from the image (2576×1717); the 3D board is 800 mm wide and scaled from that.

RULES I HAD TO GUESS
- PrepCoin is an unlimited bank; resource tokens are limited to the supply counts.
- Bunkered preppers' resources can't be robbed in fights (only coin).
- Kevlar vest: auto-used (4 tokens, then goes back to the deck). Hazmat suit: 3 charges.
- Moonshine = ignore health loss until your next turn.
- Steal that gets you busted keeps the stolen goods. A failed loot loses the looted items back to the location.
- Combat modifiers stack. Damage = difference of rolls capped at 3 (min 1 on a natural 1 / 6 rule as coded).
- Night dice are blocked by the Curfew event. Tagged preppers must use the day dice.
- Jessica: Forager = +1 food when visiting the park once per turn; ending the turn there brings the bonus to 2 total. Re-roll the day dice once (keep the new result).
- Drone is an action. Walkie-Talkie only recruits a thug remotely. Thug upkeep paid once at the start of the turn.
- "Scavenge" = dumpster dive. At 0 HP with no meds you spend the turn resting (+1 HP).
- Frost's gun bonus applies to the Rifle recipe only (−1 Know-how). Naomi: free Chem when she's short (once per turn), and 5 moves.
- Naomi's Detention: attacker's choice vs random – I used random.
- Red APOC die in the dice PDF is unused. Night "found 1 resource" lets you choose which.
- Card typo: card 15 text in the news deck was read as written.

AI OPPONENTS
- Simple heuristic bots: they fill seats and exercise the rules, but they're passive and sometimes starve. They are not a balance test.

TEST TOOLS
- Sandbox (lobby tickbox): give/take resources, coin, health, items; set DEFCON; teleport; trigger APOC.
- Undo (host/solo only), Export (full state + log JSON for bug reports), seed box in the lobby for repeatable games.
- Online: host opens a room, others join with the 5-letter code (PeerJS peer-to-peer; needs the public PeerJS broker, so it can fail behind strict firewalls). Unfilled remote seats become AI.
