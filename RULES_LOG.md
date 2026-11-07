# APOC online test build: rules log for Paul

What the game does now (v1.69), as decided by Tim. I add to this every time a rule is decided or changed.
Format: **rule**, then (version it went in). Items marked "ASK" are guesses that still need confirming.

## Object of the game
You are a prepper in Hope Falls, a town on the edge of collapse. Race your rivals to grab the essential resources (FOOD, KNOW-HOW, CHEM, HARDWARE, TECH, MEDS) and the DUCT TAPE that holds everything together, and stay alive.
- You start in Central Park with a backpack, 2 PREPCOIN and 3 FOOD. PREPCOIN is portable crypto: use it to buy resources and items.
- Short of coin? Steal, loot or dumpster dive, and risk a stretch in jail or hospital.
- Soon you need a **bunker** to keep your gear in and other players out.
- Every turn a news headline points at one of three looming APOC events: AI uprising, nuclear strike or global pandemic. As DEFCON rises, easy pickings disappear, the town gets meaner and law and order fails.
- When DEFCON goes red (the SHTF token reaches the red space) the town flips to its post-APOC state and survival becomes a final race through a town you no longer recognise.
- **This online test build plays the pre-APOC part only.** When SHTF is triggered everyone does the Panic Grab, the board is cleared and the game ends, telling you which Mission Pack to open. Post-APOC is not built yet.

## 1a. How the pre-APOC game ends
1. DEFCON reaches the last level (5th paper in a pile at End Turn): the APOC event (AI, Pandemic or Nuclear) is triggered. Thugs and coin are cleared; in a Nuclear event players without a bunker drop to 1 health.
2. Panic Grab: players may spend MEDS first, then take one last turn each (order: highest health, then fewest resources, then a die roll), 2 moves per health point, grabbing resources where they stand. Two players ending in the same building fight over it (Black Friday).
3. After the last Panic Grab turn the board is cleared and the game stops. In the real game the players open the sealed envelope (Mission Pack) for that event and play on; in the online test the game just tells you which one. (Confirmed by Tim, v1.112.)

## 1. Turn order (pre-APOC)
1. **Eat / Pay Thugs.** Eat 1 food (no food = lose 1 health). Thug pay, keep or give a job.
2. **Draw News.** Top card of the news deck is drawn, news sound plays, card shown big until closed (click, x or Esc). It goes on the pile of its type. (v1.58)
3. **Roll the News dice.** See section 2.
4. **Roll Day/Night to move.** No re-roll unless a character card allows it (Jessica: day dice). Flashlight is kept.
5. **M.A.A.M: Move or Action, Action or Move.** Includes crafting. Movement cannot be split around an action.
6. **End turn.** End-of-turn effects. If any news pile reaches 5 papers: DEFCON goes up and the papers go back to the deck (reshuffled).

**Moves:** each door crossed, each junction (the yellow-crossing spaces) and each road entered from a junction costs 1 of your moves. Park St and Casper Rd are move spaces but dead ends.

## 2. News cards and the news dice
- 27 pre-APOC news cards: 9 AI, 9 Pandemic, 9 Nuclear. Shuffled at the start of every game.
- News dice faces: 3 fake news + Nuclear + Pandemic + AI.
- A matching face triggers the event of the **newest card of that type on the table** (not necessarily the card just drawn).
- Fake news, or no card of that type out: nothing happens.
- A triggered paper is turned over on its pile. It cannot fire again, but still counts towards the five.
- Buried papers (not on top of their pile) never trigger.
- At 5 papers in one pile: DEFCON goes up, papers return to the deck, deck reshuffled.
- Event panels stay along the bottom of the screen for the newest paper of each type until a newer one covers it. Triggered ones show "TURNED OVER". (v1.58)
- Events with a place on the map make that place glow until the next turn. Events with no place show a flashing banner until the next turn. (v1.39)

