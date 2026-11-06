#!/usr/bin/env python3
"""Builds data/board.json: the movement graph for the Hope Falls board.

Coordinates are pixels of assets/board/board.jpg (2576 x 1717).
Run:  python3 tools/build_board.py
The in-game Board Editor (press E) can fix anything wrong and export a patched board.json.
"""
import json, math

W, H = 2576, 1717
VX = [340, 832, 1333, 1850, 2316]            # vertical streets  V1..V5
HY = {0: [195]*5, 1: [590]*5, 2: [1068]*5,    # horizontal streets H1..H4 (y per column)
      3: [1521, 1521, 1544, 1588, 1588]}
HNAMES = [
    ["Church Road", "Diesel Drive", "Ladder Boulevard", "Needle Street", "Bullet Drive", None],
    ["Left Field", "Commercial Way", "Green Park Avenue", "Oak Tree Drive", "Law Street", "Park St"],
    ["West Street", "Justice Way", "Retail Road", "Park View", "Coin Street", "Casper Rd"],
    ["Turbine Drive", "Turbine Drive", "Riverside View", "Fairbrass Exchange", "Fairbrass Exchange", None],
]
VNAMES = [
    ["Monks Lane", "Signal Street", "Rust Road"],
    ["Red Pole Hill", "Booker Avenue", "Fisher Street"],
    ["Drill Street", None, "South Bridge Ave"],
    ["Gasoline Grove", "Hill Street", "Bourbon Street"],
    ["Stage Door Drive", "Green Gate Grove", "Hoop Lane"],
]

nodes = {}
edges = set()


def add(id, kind, x, y, **kw):
    nodes[id] = dict(id=id, kind=kind, x=round(x), y=round(y), **kw)


def link(a, b):
    edges.add(tuple(sorted((a, b))))


# --- intersections I{row}{col}  (row 0..3 = H1..H4, col 0..4 = V1..V5)
for r in range(4):
    for c in range(5):
        add(f"I{r}{c}", "intersection", VX[c], HY[r][c], name=f"{HNAMES[r][c]} / {VNAMES[c][min(r, 2)] or ''}".strip(" /"))

# --- horizontal street segments  Hr_c : between col c-1 and c (c=0 left edge, c=5 right edge)
for r in range(4):
    for c in range(6):
        if c == 0:
            x0, y0, x1, y1 = 0, HY[r][0], VX[0], HY[r][0]
            a, b = None, f"I{r}0"
        elif c == 5:
            x0, y0, x1, y1 = VX[4], HY[r][4], W, HY[r][4]
            a, b = f"I{r}4", None
        else:
            x0, y0, x1, y1 = VX[c-1], HY[r][c-1], VX[c], HY[r][c]
            a, b = f"I{r}{c-1}", f"I{r}{c}"
        id = f"H{r}_{c}"
        add(id, "street", (x0+x1)/2, (y0+y1)/2, name=HNAMES[r][c] or f"{HNAMES[r][c-1]} (east end)", seg=[x0, y0, x1, y1])
        if a: link(id, a)
        if b: link(id, b)

# --- vertical street segments  Vc_r : between row r and r+1 (r=0..2)
for c in range(5):
    for r in range(3):
        if c == 2 and r == 1:
            continue  # the Park fills the block between H2 and H3 at V3
        x0, y0, x1, y1 = VX[c], HY[r][c], VX[c], HY[r+1][c]
        id = f"V{c}_{r}"
        add(id, "street", (x0+x1)/2, (y0+y1)/2, name=VNAMES[c][r] or "Park edge", seg=[x0, y0, x1, y1])
        link(id, f"I{r}{c}")
        link(id, f"I{r+1}{c}")

# --- buildings.  res letters: f food, k know-how, c chem, h hardware, t tech, m meds, d duct tape
# acts: buy (items), sell, trade, gamble, free (pick-up), burgle, dive, hospital, police, park
# ent: entrance arrow positions (x, y) on the board art; snapped to nearest street segment.
B = []


def b(id, name, x, y, res="", acts=(), ent=(), sector=None, note=""):
    B.append(dict(id=id, name=name, x=x, y=y, res=res, acts=list(acts), ent=[list(e) for e in ent], note=note))


