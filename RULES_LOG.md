# APOC online test build: rules log for Paul

What the game does now (v1.69), as decided by Tim. I add to this every time a rule is decided or changed.
Format: **rule**, then (version it went in). Items marked "ASK" are guesses that still need confirming.

## Object of the game
You are a prepper in Hope Falls, a town on the edge of collapse. Race your rivals to grab the essential resources (FOOD, KNOW-HOW, CHEM, HARDWARE, TECH, MEDS) and the DUCT TAPE that holds everything together, and stay alive.
- You start in Central Park with a backpack, 2 DOOMCOIN and 3 FOOD. DOOMCOIN is portable crypto: use it to buy resources and items.
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

- Building a bunker: take the Build action (1 action, any place) when you hold at least one of each of the six resources (Food, Know-how, Chem, Hardware, Tech, Meds). DUCT TAPE is wild: each duct tape you hold can stand in for one missing resource (v1.186). Nothing is used up: you keep every resource you collected (including the duct tape). Your character card turns over to the bunker side (unlimited resources, no backpack limit). The first player to build also receives a bonus item card. (As built in v1.122: please confirm, see Still to confirm.)

## 4. The pool (resources that are on the table but not in play)
- Shown on the right of the board in piles with counts. (v1.68)
- **Everything spent, crafted away, sold, lost, robbed or paid goes back to the pool.** (v1.68)
- The pool also holds **30 DoomCoin** (a row at the bottom of the pool). The count shown is 30 minus the coin players hold or have left on the board, so coin earned and spent moves in and out of it. The rules still treat DoomCoin as unlimited if the pool runs out. (v1.71)
- Busted and can't pay the 1-coin fine: 1 resource goes back to the pool (not the church). (v1.69, fine cut to 1 in v1.92)
- Taken from another player (fight / Black Friday): goes to the winner, not the pool.

## 5. Stealing, looting, busted
- **Steal:** roll to steal, pick a resource, may push your luck. **If you are caught, everything stolen in that steal action goes back to the place it came from**, then you are busted. (v1.69)
- **Loot:** a failed loot loses everything looted that action back to the place and you are shot (2 damage) and crawl into the nearest dumpster.
- Busted: pay a 1 DoomCoin fine; no coin = 1 resource to the pool; nothing at all = police chief gives 1 coin. Three busts = tagged (day dice only, no stealing) until the DEFCON next rises, then the tagged token is discarded (v1.132; before this it only cleared at DEFCON 1).

## 6. Buying and selling
- **Sell resources** only at the purple coin places: Truck Stop, Salvage Yard, Prison, Pawn Shop.
- **Buy items** (yellow coin) only at the Gun Shop and Hardware Store.

## 7. Board facts from Tim
- Sectors are a 3x3 compass: West column NW / W / SW, centre column N / C (park) / S, East column NE / E / SE.
- Building outlines in orange/yellow on the board are just graphics, no rules.
- Pet Store door faces south onto Coin Street (map graphic to be fixed by Tim).
- The two streets that were both called Turbine Drive are now Dumpster Drive (west, past the Dumpster) and Turbine Drive (middle). Pet Store now has its south door onto Coin Street (revised board). (v1.160)

## 8. Still to confirm (ASK)
1. Contraband meds: does it apply to every player or only the roller? (No answer yet; currently every player may swap.)
2. X marks (resource lost on break down) on each item recipe: Tim to check against the card art. The last circle on the recipe should be the one lost; the card art will be made clearer.
3. News card 15: typo in the card text. Tim will fix the card.
4. Boat Yard location: stays where it is on the board for now (SW), Tim to revisit.