### Where events glow (confirmed by Tim)
| Event | Place |
|---|---|
| West combat | West column: NW, W, SW |
| East tech | East column: NE, E, SE |
| Chemical waste | Whole centre column: N, C (park), S. 2 damage to anyone there (v1.39) |
| River pollution | The river row |
| Stab vest / hard drives | Pawn Shop (SE) |
| Hazmat suit | Bar (SE) |
| Solar panel | Steel Plant (NW) |
| Hospital closed | Hospital (N) |
| Crypto-geek | Boat Yard (**board shows it in SW**, Tim said SE: ASK) |
| Aid package | Train Station (W) |
| Bags burst | West Street (W) and Law Street (E) |
| Dumpster dive | Both dumpsters: NE (top right) and SW (bottom left) |

### Specific events
- **Contraband meds** ("swap any 2 resources for 3 MEDS"): the player whose turn it is gets the offer, **chooses which 2 resources** to give. Needs 2+ resources. (v1.67) ASK: should every player be able to use it?

## 3. Items, crafting and breaking down
- Item deck: 21 item types x 4 copies = 84 cards, shuffled, face down on the table (top left, above the DEFCON chart). Click it to see how many of each type remain. (v1.45, v1.54)
- **Craft:** big green APOC Recipe Book button (Craft - Recycle), usable at **any point in your own turn**. You pay the recipe in resources and take that item's card from the deck. **One craft per turn.** (v1.46)
- **Recycle (break down):** you get back every resource on the recipe **except the last one (marked X), which is lost**. The card goes back in the deck. **One break down per turn.** Sam gets +1 Know-how when he breaks something down. (v1.46)
- Item cards on the table and in the craft book can be clicked to enlarge. (v1.48, v1.55)

- Items that need a bunker to craft or keep: Bed, Hazmat Suit, Med Lab, Drone, Solar Panel, Hydroponics Lab. Chain: the Hydroponics Lab also needs you to own a Solar Panel; the Med Lab needs you to own both a Solar Panel and a Hydroponics Lab (you keep them, nothing is used up). The recipe book shows these requirements. These conditions only apply to crafting: item cards you are simply given (deck draws, bonus cards) can be kept without them. Drawn item cards are never skipped: a burglar can find any item, with or without a bunker. (Confirmed by Tim, v1.122.)

- Building a bunker: take the Build action (1 action, any place) when you hold at least one of each of the six resources (Food, Know-how, Chem, Hardware, Tech, Meds). One DUCT TAPE can stand in for one missing resource. The resources are NOT used up. Your character card turns over to the bunker side (unlimited resources, no backpack limit). The first player to build also receives a bonus item card. (As built in v1.122: please confirm, see Still to confirm.)

## 4. The pool (resources that are on the table but not in play)
- Shown on the right of the board in piles with counts. (v1.68)
- **Everything spent, crafted away, sold, lost, robbed or paid goes back to the pool.** (v1.68)
- The pool also holds **30 PrepCoin** (a row at the bottom of the pool). The count shown is 30 minus the coin players hold or have left on the board, so coin earned and spent moves in and out of it. The rules still treat PrepCoin as unlimited if the pool runs out. (v1.71)
- Busted and can't pay the 1-coin fine: 1 resource goes back to the pool (not the church). (v1.69, fine cut to 1 in v1.92)
- Taken from another player (fight / Black Friday): goes to the winner, not the pool.

## 5. Stealing, looting, busted
- **Steal:** roll to steal, pick a resource, may push your luck. **If you are caught, everything stolen in that steal action goes back to the place it came from**, then you are busted. (v1.69)
- **Loot:** a failed loot loses everything looted that action back to the place and you are shot (2 damage) and crawl into the nearest dumpster.
- Busted: pay a 1 PrepCoin fine; no coin = 1 resource to the pool; nothing at all = police chief gives 1 coin. Three busts = tagged (day dice only, no stealing) until the DEFCON next rises, then the tagged token is discarded (v1.132; before this it only cleared at DEFCON 1).

## 6. Buying and selling
- **Sell resources** only at the purple coin places: Truck Stop, Salvage Yard, Prison, Pawn Shop.
- **Buy items** (yellow coin) only at the Gun Shop and Hardware Store.

