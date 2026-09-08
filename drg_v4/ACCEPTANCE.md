# BuildMitra DRG V4 Acceptance Rules

The generator is NOT accepted merely because an SVG renders.

For acceptance_test_30x40_g2.json:

1. Plot must remain exactly 30 ft x 40 ft.
2. Road/front must be SOUTH.
3. Half Parking must reserve approximately one car bay only.
4. Remaining Ground Floor must remain usable residential area.
5. Main pedestrian entrance must originate from SOUTH/front.
6. Main entrance must connect to foyer/living circulation.
7. No isolated room is permitted.
8. No room overlap is permitted.
9. Stair must connect every requested storey.
10. Stair location must remain vertically aligned.
11. Lift, when requested, must not overlap stair/lobby.
12. Wet areas should vertically stack where practical.
13. Ground, First and Second floors must all contain a valid plan.
14. Bedrooms must have realistic usable dimensions.
15. Kitchen must connect logically with dining/utility.
16. Toilets must not open directly into kitchen/pooja.
17. Habitable rooms should receive an exterior window wherever feasible.
18. Doors must lie on real shared wall/opening positions.
19. Drawing must show walls, doors, door swings, windows, stairs and dimensions.
20. Output style should resemble a professional residential floor-plan drawing,
    not a block packing diagram.
21. If hard constraints cannot be satisfied, reject the candidate instead of
    drawing an invalid floor plan.
22. Vastu is a planning preference unless the user explicitly requires it;
    it must never create overlaps or disconnected circulation.
