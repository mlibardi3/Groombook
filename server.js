
import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();

app.use(express.json({ limit: "18mb" }));
app.use(express.static(path.join(__dirname, "public")));

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const MODEL = process.env.OPENAI_MODEL || "gpt-5-mini";

function requireKey(req, res, next) {
  if (!OPENAI_API_KEY) {
    return res.status(500).json({
      error: "OPENAI_API_KEY is not configured on the server."
    });
  }
  next();
}

async function callVision({ imageDataUrl, prompt, schemaName, schema }) {
  const body = {
    model: MODEL,
    store: false,
    input: [{
      role: "user",
      content: [
        { type: "input_text", text: prompt },
        { type: "input_image", image_url: imageDataUrl, detail: "high" }
      ]
    }],
    text: {
      format: {
        type: "json_schema",
        name: schemaName,
        strict: true,
        schema
      }
    }
  };

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  const raw = await response.text();
  if (!response.ok) {
    throw new Error(`OpenAI API ${response.status}: ${raw}`);
  }

  const data = JSON.parse(raw);
  const text = data.output_text ??
    data.output?.flatMap(x => x.content || [])
      .find(x => x.type === "output_text")?.text;

  if (!text) throw new Error("No structured output was returned.");
  return JSON.parse(text);
}

const cardSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    client_name: { type: ["string","null"] },
    phone: { type: ["string","null"] },
    email: { type: ["string","null"] },
    address: { type: ["string","null"] },
    pets: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          pet_name: { type: ["string","null"] },
          breed: { type: ["string","null"] },
          age: { type: ["string","null"] },
          weight: { type: ["string","null"] },
          preferred_groomer: { type: ["string","null"] },
          service: { type: ["string","null"] },
          last_groom_date: { type: ["string","null"] },
          price: { type: ["string","null"] },
          haircut_groom_notes: { type: ["string","null"] },
          booking_instructions: { type: ["string","null"] },
          behavior_health_notes: { type: ["string","null"] },
          general_notes: { type: ["string","null"] }
        },
        required: [
          "pet_name","breed","age","weight","preferred_groomer","service",
          "last_groom_date","price","haircut_groom_notes","booking_instructions",
          "behavior_health_notes","general_notes"
        ]
      }
    },
    uncertain_fields: { type: "array", items: { type: "string" } }
  },
  required: ["client_name","phone","email","address","pets","uncertain_fields"]
};

const scheduleSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    schedule_date_or_week: { type: ["string","null"] },
    appointments: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          date: { type: ["string","null"], description: "YYYY-MM-DD if confidently inferable" },
          groomer: { type: ["string","null"] },
          client_name: { type: ["string","null"] },
          pet_name: { type: ["string","null"] },
          service: { type: ["string","null"] },
          capacity_type: { type: ["string","null"], description: "full, bath, two_bath_override, or unknown" },
          dropoff: { type: ["string","null"] },
          pickup: { type: ["string","null"] },
          groom_instructions: { type: ["string","null"] },
          booking_notes: { type: ["string","null"] }
        },
        required: ["date","groomer","client_name","pet_name","service","capacity_type","dropoff","pickup","groom_instructions","booking_notes"]
      }
    },
    uncertain_fields: { type: "array", items: { type: "string" } }
  },
  required: ["schedule_date_or_week","appointments","uncertain_fields"]
};

app.post("/api/scan-card", requireKey, async (req, res) => {
  try {
    const { imageDataUrl } = req.body;
    if (!imageDataUrl?.startsWith("data:image/")) return res.status(400).json({ error: "Image required." });

    const result = await callVision({
      imageDataUrl,
      schemaName: "grooming_client_card",
      schema: cardSchema,
      prompt: `Read this physical dog-grooming client card carefully.
Extract only information visible on the card. Do not invent unreadable data.

IMPORTANT FIELD-SEPARATION RULES:
- preferred_groomer contains ONLY a groomer's name or null. Never put dates, prices, services, initials, or haircut notes in this field.
- last_groom_date contains ONLY a visible grooming/visit date.
- price contains ONLY the visible price/charge.
- service contains the service label/abbreviation if visible.
- haircut_groom_notes contains haircut instructions, blade/comb lengths, style notes, coat instructions, or grooming shorthand.
- booking_instructions contains scheduling rules such as specific groomer, specific day, specific drop-off, "book in full groom spot", or similar.
- behavior_health_notes contains behavior, medical, safety, handling, allergy, bite, seizure, dryer, mobility, or senior-dog notes.
- general_notes is only for readable information that clearly does not belong in the other fields.
- If a handwritten line contains several concepts, split them into the appropriate fields instead of copying the whole line into one field.
- Preserve grooming shorthand exactly when possible (examples: #5AG, #A body, leave mane).
- A card can contain more than one pet.
- If a field is uncertain, set it to null when appropriate and describe the uncertainty in uncertain_fields.
This is a draft for HUMAN APPROVAL; accuracy and correct categorization are more important than filling every field.`
    });
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/scan-schedule", requireKey, async (req, res) => {
  try {
    const { imageDataUrl } = req.body;
    if (!imageDataUrl?.startsWith("data:image/")) return res.status(400).json({ error: "Image required." });

    const result = await callVision({
      imageDataUrl,
      schemaName: "grooming_schedule",
      schema: scheduleSchema,
      prompt: `Read this grooming-shop paper schedule.
Extract each visible appointment separately. Do not invent names or times.
Important shop concepts:
- A "full groom" is length off all over.
- A "bath" is bath/deshed/nails and sometimes light trimming.
- Drop-off and pickup are separate concepts.
- Normal mass drop-off is 7:30-10:00 AM when no specific drop-off is written.
- "Call when ready" is a normal pickup state, but do NOT infer it if the schedule explicitly says something else.
- Grooming shorthand should be preserved as written when possible.
- capacity_type should be full, bath, two_bath_override, or unknown.
If a date, groomer, pet/client name, or note is unclear, use null and list the uncertainty.
This output is only a DRAFT and will be reviewed by a human before saving.`
    });
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/health", (req, res) => {
  res.json({ ok: true, model: MODEL, aiConfigured: Boolean(OPENAI_API_KEY) });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`GroomBook v0.7 running on http://localhost:${PORT}`));