## 7. Board facts from Tim
- Sectors are a 3x3 compass: West column NW / W / SW, centre column N / C (park) / S, East column NE / E / SE.
- Building outlines in orange/yellow on the board are just graphics, no rules.
- Pet Store door faces south onto Coin Street (map graphic to be fixed by Tim).
- Two streets are both called Turbine Drive: they need separate names (Tim is updating the map).

## 8. Still to confirm (ASK)
1. Combat damage = difference of rolls, capped at 3, min 1; all modifiers stack?
2. Bunkered players' resources can't be robbed in fights (only coin)?
3. Kevlar Vest: auto-used, 4 hits then back in the deck?
4. Hazmat Suit: 3 charges?
5. Moonshine: ignore health loss until your next turn?
6. Failed steal/loot rules as in section 5?
7. Naomi's Detention: attacker's choice or random (using random)?
8. Jessica's Forager: +1 food at the park, 2 total if she ends her turn there?
9. Frost gun bonus = Rifle recipe -1 Know-how only; Naomi 5 moves and free Chem when short once per turn?
10. Night dice "find 1 resource": player chooses which?
11. X marks (resource lost on break down) on each item recipe: please check against card art.
12. News card 15: typo in card text, keep or fix?
13. Boat Yard location (SW on the board, Tim said SE).
14. Contraband meds: every player or only the roller?

15. Building a bunker: are the six resources kept or spent? Does duct tape really stand in for one missing resource? Is the Build action allowed anywhere? Does the first-bunker bonus card exist?

## 9. Not built yet
Post-APOC (Mission Packs), End Times cards, and any event or item whose effect isn't designed yet (they show their text but do nothing).

## 10. Other assumptions built into the game (not yet confirmed)
### Scope
- Pre-APOC only. When SHTF triggers everyone does the Panic Grab, the board is cleared and the game ends, telling you which Mission Pack (AI / Virus / Nuclear) to open. Post-APOC is not built.
- 5 same-type news cards on the stand escalate DEFCON (green, yellow, orange, red/SHTF). The End Times cards in the PDF were placeholder text, so they have no effect.
### Board
- All 56 door markers were read from the board PDF. Movement is only road segment to junction, and building to its door(s). Every step (road segment, junction, door) costs 1 move.
- Each door joins the road its arrow points across. The two corner dumpsters sit at the end of a road.
- Central Park has six doors and is its own block. Blocks (for Bolt Cutters) follow the street grid; the river row is the bottom row.
- Pet Store: currently shares the Music Store's door on Coin Street. To be fixed when Tim's new map arrives (own door, south facing onto Coin Street).
- Subway = the "S" markers (junctions). You can walk onto an S junction like any other junction without using the subway. Using the subway costs 1 move and 1 PrepCoin and takes you to any other S station. (Confirmed by Tim, v1.117.) Bridges for the boat are not modelled.
### Rules I had to guess
- PrepCoin is an unlimited bank. Resource tokens are limited to the supply counts.
- Combat modifiers stack.
- Night dice are blocked by the Curfew event. Tagged preppers must use the day dice.
- Jessica re-rolls the day dice once (keeps the new result).
- Drone is an action. Walkie-Talkie only recruits a thug remotely. Thug upkeep is paid once at the start of the turn.
- "Scavenge" = dumpster dive. At 0 HP with no meds you spend the turn resting (+1 HP).
- The red APOC die in the dice PDF is unused.
### AI players
- Simple heuristic bots. They fill seats and exercise the rules, but are passive and sometimes starve. They are not a balance test.
### Test tools
- Sandbox (lobby tickbox, off by default): give or take resources, coin, health, items; set DEFCON; teleport; trigger APOC.
- Undo (host/solo only), Export (full state and log for bug reports) (share the saved game file or the online room to show testers a game). Press C to centre the whole table.
- Online: the host opens a room and others join with the 5-letter code (peer-to-peer via the PeerJS broker). Unfilled remote seats become AI.

