# Nous: Figma adaptation

Reference: the supplied `AI Customer support SaaS Dashboard Ui kit.fig`, exported on 9 September 2026. The local file's native node data, styles and embedded images were decoded directly. This delivery updates the local web prototype; it does not modify or publish the Figma file.

## Source mapping

| Kit reference | Nous adaptation |
|---|---|
| Home, `16075:3367`, 1440 × 950 | Cool grey `#f3f4f6` workspace, Inter type, charcoal `#151823` headings and `#64666e` secondary text |
| Assistant panel, `16099:3875` | Persistent context and object inspector, 32 px corners, translucent white over the original embedded texture |
| Card, `16082:3801` | White typed-object cards, 20 px corners, subtle layered shadows |
| Pill navigation, `16082:3874` and `16082:3875` | Rounded view switcher with a white active pill |
| Command input, `16099:3932` | Translucent white command surface, 20 px corners, circular submit control |
| Chart and history panels, `16086:3861` and `16090:7503` | Rounded content surfaces shared by the map, evidence, decisions and document |

This is an adaptation of the kit's visual system to Nous, not a copy of its customer-support dashboard. The goal, typed objects, branching, source links, decision history and command interactions retain their established roles. The Nous green and supplied logo remain the brand identity.

## Bundled assets

- `../app/assets/workspace-texture.png`: exact embedded image `a6ff41334869ab2b7073680a2d8006d53b80c4a6`, used by the kit's Home and assistant panel.
- `../app/assets/nous-logo.png`: user-supplied artwork, retained unchanged as the source reference.
- `../app/assets/nous-logo.svg` and `nous-symbol.svg`: smooth vector outlines traced from the original supplied artwork. These are used throughout the interface and contain no embedded bitmap or background. The previous transparent PNG is retained as an unused intermediate asset.
- `../app/assets/fonts/`: Inter and Plus Jakarta Sans variable fonts, Latin subset, with SIL Open Font licences.

All runtime assets are local. Existing saved work is retained through the unchanged browser-storage key. The implementation uses a separate `kit-theme.css` adaptation layer and retains the original application structure and handlers.

## Review

The six article figures have been recaptured at 3200 × 2240 pixels. Desktop and mobile rendering were reviewed, and all 13 existing browser interaction checks passed after the adaptation. The command layer remains a local simulation with no model connected.
