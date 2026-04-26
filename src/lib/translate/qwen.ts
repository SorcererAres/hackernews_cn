import { z } from "zod";

const ENDPOINT =
  "https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation";

const ResponseSchema = z.object({
  output: z.object({
    text: z.string().optional(),
    choices: z
      .array(
        z.object({
          message: z.object({
            content: z.string(),
          }),
        })
      )
      .optional(),
  }),
});

function buildPrompt(texts: string[], targetLang: "zh" | "en") {
  const langName = targetLang === "zh" ? "简体中文" : "英文";
  return [
    `你是专业技术翻译。把下面 JSON 数组里的文本翻译成${langName}。`,
    `要求：`,
    `- 逐项翻译，保持顺序与数量一致`,
    `- 不要解释，不要添加多余字段`,
    `- 仅输出 JSON 数组（字符串数组）`,
    ``,
    `输入：`,
    JSON.stringify(texts),
  ].join("\n");
}


function tryParseStringArray(s: string): string[] | null {
  try {
    const arr = JSON.parse(s);
    if (Array.isArray(arr) && arr.every((x) => typeof x === "string")) return arr;
  } catch {
    // ignore
  }
  return null;
}

function repairJsonArrayText(s: string) {
  let t = s.trim();

  // 常见：开头多了一个引号 => [""xxx ...
  t = t.replace(/^\[\s*""/g, '["');

  // 常见：数组元素内被多塞了反斜杠引号（轻量修复）
  t = t.replace(/\\"/g, '\"');

  return t;
}

function parseJsonStringArray(content: string): string[] | null {
  let s = content.trim();

  // 去掉常见 code fence
  s = s.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "");
  s = s.trim();

  s = repairJsonArrayText(s);

  // 直接 parse
  const direct = tryParseStringArray(s);
  if (direct) return direct;

  // 提取第一个 [ ... ] 段（有时前后会带说明文字）
  const m = s.match(/\[[\s\S]*\]/);
  if (m) {
    const inner = tryParseStringArray(m[0]);
    if (inner) return inner;
  }

  // 偶发：整体是一个 JSON 字符串，里面才是数组
  if (s.startsWith('"') && s.endsWith('"')) {
    try {
      const unwrapped = JSON.parse(s);
      if (typeof unwrapped === "string") {
        const again = tryParseStringArray(unwrapped);
        if (again) return again;
        const m2 = unwrapped.match(/\[[\s\S]*\]/);
        if (m2) {
          const inner2 = tryParseStringArray(m2[0]);
          if (inner2) return inner2;
        }
      }
    } catch {
      // ignore
    }
  }

  return null;
}

export async function translateBatch(params: {
  texts: string[];
  targetLang: "zh" | "en";
}): Promise<string[]> {
  const { texts, targetLang } = params;
  if (texts.length === 0) return [];

  const apiKey = process.env.DASHSCOPE_API_KEY;
  if (!apiKey) throw new Error("Missing DASHSCOPE_API_KEY");

  const body = {
    model: "qwen-mt-plus",
    input: {
      messages: [{ role: "user", content: buildPrompt(texts, targetLang) }],
    },
    parameters: {
      temperature: 0.1,
    },
  };

  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`DashScope failed: ${res.status} ${t}`);
  }

  const json = ResponseSchema.parse(await res.json());
  const content =
    json.output.choices?.[0]?.message.content ?? json.output.text ?? "";

  const arr = parseJsonStringArray(content);
  if (arr) return arr;

  throw new Error(`Unexpected translation output: ${content.slice(0, 200)}`);
}

