# Town art prompt

The prompt used to generate the 31 images in this folder (ChatGPT image generation, regular chat, with `docs/assets/lumi-robot-mascot-design-reference.png` attached). Keep it to regenerate or extend the set in the same style.

Workflow that works: ask first for one *style sheet* image (Lumi, the Lemonade Stand, the bunny, the palette) and approve it, then generate one asset per message using the style sheet as reference. If style drifts, say "keep exactly the same style and character as the approved style sheet; only change X" and re-attach the sheet. If stray text appears, ask for "a completely blank sign". If a background isn't transparent, ask for "the same image as a PNG with a transparent background". Record which tool made the images and its terms of use.

```text
You are the illustrator for "Lumi's Town", part of a children's math-learning web app (ages 6–10). Lumi is a small friendly robot. Children teach Lumi math skills, and each skill opens a shop in Lumi's Town where Lumi serves animal customers. I need a set of matching art assets that a developer will layer and animate in code.

I've attached a reference sheet for Lumi. Keep Lumi's design exactly consistent with it.

## How to work
1. FIRST, create one "style sheet" image showing Lumi, the Lemonade Stand, the bunny customer, and the color palette together. Wait for my approval before continuing.
2. After I approve, create the assets below ONE PER MESSAGE, in the order listed. Use the approved style sheet as the reference for every asset so the style never drifts.
3. After each image, tell me its file name from the list, then wait for me to say "next".

## Art style (same for every asset)
- Bright, cozy storybook cartoon for young children: soft rounded shapes, clean medium-weight dark outlines, flat colors with gentle soft shading. Warm and friendly, never scary.
- Palette: sky blues, fresh greens, warm cream and wood tones. Lumi's colors are fixed: white/light-gray body, deep navy face screen (#0F2D3D), glowing cyan eyes and mouth, teal ear panels and chest light (#4FC3C7), small orange antenna tip (#FFB347).
- Soft daylight from the upper left. Consistent line weight across all assets.
- Original designs only. Do not imitate any existing studio, brand, game or character.

## Hard rules for every asset
- NO text, letters, numbers, price tags, signs with writing, or logos anywhere. (The app adds all words and numbers itself.) Shop signs must be blank boards or use simple pictures only (a lemon, a coin, a cookie).
- Every asset except the backgrounds must have a TRANSPARENT background (PNG), with the object centered, fully visible, not cropped, with a little empty margin.
- No drop shadows baked under objects (the app adds shadows).
- Characters: full body, standing, front or slight three-quarter view, feet at the bottom edge area.
- Keep characters gender-neutral and age-appropriate. No humans.

## Asset list (file name — size — description)

### Backgrounds (no transparency, wide)
1. town_background.png — 1920×1080 — Lumi's Town overview: blue sky with a few soft clouds and a sun, rolling green hills, a gentle road running left to right across the bottom third, a few trees and flowers. Leave clear empty ground where four shops will be placed (far left, center-left, center-right, far right), and an empty spot in the middle of the road for Lumi.
2. scene_background_lemonade.png — 1920×1080 — Sunny street corner with grass and a sidewalk, sky above. Empty middle for a shop.
3. scene_background_change.png — 1920×1080 — Same world, a calm town square with a bit of light-purple sky tint. Empty middle.
4. scene_background_coinjar.png — 1920×1080 — Same world, a soft blue morning by a little park. Empty middle.
5. scene_background_bakery.png — 1920×1080 — Same world, warm pink-and-gold afternoon with wheat-colored hills. Empty middle.

### Shops (transparent, 1024×1024, open version + closed version)
6. shop_lemonade_open.png — A wooden lemonade stand with a yellow-and-white striped awning, a lemonade pitcher and cups on the counter, a blank sign board with a lemon picture.
7. shop_lemonade_closed.png — The same stand, closed: awning rolled up, a cloth over the counter, no pitcher. Same angle and size.
8. shop_change_open.png — A small blue kiosk with a triangle roof, a little cash register on the counter, a few coins, a coin picture on the roof.
9. shop_change_closed.png — Same kiosk with the shutter pulled down.
10. shop_coinjar_open.png — A tiny shop shaped like a big glass jar with a green lid, half full of gold coins, with a small door.
11. shop_coinjar_closed.png — Same jar shop, empty of coins, door shut.
12. shop_bakery_open.png — A cozy pink bakery cottage with a chimney puffing a little smoke, a cookie picture above the door, warm light in the windows.
13. shop_bakery_closed.png — Same bakery, windows dark, no smoke, door shut.

### Lumi (transparent, 1024×1280, same design as the reference)
14. lumi_happy.png — Smiling with happy closed-arc eyes, arms relaxed.
15. lumi_thinking.png — Looking up, one hand on chin.
16. lumi_waving.png — Waving with one arm, friendly smile.
17. lumi_celebrating.png — Both arms up, big smile, a few small sparkles.
18. lumi_confused.png — Puzzled (not sad), scratching the side of its head.

### Customers (transparent, 1024×1280, each in two moods)
19. customer_bunny_waiting.png — A friendly lavender bunny, standing, looking expectantly.
20. customer_bunny_happy.png — Same bunny, very happy, mid-hop.
21. customer_bear_waiting.png — A friendly light-brown bear.
22. customer_bear_happy.png — Same bear, very happy.
23. customer_cat_waiting.png — A friendly orange cat.
24. customer_cat_happy.png — Same cat, very happy.
25. customer_duck_waiting.png — A friendly yellow duck.
26. customer_duck_happy.png — Same duck, very happy.

### Small props (transparent, 512×512)
27. prop_coin.png — One shiny gold coin, front view, no markings.
28. prop_lemonade_cup.png — A cup of lemonade with a straw.
29. prop_cookie.png — One round chocolate-chip cookie.
30. prop_cookie_tray.png — An empty metal baking tray, top-down at a slight angle.
31. prop_sparkle.png — A single cute four-point sparkle star (for celebrations).

Start with the style sheet now.
```
