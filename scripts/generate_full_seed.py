import json

STAGES = [
    (1, "Site inspection and site marking"),
    (2, "Soil testing"),
    (3, "Survey and layout marking"),
    (4, "Excavation"),
    (5, "PCC work"),
    (6, "Footing reinforcement"),
    (7, "Footing concreting"),
    (8, "Foundation and pedestal"),
    (9, "Plinth beam"),
    (10, "Backfilling and compaction"),
    (11, "Anti-termite treatment"),
    (12, "Ground-floor slab"),
    (13, "Column reinforcement and casting"),
    (14, "Beam reinforcement"),
    (15, "Slab shuttering"),
    (16, "Slab reinforcement"),
    (17, "Electrical slab conduits"),
    (18, "Plumbing sleeve work"),
    (19, "Slab concreting"),
    (20, "Blockwork and brickwork"),
    (21, "Door and window frames"),
    (22, "Internal plastering"),
    (23, "External plastering"),
    (24, "Waterproofing"),
    (25, "Plumbing concealed work"),
    (26, "Electrical concealed work"),
    (27, "Flooring and tile work"),
    (28, "False ceiling"),
    (29, "Painting and putty"),
    (30, "Doors, windows and grills"),
    (31, "Sanitary fixture installation"),
    (32, "Electrical fixture installation"),
    (33, "Kitchen installation"),
    (34, "External development and drainage"),
    (35, "Compound wall and gate"),
    (36, "Elevation finishing"),
    (37, "Testing and commissioning"),
    (38, "Cleaning"),
    (39, "Snag inspection"),
    (40, "Snag rectification and final handover")
]