### Confirmed by Tim (v1.239)
- Combat damage = difference of the two rolls, capped at 3, minimum 1; all modifiers stack.
- Bunkered players' RESOURCES can't be robbed in fights (coin can still be taken).
- Kevlar Vest: used automatically, blocks all the damage from a hit, 4 uses, then it goes back in the deck.
- Hazmat Suit: unlimited use (no charges). It stops health loss from the pandemic, mainly in post-APOC. (Test build also lets it shield the pre-APOC outbreak / pollution / chemical-waste news effects; tell me if it should not.)
- Moonshine: ignore health loss until your next turn.
- Failed steal / loot: same rules as section 5.
- Naomi's Detention: follows her card (bunker skill): once per fight, when a prepper wounds Naomi, they lose a resource. The card doesn't say who picks, so the test build takes the resource they hold most of.
- Jessica's Forager: +1 food on visiting the park, 2 total if she ends her turn there.
- Frost and Naomi: go by their cards (Frost +1 with guns and +1 burgle / dumpster dive, bunker: no KNOW-HOW for a Rifle; Naomi 5 moves, one craft per turn without CHEM).
- Night dice "find 1 resource": the player chooses which.
- Building a bunker (section 4 rule above): confirmed, including keeping all six resources, duct tape as a wild, Build allowed anywhere, and the first-builder bonus item card.

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
- Subway = the "S" markers (junctions). You can walk onto an S junction like any other junction without using the subway. Using the subway costs 1 move and 1 DoomCoin and takes you to any other S station. (Confirmed by Tim, v1.117.) Bridges for the boat are not modelled.
### Rules I had to guess (combat modifiers stacking is now confirmed)
- DoomCoin is an unlimited bank. Resource tokens are limited to the supply counts.
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
- AI opening goals (start screen, per AI seat): Balanced (plays like a human); or first collect weapons (2 of pistol/rifle/knife/bow/chainsaw), build a bunker, craft items only (until it holds 3 items), recruit a thug, collect 10 food (backpack only holds 10, so the AI rarely manages it), gamble at the casino (2 sessions), steal and loot (3 times), burgle and dumpster dive (3 times), hoard 8 DoomCoin (sells surplus, buys nothing), or raid a bunker (once one exists; no one can speed up DEFCON, so there is no DEFCON-rush goal). Once the goal is met the AI plays balanced. (v1.92)
- Character cards: the table shows the bunker side once a player has a bunker; click a card to enlarge it and press Flip (or F) to view the other side. (v1.90)
- Busted fine cut to 1 DoomCoin (v1.92).
- All-AI games: the news paper is shown for 3 seconds then closes by itself (stays up for human players). At game over you can download the whole game log as a text file (round-tagged) or the JSON. (v1.96)
- When the APOC event triggers (AI, Pandemic or Nuclear) a big full-screen message shows with a siren sound; click or Esc to close. (v1.97)
- The C (recentre) view leaves room at the bottom for the event panels so they don't cover the player cards. (v1.98)
- Keyboard: P pauses / resumes the AI (the old P = pan tool shortcut is gone); C recentres. (v1.100)
- Start screen plays a short radio chatter clip once (after the first click or key press if the browser blocks autoplay). (v1.105)
- Ambient music starts on the start screen with the radio chatter and plays on through the game (quietly, looping); the Music off / Music on button at the top switches it and remembers your choice. (v1.107)
- A card-up sound plays whenever anything is enlarged (a card on the table or in a list, a news pile or the item deck) and when a drawn news card pops up, including in all-AI games. (v1.109)
- Figures are always shown at their true height (Frost 42, Jessica 38.6, Naomi 38, Sam 38 mm, tuned by eye); the player whose turn it is no longer grows. (v1.111)
- No shortcut between neighbours (v1.240, Tim): buildings that share a road-segment door (e.g. the two NW residences, Music Store / Pet Store) can't be crossed building -> road -> building. Without Bolt Cutters (or Sam) you must go round to a different door. Walking round a corner between different streets is still normal movement.
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
- Test-build tool: a game always opens on the full zoomed-out table; the Follow camera only starts zooming from the next turn/move. (v1.142)
- Test-build tool: Z zooms in 30% closer and tilts in further than the Follow camera. (v1.143)
- Test-build tool: if you angle/zoom/pan the table yourself, the Follow camera stops moving it until you press C or Z. (v1.144)
- Test-build tool: X key zooms to the active player's character card (press again to step to the next card); the top-right legend now reads C Recenter · Z Zoom to figure · X Zoom to card. (v1.145)
- Test-build tool: N key zooms to the three event news stands (AI, Pandemic, Nuclear); legend now C Recenter · Z Figure · X Card · N News · D DEFCON (v1.147: D zooms to the DEFCON chart).
- Test-build tool: X zoom-to-card is a little further out and sits above the event panels. (v1.148)
- Health cubes on the character cards are moved by the game automatically (they follow each player's health in every game, solo or multiplayer). Anyone can also drag a cube along its track to correct it by hand; this is written to the log as "MANUAL ADJUSTMENT: ... (not caused by a game rule)" and kept in the game log/export so a hand change is never hidden. (v1.149)
- Test-build tool: a space with more than 6 resource piles (Big Storage at the start, 7 incl. duct tape) lays them out in rows of 3 so they stay inside the building. (v1.150)
- Test-build tool: top-bar 'Resources' toggle (or H key) hides / shows every resource pile on the board so the building names can be read. (v1.151)
- Test-build tool: board resource piles now show the little white count (like the pool and the player mats); small shops (Thrift, Hardware, Drugs...) and Big Storage use smaller tokens placed inside the building; the pool is labelled RESOURCE POOL; the shortcut-key legend is top left; clicking a news card in a stack enlarges it as big as the window allows. (v1.152)
- Test-build tool: the turn panel sits inside the table window, bottom-aligned on the same level as the event panels. (v1.153)
- Test-build tool: the health cube now sits exactly on the numbered tile for the player's health (re-measured against the card art). (v1.154)
- Test-build tool: the Info expand/collapse tab glows. (v1.155)
- Test-build tool: the top menu bar shrinks on smaller laptop screens so it stays on one line. (v1.156)
- Test-build tool: the turn box text and button are centred in the panel. (v1.157)
- Test-build tool: the little white count numbers on the board piles were removed again (too distracting); the pool and player mats still show counts. (v1.158)
- Board artwork replaced with Tim's revised board PDF (printed resource numbers removed; same size and layout, board spaces unchanged). (v1.159)
- Board artwork replaced again with Tim's latest board PDF (Dumpster Drive typo fixed; this version has the printed resource number tiles on the buildings). The previous no-numbers board is in git history (v1.159/v1.160). (v1.161)
- Test-build tool: the sandbox tools are a smaller, tidier box in the side bar (a sandbox game opens the side bar automatically). (v1.162)
- Dumpsters (NE and SW) have no door: a player moves in from the junction for 1 move (the street piece in front of each dumpster no longer exists as a space). The gantry space below Prepper Joe's / Harbor Office at the bottom right (east end of Fairbrass Exchange) is removed: it is not a move space. Board artwork updated to match (door arrows removed). (v1.163)
- Test-build tool: every resource token on the board spaces is now the same size (the Big Storage size); before, the small shops used smaller tokens. (v1.164)
- Test-build tool: all resource tokens (board spaces, pool, player cards, held in hand) are 15 mm across at table scale. (v1.165)
- Test-build tool: Frost's figure is 5% smaller (about 38 mm tall on the table). (v1.166)
- Test-build tool: the Casino and Thrift Store move spaces (rings, tokens, figures) are now nearer the centre of their buildings. (v1.167)
- Test-build tool: Thrift Store piles are laid out two per row so they stay inside the narrow building. (v1.167)
- Test-build tool (sandbox): "Layout" row in the sandbox box. "Move piles…" lets you drag any resource pile on the board to where you want it, "Download" saves the layout as JSON (board pixel position of each pile, per space and resource), "Load…" reads one back, "Reset" returns to the default. Edits are remembered in your browser; the default layout every player gets comes from data/tokenlayout.json (Tim sends the downloaded file and it is built in). (v1.168)
- Default resource-pile layout on the board is now Tim's layout (data/tokenlayout.json, 52 piles). The Big Storage duct tape pile was not in his file so it was placed between Hardware and Tech there; move it if needed. Sandbox edits in a browser sit on top of the default. (v1.169)
- Board artwork updated again: the printed resource placement boxes are removed (the game's tokens show the starting resources instead); small label changes (Prepper Jack's). Hardware Store now starts with 1 Duct Tape as well (Hardware, Chem, Tech + Duct Tape), which comes out of the Duct Tape supply (10 to 9 in the pool). (v1.170)
- Board artwork updated: last leftover resource box removed at the Cafe. (v1.171)
- Default resource-pile layout updated to Tim's revised positions (data/tokenlayout.json, 54 piles incl. both Duct Tape piles). (v1.172)
- Test-build tool (sandbox): with Move piles on, click a space or pile to add/remove its starting tokens (−/+). The layout JSON now also holds the starting pile counts (setup), so changes can be baked in as the default. (v1.173)
- Test-build tool: ITEMS deck label moved above the pile; DEFCON label nudged down. (v1.174; player names stay above the card, v1.175)
- Test-build tool: DEFCON rise sound effect (assets/sfx/defcon.mp3) plays whenever DEFCON goes up. (v1.176)
- Board art updated (duplicate Pet Store door arrow removed; one south door onto Coin Street remains, matching the board data). (v1.177)
- Test-build tool: pressing C zooms out to the whole table and holds it there (the auto-follow stops moving the camera, e.g. while watching AI turns) until Z, X, N or D is pressed; moving the camera by hand also holds it. (v1.178)
- Test-build tool: turn button (End turn / Roll) is now green; the APOC Recipe Book button is black. (v1.179)
- Test-build tool: the turn panel now ends with an at-a-glance strip of the current player's resources, health, coins and items (so it stays visible when zoomed in or full screen). (v1.180)
- Test-build tool: the APOC Recipe Book button is always on screen (view-only when it is not your turn); the camera zooms to the dice on every roll. (v1.181)
- Test-build tool (AI): after its opening goal, each AI keeps a plan across turns (build bunker first, then food / craft / weapons / scavenge / steal) and logs "X plans to ...". (v1.182)
- Test-build tool: B key zooms the camera to the board as large as it fits, with a slight tilt; legend now C Recenter · B Board · Z Figure · X Card · N News · D DEFCON. (v1.183)
- Test-build tool: the shortcut legend (C B Z X N D) is now a vertical list down the left of the screen. (v1.184)
- Test-build tool: the dice re-roll pop-up no longer repeats earlier log lines (eat / news) - it only shows the roll and the Keep / Re-roll choice. (v1.185)
- Test-build tool: the only way a character card turns to its bunker side is the Build action; the Flip button on the enlarged card is just a preview of the other side. Backpack limit stays 10; a bunker is unlimited. (v1.186)
- Test-build tool: bunker progress shows in the turn panel (Bunker: n of 6, what is missing, duct tape cover / READY); the Build button turns big, green and pulsing; the log says when a player can build. (v1.187)
- Test-build tool: the shortcut legend sits tighter in the top-left corner. (v1.188)
- Test-build tool: shortcut keys are now B Board (press again = centred overview), C character card, P player piece, R recipe book, F full screen, N news, D DEFCON, H hide resources; pause is button-only (Follow is a button too). (v1.189)
- Test-build tool: Space bar pauses / resumes the game. (v1.190)
- Test-build tool: H (hide / show resources) added to the shortcut legend. (v1.191)
- Test-build tool: shortcut legend hangs from the very top-left of the table view. (v1.192)
- Test-build tool: shortcut legend no longer glows. (v1.193)
- Test-build tool: in the turn-panel info strip the health heart is green and the coin is a yellow disc. (v1.194)
- Test-build tool: resource piles that an event places on a space (with no saved position) now take the nearest free spot beside the existing tokens instead of overlapping them; the footer "Gunpowder Studios" links to the website in #FCB040. (v1.195)
- Test-build tool: footer link made clickable. (v1.196)
- Test-build tool: the side bar log is titled "Game Log", each line is coloured by the player who did it, and a "Round N" heading marks each new round. (v1.197)
- Test-build tool: the B views (board / centred overview) are 10% closer than before. (v1.198)
- Test-build tool: the centred overview (second B press) sits lower and slightly right, nearer the middle of the window. (v1.199)
- Test-build tool: Game Log text is brighter. (v1.200)
- Test-build tool: the Info side-bar tab sits at the top right, level with the top of the shortcut legend. (v1.201)
- Test-build tool: the board view (first B press) sits 10% higher in the window. (v1.202)
- Test-build tool: the Game Log shows a coloured "<player>'s turn" heading each time a turn starts, under the Round heading. (v1.203)
- Test-build tool (AI): an AI player with no food left switches its plan to finding food (until it holds 3), whatever its other plan, and logs it. (v1.204)
- Test-build tool: every shortcut key (B C P R F N D H Space) plays the pop-up sound. (v1.205)
- Test-build tool: the Info side bar is gone. Top right shows the round number (big) with a live move log (newest line glowing green, older lines fading; click to open the full log). All top-menu buttons and the sandbox tools are under a cog menu (Pause stays on the bar). The turn box stays bottom right. (v1.206)
- Test-build tool: rolled dice always land with the picture on the top face the right way up for the camera (the die still tumbles, it just settles readable). (v1.207)
- Test-build tool: the game now names players by their character (Jessica, Sam, Frost, Naomi) in the log, turn box and table labels (the person / AI is shown in brackets on the table); the top-right and bottom-right panels are 20% narrower. (v1.208)
- Test-build tool: ROUND heading is half the size, the DEFCON badge has no shadow and lines up with the top of the text; the turn box is collapsible (click its heading) to just the character name and the big button; brackets removed. (v1.209)
- Test-build tool: the top-right log is a scrollable transparent black panel (no border, no pop-up): newest line on top glowing green, older lines below with round / turn headings. (v1.210)
- Test-build tool: dice settle upright to read but with a slight random angle (7-18 degrees). (v1.211)
- Test-build tool: the turn box is the same width as the log and more compact; the log has no background. (v1.212)
- Test-build tool: the bottom-right turn box is the same width as the log and tidied: name, big button (End turn / roll / eat), then the option buttons in a compact grid; the log has no background panel. (v1.212)
- Test-build tool: the bottom-right turn box is the same width as the log, 50% transparent, ordered name / big button / smaller options; the log has no background. (v1.212)
- Test-build tool: the top-right log collapses to the right edge with a "Log" tab (click again to bring it back; remembered). (v1.213)
- Test-build tool: the right-hand column sits clear of the Log tab and the footer. (v1.214)
- Test-build tool: the Log tab is replaced by a small arrow next to the round number: collapsed shows only the newest (green) line, expanded stretches the log down to the turn box. (v1.215)
- Test-build tool: click the green log line to expand the log, click the expanded log to collapse it; expanded log fades in behind and reaches the player box; recipe button now same translucent black as the player box. (v1.216)

## News cards revision 2 (News_cards_2.pdf) - v1.217
- All money is now called **DoomCoin** everywhere (name may change later).
- Cards replaced/changed: Bomb Threat (west side, as before); Dog escapes data center (as before); **Contraband meds**: while uncovered, a prepper at the hospital may swap 1 resource for 3 MEDS (an action; repeatable); Stab vest, Crypto soars, Hospital closed, Hazmat (as before); **Anti-tech rioters**: anyone in the east is boxed in while uncovered and must roll combat 5+ at the start of their move to get out, else no movement that turn (retry next turn, no damage); **Airborne outbreak / Powerplant pollution / Chemical waste**: Hazmat Suit owners are shielded; **Curfew**: day dice only (night dice placed on the card) - the printed card says "no daytime movement / place day dice here", Tim confirmed day dice only, so the card text needs fixing; **Robin Hood AI**: poorest prepper (least DoomCoin) gets 1 DoomCoin from each other prepper, tied poorest = each donor chooses; **Bug-out drill**: current prepper missing any of the 6 resources (duct tape stands in for any) must scrap one item; **Hacker attack (CCTV)**: stealing/looting only fails on a natural 1 while uncovered; **Ultimate dumpster dive**: while uncovered, at the recycling depot (currently the City Dump space) a prepper may trade ALL their TECH for the top ITEM card; **PJ's yard sale** (Prepper Jack's): gun shop and hardware store items half price rounded down while uncovered; **Out-of-date food**: current prepper pays 1 MED or loses 2 HEALTH; **Thugs show up late**: no feeding/paying thugs while uncovered; **Weapon mastery**: prepper with a bow or knife may spend the whole turn training for +2 tokens on a chosen item (what tokens do is still to be decided); **Dumpster dive dash**: SW dumpster only.
- End Times cards (6 yellow, 6 orange) are in the game: shuffled into the news deck when DEFCON reaches Yellow / Orange, drawn and played like normal news (type icon decides the stand). Their MOB-token events have NO EFFECT yet (see questions).
- New component: MOB token, 25 mm red circle with white MOB text (assets/counters/mob.png, print file supplied).
### Open questions for Tim / Paul (new)
- Curfew card text: should read night dice / night-time movement?
- Hospital Closed + Contraband meds both live: currently contraband works at the hospital regardless. Which card is the hospital closure on?
- Weapon mastery: what do the +2 tokens do (ammo/uses)?
- Robin Hood: poorest tied donors - confirm only the non-poorest give.
- End Times MOB events: exact streets, MOB supply, combat/bribe rules, pistol/drone item sources, which park, health clinic = Dental Clinic?, sniper damage dice, what "armor bonuses" are.
- Test-build tool: MOB tokens (red 25 mm, white MOB text; art assets/counters/mob.png) now appear on the streets named by an uncovered End Times civil-unrest card and disappear when it is covered. They do nothing yet - blocking rules are still to be decided. (v1.218)
- Test-build tool: the APOC yellow mushroom-cloud logo is now the browser tab icon and home-screen app icon. (v1.219)
- Test-build tool: turn box, recipe button and the expanded log panel are now 70% black. (v1.220)
- Test-build tool: each DEFCON rise now puts a 15 mm token on the Panic Index of the DEFCON chart in the 3D view (blue = AI, red = Pandemic, yellow = Nuclear), in spaces 1-3. The rule itself is unchanged. (v1.222)
- Test-build tool: the APOC logo sits left of the title in the top bar, same height as the text. (v1.223)
- Test-build tool: new APOC mushroom-cloud logo (shaded version) replaces the tab / app / header icon. (v1.224)
- Test-build tool: the Rules button is back on the top bar (next to Pause and the cog); the cog menu no longer holds it. (v1.225)
- Test-build tool: the collapsed log now also shows the previous 4 moves under the green line, fading out, reaching about a fifth of the way down the screen. (v1.226)
- Test-build tool: the collapse arrows (log and player box) are larger. (v1.226)
- Test-build tool: the in-game Rules tab no longer shows the "Board facts from Tim" notes (they stay in this file) and anything still to be confirmed is shown in red. (v1.227)
- Test-build tool: an expandable "Tips for playing" (top 10 things you might need to do) sits under the shortcut legend, top left. (v1.228)
- Test-build tool: every item in the Recipe Book has an "I want this" tick box. Ticked items appear as a shopping list under the bunker line in the player panel (bottom right) showing what resources are still needed, or READY to craft. The list is remembered per character on this computer. (v1.229)
- Test-build tool: Recycle now asks "Recycle the X?" (Yes, recycle it / No, keep it) before it does anything. (v1.230)
- Test-build tool: top bar has "Watch it played" (was Whole game view): the board stays centred in the overview and the camera stops zooming to the dice and the active player, for watching the AI play. Keys (B, C, P, N, D) still work. Remembered. (v1.231)
- Test-build tool: "Watch it played" button moved to the top bar (lit when on). (v1.232)
- Test-build tool: a game with only AI players starts with "Watch it played" on (you can switch it off). (v1.233)
- Test-build tool: the DEFCON-rising sound plays 3 times in a row. (v1.234)
- Test-build tool: when DEFCON rises, a banner "DEFCON RISES TO PANIC/MAYHEM/SHTF!" pops up top centre for a few seconds, coloured yellow / orange / red for the new level. (v1.235)
- Fixed: v1.235 accidentally blanked the version file and the page would not load; restored. (v1.236)
- Test-build tool: the app icon now shows above the title on the game setup screen. (v1.237)
- Test-build tool: the "Watch it played" button is now called "Table View" (same behaviour). (v1.238)
- Test-build tool (online play, v1.241): fixed loading a saved game while a room was open, which silently turned the game local so guests saw nothing; an open room now always stays live. New pill at the top shows "Room CODE · names connected" for the host and "Online · watching / you play X" (or Disconnected) for guests.
- Test-build tool (online play, v1.242): chat box (bottom left, "Chat" pill with unread count) between everyone in the room, in the lobby and in game; a two-note chime plays when someone joins (lower tone when they leave) and when a chat message arrives.
- Test-build tool (online play, v1.243): opening a room puts a shareable link (…/apoc/?room=CODE) in the address bar and a Copy link button next to the room code. Opening that link jumps straight to Join with the code filled in.
- Test-build tool (v1.244): chat pill moved up so it sits above the Recipe Book instead of on top of it; the chat panel opens upward.
- Test-build tool (v1.245): movement is one space at a time - only the circles next to your piece glow, no more jumping several spaces with one click (single player and online). Cog menu now has separate Music and Effects volume sliders (saved on the device). Online: host re-sends the table to guests every 4 s and after any refused command, and nudges the AI if it stalls, so control always passes on after a remote player ends their turn.
- Test-build tool (online lobby, v1.246): remote players now choose their own character after joining (buttons show which are taken); their pick claims that seat on the host list and renames it to their name. The host sets who is Human / Remote / AI / Empty; a Remote seat nobody takes becomes an AI.
- Test-build tool (v1.247): on the Host tab the button reads "Enter Room"; once the room is open it becomes "Start game".
- Test-build tool (v1.248): the room link button is now "Share room link" (copies the link).
- Test-build tool (online, v1.249): a guest who joins with no seat (joined after the start, or no Remote seat was left) now sees "You are watching. Take a seat:" and can take over any character the AI is playing; if a seated guest leaves, the AI plays that character until they come back. Late joiners also receive live updates.
- Test-build tool (online lobby, v1.250): the host screen starts as "Me + 3 open seats". Friends join with the room link and take an open seat themselves; seats you set to AI or Empty show as closed to them. Any open seat nobody takes becomes an AI at the start.

