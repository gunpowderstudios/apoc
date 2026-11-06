# APOC online test build: rules log for Paul

What the game does now (v1.69), as decided by Tim. I add to this every time a rule is decided or changed.
Format: **rule**, then (version it went in). Items marked "ASK" are guesses that still need confirming.

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
- Item deck: 21 item types x 4 copies = 84 cards, shuffled, face down on the table (left, under the DEFCON chart). Click it to see how many of each type remain. (v1.45, v1.54)
- **Craft:** big green CRAFT / BREAK DOWN button, usable at **any point in your own turn**. You pay the recipe in resources and take that item's card from the deck. **One craft per turn.** (v1.46)
- **Break down:** you get back every resource on the recipe **except the last one (marked X), which is lost**. The card goes back in the deck. **One break down per turn.** Sam gets +1 Know-how when he breaks something down. (v1.46)
- Item cards on the table and in the craft book can be clicked to enlarge. (v1.48, v1.55)

## 4. The pool (resources that are on the table but not in play)
- Shown on the right of the board in piles with counts. (v1.68)
- **Everything spent, crafted away, sold, lost, robbed or paid goes back to the pool.** (v1.68)
- Busted and can't pay the 2-coin fine: 2 resources go back to the pool (not the church). (v1.69)
- Taken from another player (fight / Black Friday): goes to the winner, not the pool.

## 5. Stealing, looting, busted
- **Steal:** roll to steal, pick a resource, may push your luck. **If you are caught, everything stolen in that steal action goes back to the place it came from**, then you are busted. (v1.69)
- **Loot:** a failed loot loses everything looted that action back to the place and you are shot (2 damage) and crawl into the nearest dumpster.
- Busted: pay a 2 PrepCoin fine; no coin = 2 resources to the pool; nothing at all = police chief gives 2 coin. Three busts = tagged (day dice only, no stealing).

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

## 9. Not built yet
Post-APOC (Mission Packs), End Times cards, and any event or item whose effect isn't designed yet (they show their text but do nothing).
