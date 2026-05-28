# Rangoli Royale — Rules

A two-team strategy game on a rangoli/kolam dot grid. Pass one device around. Take turns. Block your rival.

## Setup

1. Two teams: **Team A** and **Team B**. Even number of players (2 to 12), alternating teams around the circle.
2. A grid of dots is drawn. Columns alternate team colors — every dot in an even column is Team A's, every dot in an odd column is Team B's.
3. Choose a **win mode** before the game starts:
   - **Longest line** — the unbroken straight chain of your team's edges with the most segments wins.
   - **Largest tree** — the largest connected cluster of your dots (counted by dots joined) wins.

## Your turn

On your turn, you must draw **one** straight line between two of **your team's** adjacent dots:

- **Vertical** — between two same-color dots in the **same column**, in adjacent rows.
- **Horizontal** — between two same-color dots **in the same row**, skipping one column (because columns alternate colors).

You cannot:

- Draw a line that already exists.
- Draw a line that **crosses or overlaps** any opponent line. This is the **blocking rule** — once a line is drawn, it locks out any opponent line that would share even a single point with it (including endpoints at the opponent's dots that your line passes through).

If you have **no legal moves**, your turn is skipped and the other team plays again.

## Game end

The game ends when **neither team has a legal move** remaining, or every legal edge has been claimed.

Both teams' scores are computed under the chosen win mode. The higher score wins. A tie is possible if both teams produce equal-length chains or equal-size trees.

## Strategy tips

- Horizontal lines pass through the opponent's dots between your two endpoints. Drawing them not only builds your chain but **blocks the opponent's verticals** in that column at those rows.
- Long lines and big trees aren't always compatible. A path that branches helps the tree score but breaks the line score.
- Watch where the opponent is building. A single horizontal line through a key column can split their longest line in two.
- Players sit in alternating-team order. On a small grid with many players, you'll find yourself playing the same kind of move repeatedly — coordinate with teammates by **drawing in different regions**.

## Cultural note

Rangoli (also called kolam, alpana, muggu, pookalam — names vary by region) is a South Asian tradition of decorating thresholds and courtyards with patterns drawn over a grid of dots. The grid is the canvas. This game turns the canvas into a contest.