- Test-build tool (v1.251): setup name boxes default to Player 1-4 (no real names); your own name is remembered in this browser until you change it; default AI seats are named after the character, e.g. Sam (AI).

- Test-build tool (v1.252): glowing buildings now have a bigger ring on top of the piles; clicking a pile or the door area walks you in. Volume sliders now work on iPad/iPhone.

- Test-build tool (v1.253): spaces further away within your remaining moves show a lighter, smaller glow (not clickable) so you can plan ahead; adjacent spaces stay bright.

- Rule fix (v1.254): the no-shortcut rule (building -> street -> building next door needs bolt cutters / Sam) only applies to buildings on the SAME side of the street. Leaving the Park onto Park View and entering Big Storage across the road is allowed.

- Test-build tool (v1.255): Sandbox > Doors > 'Check doors...' draws a green (on) / red (off) box round every door arrow on the map and lists every door; click a door in the list to switch it on/off to test movement (saved in this browser). 'Copy closed list' copies what you switched off so you can report back.

- Test-build tool (v1.256): cog menu now has a 'Doors: on/off' toggle (boxes round every door); Sandbox tools sit in the cog menu collapsed by default, with the door on/off list inside.

- Confirmed by Tim (v1.257): all 57 building doors on the board are correct (each building's door opens onto the right street space).

- Test-build tool (v1.258): cog menu 'Blocks' toggle colour-codes every building by its city block (same colour = same block, listed in the sandbox panel). In a sandbox game click a building, then one in the block it belongs to, to move it there; Download blocks.json to send. Doors list also has Download doors.json.
- Test-build tool (v1.259): in sandbox, door boxes and block dots are small and draggable: drag a door box to move it (drop it on a different street space to re-link the door), click it to switch the door on/off; drag a building's block dot onto a building in the block it belongs to. Download doors.json / blocks.json to send.

- Test-build tool (v1.260): door boxes, block dots and building glow rings sit much lower, close to the table.

- Test-build tool (v1.261): dragging a block dot joins the block of the nearest building to where you drop it (no need to land exactly on one).
