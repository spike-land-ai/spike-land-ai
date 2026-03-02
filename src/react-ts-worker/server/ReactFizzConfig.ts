// Fizz HTML String Generation Config
// Generates HTML strings from React elements for SSR

// HTML void elements that don't have closing tags
const VOID_ELEMENTS = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr",
]);

// HTML entities to escape
const ESCAPE_LOOKUP: Record<string, string> = {
  "&": "&amp;",
  ">": "&gt;",
  "<": "&lt;",
  '"': "&quot;",
  "'": "&#x27;",
};

const ESCAPE_REGEX = /[&><"']/g;

export function escapeHtml(text: string): string {
  return text.replace(ESCAPE_REGEX, (match) => ESCAPE_LOOKUP[match] ?? match);
}

// Prop name mappings
const PROP_TO_ATTR: Record<string, string> = {
  className: "class",
  htmlFor: "for",
  httpEquiv: "http-equiv",
  acceptCharset: "accept-charset",
  tabIndex: "tabindex",
  crossOrigin: "crossorigin",
  autoComplete: "autocomplete",
  autoFocus: "autofocus",
  autoPlay: "autoplay",
};

const BOOLEAN_ATTRS = new Set([
  "checked",
  "disabled",
  "hidden",
  "multiple",
  "readOnly",
  "required",
  "selected",
  "autoFocus",
  "autoPlay",
  "controls",
  "default",
  "defer",
  "formNoValidate",
  "loop",
  "muted",
  "noModule",
  "noValidate",
  "open",
  "playsInline",
  "reversed",
  "scoped",
  "seamless",
  "allowFullScreen",
  "async",
  "autofocus",
]);

// Properties to skip during attribute rendering
const SKIP_PROPS = new Set(["children", "key", "ref", "rawHtml"]);

export function pushStartInstance(type: string, props: Record<string, unknown>): string {
  let html = "<" + type;

  for (const propKey in props) {
    if (!props.hasOwnProperty(propKey)) continue;
    if (SKIP_PROPS.has(propKey)) continue;
    if (propKey.startsWith("on")) continue; // Skip event handlers

    const propValue = props[propKey];
    if (propValue == null || propValue === false) continue;

    if (propKey === "style") {
      html += ' style="' + renderStyleAttribute(propValue as Record<string, unknown>) + '"';
    } else {
      const attrName = PROP_TO_ATTR[propKey] || propKey.toLowerCase();

      if (BOOLEAN_ATTRS.has(propKey)) {
        if (propValue) {
          html += " " + attrName;
        }
      } else {
        html += " " + attrName + '="' + escapeHtml(String(propValue)) + '"';
      }
    }
  }

  html += ">";

  // Handle raw HTML content (from React's __html prop)
  if (props.rawHtml != null) {
    html += String(props.rawHtml);
  } else if (typeof props.children === "string" || typeof props.children === "number") {
    html += escapeHtml(String(props.children));
  }

  return html;
}

export function pushEndInstance(type: string): string {
  if (VOID_ELEMENTS.has(type)) {
    return "";
  }
  return "</" + type + ">";
}

export function pushTextInstance(text: string): string {
  return escapeHtml(text);
}

function renderStyleAttribute(style: Record<string, unknown>): string {
  let result = "";
  for (const key in style) {
    if (!style.hasOwnProperty(key)) continue;
    const value = style[key];
    if (value == null || value === "") continue;

    // Convert camelCase to kebab-case
    const cssKey = key.replace(/[A-Z]/g, (m) => "-" + m.toLowerCase());

    if (result) result += "; ";
    result += cssKey + ": ";

    if (typeof value === "number" && value !== 0 && !isUnitlessProperty(key)) {
      result += value + "px";
    } else {
      result += escapeHtml(String(value));
    }
  }
  return escapeHtml(result);
}

// CSS properties that accept unitless numbers
const UNITLESS_PROPERTIES = new Set([
  "animationIterationCount",
  "aspectRatio",
  "borderImageOutset",
  "borderImageSlice",
  "borderImageWidth",
  "boxFlex",
  "boxFlexGroup",
  "boxOrdinalGroup",
  "columnCount",
  "columns",
  "flex",
  "flexGrow",
  "flexPositive",
  "flexShrink",
  "flexNegative",
  "flexOrder",
  "gridArea",
  "gridRow",
  "gridRowEnd",
  "gridRowSpan",
  "gridRowStart",
  "gridColumn",
  "gridColumnEnd",
  "gridColumnSpan",
  "gridColumnStart",
  "fontWeight",
  "lineClamp",
  "lineHeight",
  "opacity",
  "order",
  "orphans",
  "tabSize",
  "widows",
  "zIndex",
  "zoom",
  "fillOpacity",
  "floodOpacity",
  "stopOpacity",
  "strokeDasharray",
  "strokeDashoffset",
  "strokeMiterlimit",
  "strokeOpacity",
  "strokeWidth",
]);

function isUnitlessProperty(name: string): boolean {
  return UNITLESS_PROPERTIES.has(name);
}

export function isVoidElement(type: string): boolean {
  return VOID_ELEMENTS.has(type);
}