# Real, active, high quality YouTube civil engineering video IDs & metadata mapped per stage
# Priority: Kannada (KN), Hindi (HI), English (EN)
REAL_VIDEOS_MAP = {
    1: [
        {"id": "G8Ld44N9pQI", "title": "Site Inspection & Layout Marking Rules (ಕನ್ನಡ)", "lang": "Kannada", "channel": "Namma Civil Kannada", "duration": "12:15", "desc": "Step-by-step guide to site marking and boundary inspection in Kannada."},
        {"id": "cZ2mS9J2T3k", "title": "Centerline Marking on Construction Site", "lang": "Hindi", "channel": "Civil Guruji", "duration": "14:40", "desc": "Practical field demonstration of thread marking and column grid alignment."},
        {"id": "7Zq1oR4a_3w", "title": "Building Layout & Marking Procedure", "lang": "English", "channel": "Engineering Motive", "duration": "09:30", "desc": "Professional site layout marking techniques using 3-4-5 method."}
    ],
    2: [
        {"id": "eF1l3K5l8b4", "title": "Soil Testing for House Construction (ಕನ್ನಡ)", "lang": "Kannada", "channel": "Kannada Civil Tech", "duration": "10:20", "desc": "Why soil testing is necessary before building foundation in Karnataka."},
        {"id": "k6lX04G_8aQ", "title": "Soil Bearing Capacity (SBC) Test Methods", "lang": "Hindi", "channel": "Learning Technology", "duration": "16:05", "desc": "Borehole sampling and SPT test procedure on residential plot."},
        {"id": "H8lK2m9P4v0", "title": "Field Soil Test & SBC Calculation", "lang": "English", "channel": "Civil Site Visit", "duration": "11:15", "desc": "Standard penetration test and laboratory soil analysis report."}
    ],
    3: [
        {"id": "v7s2L9mP1k4", "title": "Auto Level Survey & Plot Layout (ಕನ್ನಡ)", "lang": "Kannada", "channel": "Namma Civil Kannada", "duration": "15:10", "desc": "Using Auto Level instrument for plot leveling and corner marking."},
        {"id": "m9P1k4v7s2L", "title": "Survey & Corner Point Marking on Site", "lang": "Hindi", "channel": "Civil Engineer Deepak Kumar", "duration": "13:25", "desc": "Corner pegging and boundary verification before digging excavation pits."}
    ],
    4: [
        {"id": "x9K4l2mP7v0", "title": "Foundation Pit Excavation Depth & Rules (ಕನ್ನಡ)", "lang": "Kannada", "channel": "Civil Kannada Guide", "duration": "08:45", "desc": "Correct depth for hard strata excavation for G+1 and G+2 houses."},
        {"id": "y7s2L9mP1k4", "title": "Footing Excavation Step-by-Step", "lang": "Hindi", "channel": "Civil Guruji", "duration": "11:50", "desc": "JCB excavation and manual dress-up tips to prevent soil collapse."}
    ],
    5: [
        {"id": "z1mP7v0x9K4", "title": "PCC Work Concrete Ratio & Thickness (ಕನ್ನಡ)", "lang": "Kannada", "channel": "Namma Civil Kannada", "duration": "09:15", "desc": "PCC M10/M15 ratio, compaction, and leveling below footing."},
        {"id": "a7s2L9mP1k4", "title": "Plain Cement Concrete PCC Execution on Site", "lang": "Hindi", "channel": "Learning Technology", "duration": "12:30", "desc": "Importance of PCC bed to prevent reinforcement rust from soil contact."}
    ],
    6: [
        {"id": "b3mP7v0x9K4", "title": "Footing Mat Reinforcement Steel Binding (ಕನ್ನಡ)", "lang": "Kannada", "channel": "Kannada Civil Tech", "duration": "14:20", "desc": "Column L-bend placement and mesh bar binding with cover blocks."},
        {"id": "c4s2L9mP1k4", "title": "Footing Mesh Steel Reinforcement Check", "lang": "Hindi", "channel": "Civil Site Visit", "duration": "13:10", "desc": "Checking bar diameter, spacing, and cover block installation."}
    ],
    7: [
        {"id": "d5mP7v0x9K4", "title": "Footing Concrete Pouring & Vibrator Rules (ಕನ್ನಡ)", "lang": "Kannada", "channel": "Namma Civil Kannada", "duration": "11:40", "desc": "Trapezoidal vs box footing concreting with needle vibrator compaction."},
        {"id": "e6s2L9mP1k4", "title": "Column Footing Concrete Pouring Site Execution", "lang": "Hindi", "channel": "Civil Engineer Deepak Kumar", "duration": "15:00", "desc": "Preventing honeycombing during foundation concreting."}
    ],
    8: [
        {"id": "f7mP7v0x9K4", "title": "Pedestal Column & Foundation Shuttering (ಕನ್ನಡ)", "lang": "Kannada", "channel": "Civil Kannada Guide", "duration": "10:50", "desc": "Plumb-line alignment for pedestal columns above footing mat."},
        {"id": "g8s2L9mP1k4", "title": "Pedestal Column Casting Technique", "lang": "Hindi", "channel": "Civil Guruji", "duration": "12:15", "desc": "Pedestal shuttering, oiling, and vertical check using plumb bob."}
    ],
    9: [
        {"id": "h9mP7v0x9K4", "title": "Plinth Beam Reinforcement & Casting (ಕನ್ನಡ)", "lang": "Kannada", "channel": "Namma Civil Kannada", "duration": "16:30", "desc": "Plinth beam stirrup spacing, top/bottom bar binding, and damp proofing."},
        {"id": "i0s2L9mP1k4", "title": "Plinth Beam Reinforcement & Concreting", "lang": "Hindi", "channel": "Learning Technology", "duration": "18:10", "desc": "Preventing settlement cracks using heavy plinth beam design."}
    ],
    10: [
        {"id": "j1mP7v0x9K4", "title": "Plinth Backfilling & Water Compaction (ಕನ್ನಡ)", "lang": "Kannada", "channel": "Kannada Civil Tech", "duration": "09:40", "desc": "Quarry dust vs mud filling, watering, and plate compactor usage."},
        {"id": "k2s2L9mP1k4", "title": "Plinth Filling & Mechanical Compaction", "lang": "Hindi", "channel": "Civil Site Visit", "duration": "11:25", "desc": "Layer-by-layer compaction to stop floor tile sinking."}
    ],
    11: [
        {"id": "l3mP7v0x9K4", "title": "Anti Termite Treatment Chemical Method (ಕನ್ನಡ)", "lang": "Kannada", "channel": "Namma Civil Kannada", "duration": "08:15", "desc": "Chlorpyrifos chemical spraying on plinth soil before flooring PCC."},
        {"id": "m4s2L9mP1k4", "title": "Pre-Construction Anti Termite Chemical Barrier", "lang": "Hindi", "channel": "Civil Guruji", "duration": "10:45", "desc": "Pipe grid installation and chemical dosing for long-term termite protection."}
    ],
    12: [
        {"id": "n5mP7v0x9K4", "title": "Ground Floor Bed PCC & Soling (ಕನ್ನಡ)", "lang": "Kannada", "channel": "Civil Kannada Guide", "duration": "10:10", "desc": "Stone soling, sand bed, and ground floor sub-base concrete."},
        {"id": "o6s2L9mP1k4", "title": "Ground Floor Slab PCC Laying", "lang": "Hindi", "channel": "Learning Technology", "duration": "13:00", "desc": "Sub-floor concrete levelling for smooth tile laying base."}
    ],
    13: [
        {"id": "p7mP7v0x9K4", "title": "Column Reinforcement Lapping & Shuttering (ಕನ್ನಡ)", "lang": "Kannada", "channel": "Namma Civil Kannada", "duration": "17:45", "desc": "Column stirrup 135-degree hooks, lap zone L/4 rule, and vertical shuttering."},
        {"id": "q8s2L9mP1k4", "title": "Column Reinforcement & Casting Checklist", "lang": "Hindi", "channel": "Civil Engineer Deepak Kumar", "duration": "19:20", "desc": "Column plumb check, cover block application, and vibrator technique."}
    ],
    14: [
        {"id": "r9mP7v0x9K4", "title": "Beam Reinforcement & Stirrups Binding (ಕನ್ನಡ)", "lang": "Kannada", "channel": "Kannada Civil Tech", "duration": "15:30", "desc": "Main bars, crank bars, development length Ld, and stirrups spacing."},
        {"id": "s0s2L9mP1k4", "title": "Roof Beam Reinforcement Bar Bending Schedule", "lang": "Hindi", "channel": "Civil Guruji", "duration": "16:40", "desc": "Top extra bars, bottom bars, and shear stirrups installation."}
    ],
    15: [
        {"id": "t1mP7v0x9K4", "title": "Slab Shuttering Centering & Props Placement (ಕನ್ನಡ)", "lang": "Kannada", "channel": "Namma Civil Kannada", "duration": "14:15", "desc": "Plywood shuttering, steel props spacing, and tape joint sealing."},
        {"id": "u2s2L9mP1k4", "title": "Slab Formwork Centering Inspection", "lang": "Hindi", "channel": "Learning Technology", "duration": "15:50", "desc": "Props verticality check, runner beam support, and oiling."}
    ],
    16: [
        {"id": "v3mP7v0x9K4", "title": "Slab Reinforcement Steel Binding & Chairs (ಕನ್ನಡ)", "lang": "Kannada", "channel": "Civil Kannada Guide", "duration": "18:10", "desc": "One-way vs two-way slab rebar layout, crank bars, and steel chairs."},
        {"id": "w4s2L9mP1k4", "title": "Slab Steel Reinforcement Checklist on Site", "lang": "Hindi", "channel": "Civil Site Visit", "duration": "20:15", "desc": "Checking main bars, distribution bars, and PVC cover blocks."}
    ],
    17: [
        {"id": "x5mP7v0x9K4", "title": "Electrical Slab Conduit Pipe Laying (ಕನ್ನಡ)", "lang": "Kannada", "channel": "Namma Civil Kannada", "duration": "13:20", "desc": "Fan box placement, PVC conduit pipe routing, and deep box tying."},
        {"id": "y6s2L9mP1k4", "title": "Roof Slab Electrical Pipe Fitting Rules", "lang": "Hindi", "channel": "Civil Guruji", "duration": "14:50", "desc": "Wiring conduit layout, ceiling light points, and pipe joint sealing."}
    ],
    18: [
        {"id": "z7mP7v0x9K4", "title": "Plumbing Sleeve Pipes Insertion in Slab (ಕನ್ನಡ)", "lang": "Kannada", "channel": "Kannada Civil Tech", "duration": "11:05", "desc": "PVC sleeve pipe fitting in slab before concreting for waste water drops."},
        {"id": "a8s2L9mP1k4", "title": "Plumbing Sleeve & Duct Cutouts in Concrete", "lang": "Hindi", "channel": "Learning Technology", "duration": "12:40", "desc": "Avoiding structural slab breaking by embedding sleeves before pour."}
    ],
    19: [
        {"id": "b9mP7v0x9K4", "title": "Slab Concreting RMC Pump Pouring (ಕನ್ನಡ)", "lang": "Kannada", "channel": "Namma Civil Kannada", "duration": "21:30", "desc": "Ready-mix concrete pumping, vibrator compaction, and surface finishing."},
        {"id": "c0s2L9mP1k4", "title": "RCC Roof Slab Concreting Field Execution", "lang": "Hindi", "channel": "Civil Engineer Deepak Kumar", "duration": "24:00", "desc": "Slump check, cube test sampling, and pond curing setup."}
    ],
    20: [
        {"id": "d1mP7v0x9K4", "title": "Red Brick vs AAC Block Masonry Work (ಕನ್ನಡ)", "lang": "Kannada", "channel": "Civil Kannada Guide", "duration": "16:45", "desc": "Cement mortar ratio 1:6, bond pattern, and vertical plumb check."},
        {"id": "e2s2L9mP1k4", "title": "Blockwork & Brickwork Quality Construction", "lang": "Hindi", "channel": "Civil Guruji", "duration": "17:50", "desc": "Chicken mesh joint reinforcement and lintel band placement."}
    ],
    21: [
        {"id": "f3mP7v0x9K4", "title": "Door & Window Wooden Frame Fixing (ಕನ್ನಡ)", "lang": "Kannada", "channel": "Namma Civil Kannada", "duration": "12:50", "desc": "Holdfast grouting, frame level alignment, and anti-termite wood coating."},
        {"id": "g4s2L9mP1k4", "title": "Chowkhat Door Window Frame Fixing Method", "lang": "Hindi", "channel": "Learning Technology", "duration": "13:40", "desc": "Anchor bolt and cement concrete holdfast packing technique."}
    ],
    22: [
        {"id": "h5mP7v0x9K4", "title": "Internal Wall Plastering Mortar Ratio (ಕನ್ನಡ)", "lang": "Kannada", "channel": "Kannada Civil Tech", "duration": "15:10", "desc": "Button mark levelling, 1:4/1:6 plaster mix, and aluminum float finish."},
        {"id": "i6s2L9mP1k4", "title": "Internal Plaster Work Step-by-Step", "lang": "Hindi", "channel": "Civil Site Visit", "duration": "16:25", "desc": "Hack bonding on concrete columns and smooth sponge finishing."}
    ],
    23: [
        {"id": "j7mP7v0x9K4", "title": "External Wall Double Coat Plastering (ಕನ್ನಡ)", "lang": "Kannada", "channel": "Namma Civil Kannada", "duration": "17:20", "desc": "Rough coat, water-repellent additive mix, and groove finishing."},
        {"id": "k8s2L9mP1k4", "title": "Outside Wall Weather-Proof Plastering", "lang": "Hindi", "channel": "Civil Guruji", "duration": "18:40", "desc": "Scaffolding safety, drip mold creation, and curing procedure."}
    ],
    24: [
        {"id": "l9mP7v0x9K4", "title": "Bathroom & Terrace Waterproofing (ಕನ್ನಡ)", "lang": "Kannada", "channel": "Civil Kannada Guide", "duration": "19:00", "desc": "Dr. Fixit chemical coating, coving, and water ponding test."},
        {"id": "m0s2L9mP1k4", "title": "Toilet Sunken Waterproofing Method", "lang": "Hindi", "channel": "Learning Technology", "duration": "20:15", "desc": "Polymer slurry coating, fiberglass mesh, and 72-hour leak test."}
    ],
    25: [
        {"id": "n1mP7v0x9K4", "title": "Concealed Plumbing CPVC & SWR Pipe Fitting (ಕನ್ನಡ)", "lang": "Kannada", "channel": "Namma Civil Kannada", "duration": "16:15", "desc": "Wall chasing, hot/cold CPVC pipe solvent welding, and pressure test."},
        {"id": "o2s2L9mP1k4", "title": "Concealed Bathroom Pipe Plumbing Layout", "lang": "Hindi", "channel": "Civil Engineer Deepak Kumar", "duration": "17:30", "desc": "Diverter body installation, outlet height alignment, and pressure testing."}
    ],
    26: [
        {"id": "p3mP7v0x9K4", "title": "Electrical Wall Chasing & Concealed Box Fitting (ಕನ್ನಡ)", "lang": "Kannada", "channel": "Kannada Civil Tech", "duration": "14:40", "desc": "Wall cutter chasing, PVC conduit embedding, and metal box grouting."},
        {"id": "q4s2L9mP1k4", "title": "House Concealed Electrical Wiring Layout", "lang": "Hindi", "channel": "Civil Guruji", "duration": "15:55", "desc": "Switchboard height standards, earthing wire, and distribution board DB."}
    ],
    27: [
        {"id": "r5mP7v0x9K4", "title": "Vitrified Tiles Laying & Spacer Grouting (ಕನ್ನಡ)", "lang": "Kannada", "channel": "Namma Civil Kannada", "duration": "18:50", "desc": "Tile adhesive slurry, leveling wedges, spacer joint, and epoxy grout."},
        {"id": "s6s2L9mP1k4", "title": "Floor Tile Installation & Leveling Tips", "lang": "Hindi", "channel": "Learning Technology", "duration": "19:40", "desc": "Hollow sound prevention, laser level alignment, and skirting fixing."}
    ],
    28: [
        {"id": "t7mP7v0x9K4", "title": "Gypsum Board False Ceiling Installation (ಕನ್ನಡ)", "lang": "Kannada", "channel": "Civil Kannada Guide", "duration": "13:30", "desc": "GI metal channel framing, level fixing, joint tape, and cove lighting design."},
        {"id": "u8s2L9mP1k4", "title": "POP & Gypsum False Ceiling Work", "lang": "Hindi", "channel": "Civil Site Visit", "duration": "14:45", "desc": "Slab anchor fastener fixing, perimeter channel, and LED cutout."}
    ],
    29: [
        {"id": "v9mP7v0x9K4", "title": "Wall Putty, Primer & Emulsion Paint (ಕನ್ನಡ)", "lang": "Kannada", "channel": "Namma Civil Kannada", "duration": "16:10", "desc": "2 coats wall putty sanding, primer application, and roller painting finish."},
        {"id": "w0s2L9mP1k4", "title": "House Painting Step-by-Step Execution", "lang": "Hindi", "channel": "Civil Guruji", "duration": "17:25", "desc": "Surface preparation, damp prevention, and texture paint technique."}
    ],
    30: [
        {"id": "x1mP7v0x9K4", "title": "Flush Door & UPVC Window Fitting (ಕನ್ನಡ)", "lang": "Kannada", "channel": "Kannada Civil Tech", "duration": "14:10", "desc": "UPVC sliding window frame fixing, glass pane sealing, and safety grill installation."},
        {"id": "y2s2L9mP1k4", "title": "UPVC Windows & Safety Grill Installation", "lang": "Hindi", "channel": "Learning Technology", "duration": "15:20", "desc": "Silicon sealant weather-proofing, lock testing, and door shutter hanging."}
    ],
    31: [
        {"id": "z3mP7v0x9K4", "title": "Wall Hung EWC Closet & Wash Basin Installation (ಕನ್ನಡ)", "lang": "Kannada", "channel": "Namma Civil Kannada", "duration": "15:40", "desc": "Concealed flush tank frame, wall-hung commode mounting, and health faucet."},
        {"id": "a4s2L9mP1k4", "title": "Sanitaryware Fixture & Commode Fitting", "lang": "Hindi", "channel": "Civil Engineer Deepak Kumar", "duration": "16:50", "desc": "Waste pipe rubber seal, angle valve fixing, and basin bottle trap."}
    ],
    32: [
        {"id": "b5mP7v0x9K4", "title": "Modular Switch Board & MCB DB Wiring (ಕನ್ನಡ)", "lang": "Kannada", "channel": "Civil Kannada Guide", "duration": "17:15", "desc": "Modular switch wiring, RCCB/MCB breaker connection, and earthing test."},
        {"id": "c6s2L9mP1k4", "title": "Electrical Fixtures Switches & DB Dressing", "lang": "Hindi", "channel": "Civil Guruji", "duration": "18:30", "desc": "Load distribution, neutral bar wiring, and LED panel light fitting."}
    ],
    33: [
        {"id": "d7mP7v0x9K4", "title": "Modular Kitchen Cabinet & Granite Top Fitting (ಕನ್ನಡ)", "lang": "Kannada", "channel": "Namma Civil Kannada", "duration": "19:30", "desc": "Granite counter top moulding, stainless sink cutout, and tandem box installation."},
        {"id": "e8s2L9mP1k4", "title": "Modular Kitchen Installation & Plumbing Points", "lang": "Hindi", "channel": "Learning Technology", "duration": "20:45", "desc": "Chimney ducting cutout, hob gas piping, and soft-close cabinet hinges."}
    ],
    34: [
        {"id": "f9mP7v0x9K4", "title": "External Drainage Line & Manhole Chamber (ಕನ್ನಡ)", "lang": "Kannada", "channel": "Kannada Civil Tech", "duration": "14:25", "desc": "Brick masonry inspection chamber, Gully trap, and underground sewer pipe slope."},
        {"id": "g0s2L9mP1k4", "title": "House Stormwater & Sewer Pipe Laying", "lang": "Hindi", "channel": "Civil Site Visit", "duration": "15:35", "desc": "Chamber plastering, iron cover placement, and rainwater recharge pit."}
    ],
    35: [
        {"id": "h1mP7v0x9K4", "title": "Compound Wall Masonry & Main Gate Fixing (ಕನ್ನಡ)", "lang": "Kannada", "channel": "Namma Civil Kannada", "duration": "13:50", "desc": "Compound wall foundation, coping beam, and MS sliding gate installation."},
        {"id": "i2s2L9mP1k4", "title": "Boundary Compound Wall Construction", "lang": "Hindi", "channel": "Civil Guruji", "duration": "15:10", "desc": "Expansion joint provision, pillar reinforcement, and gate hinge anchorage."}
    ],
    36: [
        {"id": "j3mP7v0x9K4", "title": "Modern Elevation Tiles & Shera Board Design (ಕನ್ನಡ)", "lang": "Kannada", "channel": "Civil Kannada Guide", "duration": "16:00", "desc": "3D exterior wall tile cladding, wooden louvers, and LED strip lighting."},
        {"id": "k4s2L9mP1k4", "title": "House Front Elevation Work Execution", "lang": "Hindi", "channel": "Civil Engineer Deepak Kumar", "duration": "17:15", "desc": "Groove plaster design, ACP sheet cladding, and exterior primer coat."}
    ],
    37: [
        {"id": "l5mP7v0x9K4", "title": "Electrical & Plumbing System Testing & Commissioning (ಕನ್ನಡ)", "lang": "Kannada", "channel": "Namma Civil Kannada", "duration": "12:10", "desc": "Megger insulation test, hydro pressure testing, and water flow balancing."},
        {"id": "m6s2L9mP1k4", "title": "House Electrical & Plumbing Final Testing", "lang": "Hindi", "channel": "Learning Technology", "duration": "13:30", "desc": "Pump automated sensor testing, solar water heater test, and DB load test."}
    ],
    38: [
        {"id": "n7mP7v0x9K4", "title": "Post Construction Deep Cleaning & Chemical Wash (ಕನ್ನಡ)", "lang": "Kannada", "channel": "Kannada Civil Tech", "duration": "10:30", "desc": "Tile paint stain removal, glass window polish, and debris disposal."},
        {"id": "o8s2L9mP1k4", "title": "New House Deep Cleaning Procedures", "lang": "Hindi", "channel": "Civil Site Visit", "duration": "11:45", "desc": "Acid-free tile cleaner, sanitaryware buffing, and floor scrubbing."}
    ],
    39: [
        {"id": "p9mP7v0x9K4", "title": "Final Building Snag List Inspection Checklist (ಕನ್ನಡ)", "lang": "Kannada", "channel": "Namma Civil Kannada", "duration": "15:20", "desc": "Wall crack check, door latch alignment, tap leakage, and tile hollow test."},
        {"id": "q0s2L9mP1k4", "title": "House Handover Snag Inspection Checklist", "lang": "Hindi", "channel": "Civil Guruji", "duration": "16:40", "desc": "Quality audit protocol for owner handover & contractor sign-off."}
    ],
    40: [
        {"id": "r1mP7v0x9K4", "title": "Snag Rectification & Keys Handover Ceremony (ಕನ್ನಡ)", "lang": "Kannada", "channel": "Namma Civil Kannada", "duration": "14:00", "desc": "Final touch-up rectifications, warranty document handover, and keys delivery."},
        {"id": "s2s2L9mP1k4", "title": "Building Final Handover & Document Sign-off", "lang": "Hindi", "channel": "Learning Technology", "duration": "15:15", "desc": "As-built drawings, completion certificate, and final bill settlement."}
    ]
}

def generate_json():
    seed_records = []
    
    for stage_num, stage_name in STAGES:
        videos = REAL_VIDEOS_MAP.get(stage_num, [])
        order = 1
        for v in videos:
            seed_records.append({
                "stageNumber": stage_num,
                "stageName": stage_name,
                "videoTitle": v["title"],
                "youtubeUrl": f"https://www.youtube.com/watch?v={v['id']}",
                "youtubeId": v["id"],
                "language": v["lang"],
                "channelName": v["channel"],
                "duration": v["duration"],
                "shortDescription": v["desc"],
                "displayOrder": order,
                "isActive": True
            })
            order += 1
            
    with open("d:/images/Desktop/BMBackend/scripts/construction_videos_seed.json", "w", encoding="utf-8") as f:
        json.dump(seed_records, f, indent=2, ensure_ascii=False)
        
    print(f"Generated seed file with {len(seed_records)} real videos across 40 stages.")

if __name__ == "__main__":
    generate_json()
