import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { CardRecipe } from "./types.js";
import { defaultRenderer, type CardRenderer, type AnimationMode } from './renderer.js';
import { cardDateLines } from './recipe.js';

export interface ArtCardProps {
  recipe: CardRecipe;
  renderer?: CardRenderer;
  animate?: boolean;
  animationMode?: AnimationMode;
  boost?: number;
  className?: string;
  showDate?: boolean;
  onClick?: () => void;
  style?: CSSProperties;
}

export function ArtCard({
  recipe,
  renderer = defaultRenderer,
  animate = false,
  animationMode = "full",
  boost = 0,
  className = "",
  showDate = false,
  onClick,
  style,
}: ArtCardProps) {
  const { animateCard, boostCard, cachedCardDataUrl, renderCardDataUrl } = renderer;
  const key = JSON.stringify(recipe);
  const [image, setImage] = useState(() => cachedCardDataUrl(recipe));
  const animationHost = useRef<HTMLDivElement>(null);
  const animatedCanvas = useRef<HTMLCanvasElement | null>(null);
  const previousBoost = useRef(boost);
  useEffect(() => {
    let current = true;
    const cached = cachedCardDataUrl(recipe);
    if (cached) setImage(cached);
    else if (!animate) {
      setImage(undefined);
      renderCardDataUrl(recipe)
        .then((url) => {
          if (current) setImage(url);
        })
        .catch(() => {});
    } else setImage(undefined);
    return () => {
      current = false;
    };
  }, [key, animate, renderer]);
  useEffect(() => {
    if (!animate || !animationHost.current) return;
    let current = true;
    // Visible surfaces are inexpensive 2D canvases. Their pixels come from a
    // single shared GPU renderer, even when every calendar day is animated.
    const canvas = document.createElement("canvas");
    Object.assign(canvas.style, {
      width: "100%",
      height: "100%",
      display: "block",
      pointerEvents: "none",
    });
    canvas.setAttribute("aria-hidden", "true");
    animationHost.current.appendChild(canvas);
    animatedCanvas.current = canvas;
    const stop = animateCard(canvas, recipe, {
      mode: animationMode,
      onError: () => {
        // Only render an extra static preview if the visible surface failed.
        renderCardDataUrl(recipe)
          .then((url) => {
            if (current) setImage(url);
          })
          .catch(() => {});
      },
    });
    return () => {
      current = false;
      stop();
      canvas.remove();
      animatedCanvas.current = null;
    };
  }, [animate, animationMode, key, renderer]);
  useEffect(() => {
    if (boost !== previousBoost.current && animatedCanvas.current) boostCard(animatedCanvas.current);
    previousBoost.current = boost;
  }, [boost, renderer]);
  const [year, date] = cardDateLines(recipe);
  const content = (
    <>
      {image && (
        <img
          src={image}
          alt=""
          draggable={false}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            display: "block",
          }}
        />
      )}
      {animate && (
        <div
          ref={animationHost}
          aria-hidden="true"
          style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
        />
      )}
      {showDate && (recipe.date || recipe.caption) && (
        <div
          className="art-card-date"
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            justifyContent: "flex-end",
            alignItems: "flex-start",
            padding: "var(--card-date-padding, 9%)",
            background: "linear-gradient(transparent 54%, rgba(0,0,0,.48))",
            color: "#fff",
            textAlign: "left",
            pointerEvents: "none",
          }}
        >
          {recipe.caption && (
            <span
              style={{
                fontSize: "clamp(10px, 4.7cqw, 19px)",
                marginBottom: "0.7em",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                maxWidth: "100%",
              }}
            >
              {recipe.caption}
            </span>
          )}
          {recipe.date && <span
            style={{
              fontSize: "clamp(10px, 7cqw, 28px)",
              lineHeight: 1.4,
              fontWeight: 500,
            }}
          >
            {year}
          </span>}
          {recipe.date && <span
            style={{
              fontSize: "clamp(13px, 9cqw, 38px)",
              lineHeight: 1.2,
              fontWeight: 500,
              letterSpacing: "-0.04em",
            }}
          >
            {date}
          </span>}
        </div>
      )}
    </>
  );
  const baseStyle: CSSProperties = {
    position: "relative",
    display: "block",
    aspectRatio: "2 / 3",
    overflow: "hidden",
    padding: 0,
    border: 0,
    background: "linear-gradient(150deg, #353b40, #202426)",
    containerType: "inline-size",
    color: "inherit",
    font: "inherit",
    ...style,
  };
  if (onClick)
    return (
      <button
        type="button"
        className={`art-card ${className}`}
        onClick={onClick}
        aria-label={[recipe.caption, year, date].filter(Boolean).join(" ") || recipe.theme}
        style={{ ...baseStyle, cursor: "pointer" }}
      >
        {content}
      </button>
    );
  return (
    <div
      className={`art-card ${className}`}
      style={baseStyle}
      role={showDate ? "img" : undefined}
      aria-label={showDate ? [recipe.caption, year, date].filter(Boolean).join(" ") || recipe.theme : undefined}
    >
      {content}
    </div>
  );
}

export default ArtCard;