b("church", "Church", 150, 330, "", ["free"], [(312, 340)])
b("house1", "Residence (NW-1)", 113, 457, "", ["burgle"], [(125, 545)])
b("house2", "Residence (NW-2)", 195, 437, "", ["burgle"], [(243, 545)])
b("steel", "Steel Plant", 520, 400, "h2t2", [], [(540, 245)])
b("truckstop", "Truck Stop", 680, 360, "k3h1c2", ["sell"], [(700, 553)], note="orange outline on board")
b("firestation", "Fire Station", 1010, 340, "c3", [], [(1015, 245)])
b("autoshop", "Auto Shop", 1198, 335, "h1c1", [], [(1198, 245)])
b("library", "Library", 1000, 470, "k3", [], [(1068, 553)])
b("dental", "Dental Clinic", 1185, 465, "m2", [], [(1227, 553)])
b("hospital", "Hospital", 1560, 380, "m5", ["hospital"], [(1465, 553)])
b("gunshop", "Gun Shop", 1990, 330, "", ["buy"], [(1894, 317)])
b("salvage", "Salvage Yard", 2150, 330, "h2t2k3", ["sell"], [(2201, 245)])
b("gas", "Gas Station", 2040, 440, "c3", [], [(1894, 477)])
b("theater", "Theater", 2200, 450, "d1", [], [(2278, 478), (2101, 553)])
b("house3", "Residence (NE-1)", 2419, 348, "", ["burgle"], [(2338, 317)])
b("house4", "Residence (NE-2)", 2455, 447, "", ["burgle"], [(2338, 470)])
b("dumpsterNE", "Dumpster (NE)", 2506, 192, "", ["dive"], [(2438, 185)])
b("police", "Police Station", 2050, 770, "", ["police"], [(1894, 768)])
b("grocery", "Grocery Store", 2260, 760, "f2", [], [(2288, 747)])
b("music", "Music Store", 2200, 940, "t1", [], [(2173, 1000)])
b("drugs", "Drugs", 2285, 900, "m1c1", [], [(2288, 960)])
b("pet", "Pet Store", 1990, 930, "f2", [], [(2173, 1000)], note="orange outline on board")
b("house5", "Residence (E-1)", 2419, 708, "", ["burgle"], [(2433, 643)])
b("house6", "Residence (E-2)", 2468, 830, "", ["burgle"], [(2366, 830)])
b("house7", "Residence (E-3)", 2488, 963, "", ["burgle"], [(2366, 955)])
b("park", "Central Park", 1350, 820, "", ["park"],
  [(1110, 662), (1562, 662), (866, 840), (1803, 840), (1110, 1025), (1562, 1025)])
b("trainstation", "Train Station", 180, 790, "", [], [(307, 933)])
b("hardwarestore", "Hardware Store", 420, 770, "h1c1t1", ["buy"], [(370, 742)])
b("school", "School", 560, 850, "c2k2", [], [(790, 793)], note="yellow outline on board")
b("cafe", "Cafe", 385, 920, "f2", [], [(455, 1026)], note="yellow outline on board")
b("powerplant", "Power Plant", 200, 1300, "", [], [(203, 1116)])
b("prison", "Prison", 500, 1215, "", ["trade", "sell"], [(505, 1116)])
b("gym", "Gym", 700, 1195, "m1f1", [], [(702, 1133)])
b("boatyard", "Boat Yard", 700, 1330, "h2c2", [], [(772, 1295)])
b("citydump", "City Dump", 520, 1420, "h2t2", [], [(510, 1490)])
b("dumpsterSW", "Dumpster (SW)", 113, 1521, "", ["dive"], [(203, 1518)])
b("deptstore", "Department Store", 1090, 1230, "h2t2k2", [], [(1075, 1125)])
b("house8", "Residence (S-1)", 908, 1450, "", ["burgle"], [(947, 1518)])
b("house9", "Residence (S-2)", 1100, 1472, "", ["burgle"], [(1068, 1515)])
b("house10", "Residence (S-3)", 1227, 1430, "", ["burgle"], [(1217, 1511)])
b("bigstorage", "Big Storage", 1470, 1255, "m1f1h1d1t1k1c1", [], [(1508, 1125)])
b("offices", "Offices", 1700, 1290, "h2t2", [], [(1826, 1320)], note="orange outline on board")
b("restaurant", "Restaurant", 1530, 1430, "f2", [], [(1536, 1511)])
b("bookstore", "Book Store", 1690, 1430, "k2", [], [(1783, 1441)])
b("casino", "Casino", 1960, 1330, "", ["gamble"], [(1894, 1185)])
b("thrift", "Thrift Store", 2170, 1230, "h1c1t1", [], [(2296, 1238)], note="yellow outline on board")
b("bar", "Bar", 2020, 1470, "c1", [], [(1894, 1463)])
b("pizza", "Pizza House", 2150, 1480, "f2", [], [(2116, 1551)])
b("pawn", "Pawn Shop", 2250, 1480, "h2", ["sell"], [(2301, 1489)])
b("basketball", "Basketball Court", 2440, 1230, "", ["trade"], [(2455, 1113)])
b("harbor", "Harbor Office", 2500, 1480, "", [], [(2346, 1463)])