## Test-build tools (not game rules)
- AI opening goals (start screen, per AI seat): Balanced (plays like a human); or first collect weapons (2 of pistol/rifle/knife/bow/chainsaw), build a bunker, craft items only (until it holds 3 items), recruit a thug, collect 10 food (backpack only holds 10, so the AI rarely manages it), gamble at the casino (2 sessions), steal and loot (3 times), burgle and dumpster dive (3 times), hoard 8 PrepCoin (sells surplus, buys nothing), or raid a bunker (once one exists; no one can speed up DEFCON, so there is no DEFCON-rush goal). Once the goal is met the AI plays balanced. (v1.92)
- Character cards: the table shows the bunker side once a player has a bunker; click a card to enlarge it and press Flip (or F) to view the other side. (v1.90)
- Busted fine cut to 1 PrepCoin (v1.92).
- All-AI games: the news paper is shown for 3 seconds then closes by itself (stays up for human players). At game over you can download the whole game log as a text file (round-tagged) or the JSON. (v1.96)
- When the APOC event triggers (AI, Pandemic or Nuclear) a big full-screen message shows with a siren sound; click or Esc to close. (v1.97)
- The C (recentre) view leaves room at the bottom for the event panels so they don't cover the player cards. (v1.98)
- Keyboard: P pauses / resumes the AI (the old P = pan tool shortcut is gone); C recentres. (v1.100)
- Start screen plays a short radio chatter clip once (after the first click or key press if the browser blocks autoplay). (v1.105)
- Ambient music starts on the start screen with the radio chatter and plays on through the game (quietly, looping); the Music off / Music on button at the top switches it and remembers your choice. (v1.107)
- A card-up sound plays whenever anything is enlarged (a card on the table or in a list, a news pile or the item deck) and when a drawn news card pops up, including in all-AI games. (v1.109)
- Figures are always shown at their true height (Frost 42, Jessica 38.6, Naomi 38, Sam 38 mm, tuned by eye); the player whose turn it is no longer grows. (v1.111)
- Bolt Cutters: a player holding them (or Sam, with Parkour) can move from a building straight into a building that touches it (e.g. Casino to Bar, Bar to Pizza House), 1 move, no door needed. It is not any building in the block, only neighbours. The neighbour list is in data/adjacent.json (35 pairs, generated from the map by distance and checked by Tim); edit it freely. (v1.114)
- News dice faces are tinted with the event colour (Pandemic red, AI blue, Nuclear amber; Fake News stays white). (v1.118)
- Full screen button at the top (Esc leaves full screen). In full screen the right column is hidden except the turn buttons, which float over the bottom right; the table recentres. (v1.125)
- Each character card has a white health cube on its 10-to-0 health track; it moves as health changes. (v1.126)
- The figure whose turn it is (while it still has moves left) has a pulsing glowing base in its player colour. (v1.128)
- F key toggles full screen (when a card is enlarged, F still flips it). (v1.129)
- Test-build tool: 🎥 Follow button now glides the camera in on the active player's figure and tracks it as it moves (previously went to the player's mat). (v1.130)
- Busted tokens now show on the table beside each player's card (one per bust). On the 3rd bust they swap for a single TAGGED token (day dice only, no stealing). (v1.131)
- Test-build tool: when something bad happens to a human player (busted, tagged, robbed, shot, health lost, hospital) a big pop-up shows the log lines at full size, stays up and pauses the game until you click / Esc / Enter (v1.137: no timer). The side log stays as before. Busting now also logs 'receives a BUSTED token (n of 3)'. (v1.133)
- Test-build tool: the camera now zooms in on whichever player's turn it is by default (🎥 Follow is on at start; click it to turn off, which also returns to the full-table view; the choice is remembered). (v1.134)
- Test-build tool: the newspaper now pops up on the left of the table with no screen dimming, so the board stays visible. (v1.135)
- Test-build tool: choice pop-ups (steal, loot, etc.) now show only your own last few log lines, not the news/event lines. (v1.136)
- Test-build tool: the right-hand info bar (players, log, status) is collapsed by default; only the turn/action panel stays, bottom-right. The ◀ Info tab on the right edge expands it (remembered). (v1.138)
- Test-build tool: Z key zooms in on the active player's figure; press Z again (within 4 seconds) to step to the next player's figure. C recentres. The hint "C to Recenter · Z to Zoom" is always shown top right of the table (v1.141).
