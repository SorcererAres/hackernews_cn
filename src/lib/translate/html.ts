import { parseFragment, serialize } from "parse5";

type NodeLike = {
  nodeName: string;
  childNodes?: NodeLike[];
  value?: string;
  __parent?: NodeLike;
  [k: string]: unknown;
};

function walk(
  node: NodeLike,
  fn: (n: NodeLike, parent: NodeLike | null) => void,
  parent: NodeLike | null = null
) {
  fn(node, parent);
  const childNodes: NodeLike[] | undefined = node.childNodes;
  if (!childNodes) return;
  for (const c of childNodes) walk(c, fn, node);
}

export function extractTranslatableText(html: string) {
  const rawDoc = parseFragment(html || "");
  const doc = attachParents(rawDoc as unknown as NodeLike);
  const safeSegments: { idx: number; node: NodeLike; text: string }[] = [];
  let idx = 0;
  walk(doc, (n, parent) => {
    if (n.nodeName !== "#text") return;
    const text = String(n.value ?? "");
    if (text.trim().length === 0) return;

    // ancestor scan：向上找 pre/code
    let cur: NodeLike | null = parent;
    while (cur) {
      if (cur.nodeName === "pre" || cur.nodeName === "code") return;
      cur = cur.__parent ?? null;
    }
    safeSegments.push({ idx: idx++, node: n, text });
  });

  return {
    doc,
    texts: safeSegments.map((s) => s.text),
    applyTranslations(translated: string[]) {
      for (let i = 0; i < safeSegments.length; i++) {
        const seg = safeSegments[i];
        seg.node.value = translated[i] ?? seg.text;
      }
      return serialize(rawDoc);
    },
  };
}

// 为 ancestor scan 注入 parent 指针（parse5 默认无 parent）
export function attachParents(doc: NodeLike) {
  walk(doc, (n, parent) => {
    if (parent) n.__parent = parent;
  });
  return doc;
}

