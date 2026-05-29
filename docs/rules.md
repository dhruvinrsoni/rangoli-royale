# Rangoli Royale — Rules

A two-team strategy game on a rangoli/kolam dot grid. Pass one device around. Take turns. Draw lines. Block your rival.

## Setup

1. Two teams: **Team A** and **Team B**. Even number of players (2 to 12), alternating teams around the circle.
2. The board has **two equal-sized square grids of dots**, one per team, offset from each other by half a step in both directions:

   ```
   A    A    A    A
      B    B    B    B
   A    A    A    A
      B    B    B    B
   A    A    A    A
      B    B    B    B
   A    A    A    A
      B    B    B    B
   ```

   Both teams have the same number of dots and the same number of possible moves. Team B's grid is Team A's grid slid half a step right and half a step down — so a B dot sits in the middle of every "diamond" of four A dots, and the same for A inside B.

3. Choose a **win mode** at setup:
   - **Longest line** — the longest unbroken straight chain of your team's edges wins.
   - **Largest tree** — the largest connected cluster of your dots (counted by dots joined) wins.

## Your turn

On your turn, draw **one** straight line between two of **your team's** adjacent dots. That's any of:

- **Vertical** — between two same-team dots in the same column, in adjacent rows.
- **Horizontal** — between two same-team dots in the same row, in adjacent columns.

Both directions are always allowed. The grid is offset, so your team's column and row indices are independent of the other team's — drawing on your sub-grid never goes through your own dots.

You cannot:

- Draw a line that already exists.
- Draw a line that **crosses** an opponent line. Because the two sub-grids are offset, an A horizontal at row `r` passes between two rows of B dots; if any B vertical already bridges those two rows in that column, the two lines cross at an interior point — and that's a block. Same in reverse for B.

If you have **no legal moves**, your turn is skipped and the other team plays again.

## The blocking rule, visually

When A draws a horizontal at row 1 between A's column 0 and column 1:

```
A----A    A    A           A's line at y = 1·S
   B    B    B    B
A    A    A    A
   B    B    B    B
```

If B already drew a vertical between (B-col 0, B-row 0) and (B-col 0, B-row 1) — the line that goes from one B dot diagonally below to one diagonally above — those two lines cross at the interior point `(0.5·S, 1·S)`. Neither team can claim a line that crosses an opponent's already-claimed line.

This is the strategic core: every line you draw not only builds your own chain, it locks out one or more of the opponent's perpendicular moves.

## Game end

The game ends when **neither team has a legal move** remaining, or every legal edge has been claimed.

Both teams' scores are computed under the chosen win mode. The higher score wins. A tie is possible if both teams produce equal-length chains or equal-size trees.

## Strategy tips

- Lines you draw early are cheap — few opponent edges exist to block. Later moves get tighter as the board fills.
- A long horizontal line through the middle of the board cuts off multiple opponent verticals on the rows it crosses. Vice versa.
- Long lines and big trees aren't always compatible. A path that branches helps the tree score but breaks the line score. Decide your strategy before you commit to a direction.
- Players sit in alternating-team order. On a small grid with many players, you'll repeat the same kind of move quickly — coordinate with teammates by drawing in different regions of the board.

## Cultural note

Rangoli (also called kolam, alpana, muggu, pookalam — names vary by region) is a South Asian tradition of decorating thresholds and courtyards with patterns drawn over a grid of dots. The grid is the canvas. This game turns the canvas into a contest, with two sub-grids interlocking the way two rangolis would when they meet at a shared boundary.
