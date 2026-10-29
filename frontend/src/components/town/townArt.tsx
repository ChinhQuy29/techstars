import { useState, type ReactNode } from "react";
import type { Concept } from "../../api";
import type { LumiExpression } from "../mascot/lumiAssets";
import type { CritterKind } from "./Critter";
import { TOWN_ART_FILES } from "./townArtFiles";

/**
 * Lumi's Town illustrations (docs/04-character-ui-and-art.md, Town art). The art is the primary look;
 * every slot falls back to the SVG drawing when its file is missing or fails to load.
 * Pictures only: all words and numbers stay in code on top of them.
 */

const PLACE: Record<Concept, string> = { carry: "lemonade", borrow: "change", off_by_one: "coinjar", mul: "bakery" };

export const art = {
  townBackground: "town_background",
  sceneBackground: (c: Concept) => `scene_background_${PLACE[c]}`,
  shop: (c: Concept, open: boolean) => `shop_${PLACE[c]}_${open ? "open" : "closed"}`,
  customer: (kind: CritterKind, happy: boolean) => `customer_${kind}_${happy ? "happy" : "waiting"}`,
  lumi: (e: LumiExpression | "waving") =>
    e === "happy" ? "lumi_happy"
      : e === "thinking" ? "lumi_thinking"
      : e === "confused" ? "lumi_confused"
      : e === "celebrate" ? "lumi_celebrating"
      : "lumi_waving",
  prop: { coin: "prop_coin", cup: "prop_lemonade_cup", cookie: "prop_cookie", tray: "prop_cookie_tray", sparkle: "prop_sparkle" },
};

export function artUrl(name: string): string | null {
  return TOWN_ART_FILES.has(name) ? `/assets/town/${name}.webp` : null;
}

/** The illustration if it exists and loads, otherwise `fallback`. Decorative: captions carry the meaning. */
export function TownArt({ name, fallback = null, className = "", style }: {
  name: string;
  fallback?: ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  const url = artUrl(name);
  const [failed, setFailed] = useState<string | null>(null);
  if (!url || failed === url) return <>{fallback}</>;
  return (
    <img
      src={url}
      alt=""
      aria-hidden
      draggable={false}
      decoding="async"
      className={`pointer-events-none select-none ${className}`}
      style={style}
      onError={() => setFailed(url)}
    />
  );
}