SUBWAY = ["I00", "I04", "I12", "H2_0", "I24", "I32"]   # S stations on the board art


def seg_dist(px, py, s):
    x0, y0, x1, y1 = s
    dx, dy = x1-x0, y1-y0
    L = dx*dx+dy*dy
    t = 0 if L == 0 else max(0, min(1, ((px-x0)*dx+(py-y0)*dy)/L))
    return math.hypot(px-(x0+t*dx), py-(y0+t*dy))


def nearest_street(px, py):
    best, bd = None, 1e9
    for n in nodes.values():
        if n["kind"] == "street":
            d = seg_dist(px, py, n["seg"])
            if d < bd:
                best, bd = n["id"], d
    return best


RES = dict(f="food", k="knowhow", c="chem", h="hardware", t="tech", m="meds", d="ducttape")


def parse_res(s):
    out, i = {}, 0
    while i < len(s):
        out[RES[s[i]]] = int(s[i+1]); i += 2
    return out


# True door positions come from the board PDF (each entrance is a placed grey box with a double arrow):
# tools/doors.json = [{x, y, orient}] in board-image pixels. orient 'H' = left/right arrow (door opens onto a vertical road),
# 'V' = up/down arrow (door opens onto a horizontal road).
import json as _json, os as _os
DOORS = _json.load(open(_os.path.join(_os.path.dirname(__file__), "doors.json")))
DOORS = [d for d in DOORS if d["y"] < 1600]          # drop the legend sample ("Location entrance/exit") at the bottom of the board
DOOR_USED = set()


def snap_door(ex, ey):
    k = min(range(len(DOORS)), key=lambda i: math.hypot(DOORS[i]["x"]-ex, DOORS[i]["y"]-ey))
    d = DOORS[k]
    if math.hypot(d["x"]-ex, d["y"]-ey) > 40:
        return None, nearest_street(ex, ey), (ex, ey)
    DOOR_USED.add(k)
    want = "V" if d["orient"] == "H" else "H"
    cands = [n for n in nodes.values() if n["kind"] == "street" and n["id"][0] == want]
    best = min(cands, key=lambda n: seg_dist(d["x"], d["y"], n["seg"]))
    if seg_dist(d["x"], d["y"], best["seg"]) > 100:     # corner dumpsters: door sits on the end of the road
        best = nodes[nearest_street(d["x"], d["y"])]
    return k, best["id"], (d["x"], d["y"])


for bd in B:
    ents = []
    arrows = []
    for (ex, ey) in bd["ent"]:
        k, st, pos = snap_door(ex, ey)
        if k is None:
            print("WARNING: no door marker near", bd["id"], (ex, ey))
        ents.append(st)
        arrows.append(list(pos))
        link(bd["id"], st)
    bd["ent"] = arrows
    nodes[bd["id"]] = dict(id=bd["id"], kind="building", x=bd["x"], y=bd["y"], name=bd["name"],
                           setup=parse_res(bd["res"]), acts=bd["acts"], entrances=sorted(set(ents)),
                           entArrows=bd["ent"], note=bd["note"])

for s in SUBWAY:
    nodes[s]["subway"] = True

# sectors: even 3x3 grid over the board
def sector(x, y):
    names = [["NW", "N", "NE"], ["WC", "C", "EC"], ["SW", "S", "SE"]]
    return names[min(2, int(y/(H/3)))][min(2, int(x/(W/3)))]


for n in nodes.values():
    n["sector"] = sector(n["x"], n["y"])
    n.pop("seg", None) if False else None

out = dict(width=W, height=H, mmWidth=800, mmHeight=600, image="assets/board/board.jpg",
           nodes=list(nodes.values()), edges=[list(e) for e in sorted(edges)], subway=SUBWAY,
           startNode="park", policeNode="police", hospitalNode="hospital", churchNode="church",
           barNode="bar", dischargeNode="H1_3", casinoNode="casino",
           gridX=VX, gridY=HY)
json.dump(out, open("data/board.json", "w"), indent=1)
print(len(nodes), "nodes", len(edges), "edges")
print(f"doors used: {len(DOOR_USED)}/{len(DOORS)}; unused: {[i for i in range(len(DOORS)) if i not in DOOR_USED]}")
bad = [n["id"] for n in nodes.values() if n["kind"] == "building" and not n["entrances"]]
print("buildings w/o entrance:", bad)
for n in nodes.values():
    if n["kind"] == "building":
        print(f"{n['id']:14s} -> {n['entrances']}")
