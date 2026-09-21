# Making your own map

**Start here.** This guide takes you from "I have a map I drew in Paint" to "my world is clickable in the atlas".
No coding is needed. You'll be clicking on the map.

## The idea in one minute

Your Paint image is only a **guide**. You lay it on the screen, then click around each shape's edge. The atlas
remembers those clicks as an *outline* (a list of corner points) and saves it as a small file. The clickable, zoomable
map is built from those outlines, not from the image. When you're done, the image can go.

```
 Your Paint image  ──(you click around the shapes)──►  outlines saved as files  ──►  the interactive atlas
   (just a guide)          the Trace tool                 src/data/locations/
```

You do this once per shape: each country, each region, and each city.

## Before you start (about 5 minutes)

**1. Find out how big your image is, in pixels.**
Paint shows it in the bar along the bottom of the window (for example `1600 × 1000px`). If not, look under
*File → Properties*. Write the two numbers down.

**2. Put the image in the project.**
Copy your PNG into the folder `public/reference/`, for example `public/reference/my-map.png`.

**3. Tell the atlas about it.**
Open `src/data/world.json` and set `width` and `height` to your image's size, and add the `referenceImage` line:

```json
{
  "id": "my-world",
  "name": "My World",
  "map": {
    "width": 1600,
    "height": 1000,
    "referenceImage": { "src": "reference/my-map.png", "opacity": 0.5 }
  }
}
```

> **Why the size matters:** the numbers must match your image's pixel size so the outlines you click line up with the
> picture. If your outlines later look shifted or squashed compared with the image, this is almost always why.

**4. Clear out the demo world.**
Delete the `.json` files inside `src/data/locations/` (leave the folders), and delete
`src/lib/content/demoWorld.test.ts`. You can keep the demo files around until you're comfortable if you prefer. They'll
just be on the map together with your world.

**5. Start the atlas.**
```bash
npm run dev
```
Open the address it prints. You'll see your image, faded, over an empty map.

## Trace your first country

1. Click the **Trace** button (top right). A panel opens.
2. In the panel, choose **Country**.
3. **Click around the edge of the first shape**, one click per corner. A dashed line follows your clicks.
   - You only need a click where the edge *turns*. Ten to twenty points is plenty for a blob.
   - Scroll to zoom in for fiddly corners. **Drag** to move the map. Neither one adds a point.
   - Made a mistake? **Undo** (or press **Backspace**) removes the last point. **Clear** (or **Esc**) starts over.
4. Type the country's **Name**. The file name (id) fills itself in.
5. Press **Save**.

The page reloads for a moment and your country appears, in a colour of its own. The Trace tool stays switched on, so you
can go straight to the next one. Repeat for each country.

> **Two countries share a border?** Trace the first. When you trace the second, its clicks near the first country's
> corners *snap* onto them (you'll see a ring), so the shared border matches exactly with no gaps.

## Trace regions inside a country

1. **Click the country on the map** first. The map zooms in and its outline is on screen.
2. Open the Trace tool and choose **Region**. The **Inside** box is already set to the country you're viewing.
3. Click around the region's edge. Where the region's edge is the country's edge, click near the country's corners
   and they'll snap. Where two regions meet, trace the first, then trace the second along the first's corners.
4. Name it and **Save**.

> **Tip:** trace regions one country at a time. Snapping only sees the shapes the map is currently drawing, and a country's regions
> are only drawn once that country is selected. So selecting the country first is what lets you snap to its other regions.

## Place cities and other locations

1. **Click the region** on the map, so its area is on screen.
2. In the Trace tool choose **City** (a town, village, capital…) or **Point of interest** (a ruin, temple, battlefield…).
3. **Click once** where it goes. Click again to move it.
4. Type the name. Pick an **Icon** if you want something other than the default.
5. **Save.**

Cities show up on the map when their region is selected.

## The Trace tool at a glance

| You want to… | Do this |
| --- | --- |
| Add a corner | Click on the map |
| Remove the last corner | **Undo** button, or **Backspace** |
| Start the shape over | **Clear** button, or **Esc** |
| Move around / zoom | Drag / scroll (these never add points) |
| Place a corner *without* snapping | Hold **Alt** while clicking |
| Get the panel out of the way | **Move** button (swaps it to the other side of the map) |
| See your outline without the image behind it | Image button in the map controls (bottom left) |
| Get the file's text instead of saving | **Copy JSON**, then paste it into a new `.json` file yourself |

Saved files land in `src/data/locations/`: `countries/`, `regions/`, `cities/` or `points-of-interest/`.

## Finishing touches

**Give places some text.** The Trace tool records *where* things are. To describe them, open a place's file
(for example `src/data/locations/regions/my-region.json`) and add a `"summary"` line:

```json
"summary": "A cold frontier of pine forest and watchtowers.\n\nA blank line like this starts a new paragraph.",
```

**Match your Paint colours.** Countries get automatic earthy colours. To use the ones from your Paint legend, add a
`"color"` line with a hex code to the country's file: `"color": "#a9b78a"`. (Paint: *Edit colors* shows the hex value.)
Regions automatically use lighter or darker shades of their country's colour.

**Remove the guide image.** When everything lines up, delete the `referenceImage` line from `world.json`. (Keep the
`width` and `height`.)

## Changing something later

| To… | Do this |
| --- | --- |
| **Redraw a shape** | Click the place on the map, open **Trace**, press **Redraw "Name"**, click the new outline, press **Replace**. Its summary, colour and other settings are kept |
| **Move a city** | Same: select it, **Trace → Redraw**, click the new spot, **Replace** |
| **Nudge one corner** | Open the place's file and change that pair of numbers. While `npm run dev` is running, the bottom-right of the map shows the coordinates under your cursor, and **Shift-click** copies `[x, y]` |
| **Rename a place** | Edit the `"name"` line in its file. Leave the `"id"` alone, as it appears in web addresses and other files refer to it |
| **Delete a place** | Delete its file. Delete everything inside it first (a country's regions and cities), or the app will tell you they've lost their parent |
| **Fix the data by hand** | Every place is one small text file, and the app shows a readable message if something is wrong |

**What the tool can't do yet:** drag an individual corner to a new position, or delete from the screen. Both are planned
for the full map editor (Phase 4). Until then, the table above covers each case.

## If something goes wrong

**I can't see a Trace button.** It only exists while `npm run dev` is running. It's deliberately left out of the
built/published site.

**My outlines look shifted or the wrong shape compared with the image.**
The `width` and `height` in `world.json` don't match the image's pixel size. Set them to the exact size.

**Clicking doesn't add a point.**
Either the click landed on the tool's panel (press **Move** to swap sides, or drag the map so the shape isn't behind
it), or Trace is switched off (the button should be filled dark red).

**A corner won't go where I want because it keeps snapping.**
Hold **Alt** while you click. (On some Linux desktops the window manager claims Alt-click. In that case zoom in closer,
since snapping only grabs corners within a few pixels of the cursor.)

**Save says something failed.**
The message says why. Most often the *File name (id)* is empty or has capitals or spaces. Use lowercase letters, digits
and hyphens. If the message mentions the network, check `npm run dev` is still running in your terminal.

**My region or city doesn't appear after saving.**
Regions appear when their country is selected, and cities when their region is selected. Click through to it.

**The map shows a "data needs a fix" page.**
Read the message, which names the file. See the main README's Troubleshooting section for the common causes.

## Prefer to type it out?

You never have to use the Trace tool. Every place is a plain file, and you can write them by hand using the templates
in the main [README](../README.md#adding-a-country). The tool just writes those same files for you.
