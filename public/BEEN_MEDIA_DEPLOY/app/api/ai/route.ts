import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const MODEL = process.env.OPENAI_AI_MODEL || "gpt-5.6-luna";
const AI_ENABLED = process.env.ENABLE_AI === "true" || process.env.NEXT_PUBLIC_ENABLE_AI === "true";
const MAX_INPUT = 24000;

function sameOrigin(req: NextRequest) {
  const origin = req.headers.get("origin");
  if (!origin) return true;
  try {
    const u = new URL(origin);
    return u.host === req.headers.get("host");
  } catch { return false; }
}

function outputText(data: any) {
  if (typeof data?.output_text === "string") return data.output_text;
  const parts: string[] = [];
  for (const item of data?.output || []) {
    for (const c of item?.content || []) {
      if (typeof c?.text === "string") parts.push(c.text);
    }
  }
  return parts.join("\n").trim();
}

async function callOpenAI(input: string) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("AI_NOT_CONFIGURED");
  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model: MODEL, input }),
    cache: "no-store",
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || "OpenAI API error");
  return outputText(data);
}

export async function GET() {
  return NextResponse.json({ enabled: AI_ENABLED, configured: AI_ENABLED && Boolean(process.env.OPENAI_API_KEY), model: MODEL });
}

export async function POST(req: NextRequest) {
  try {
    if (!AI_ENABLED) return NextResponse.json({ error: "AI đang tạm tắt. Có thể bật lại sau trong biến môi trường.", code: "AI_DISABLED" }, { status: 503 });
    if (!sameOrigin(req)) return NextResponse.json({ error: "Yêu cầu không hợp lệ." }, { status: 403 });
    const body = await req.json();
    const mode = String(body?.mode || "");
    if (mode === "parse_job") {
      const message = String(body?.message || "").slice(0, 8000);
      const employees = Array.isArray(body?.employees) ? body.employees.slice(0, 150) : [];
      if (!message.trim()) return NextResponse.json({ error: "Chưa có nội dung khách gửi." }, { status: 400 });
      const prompt = `Bạn là trợ lý nhập lịch cho BEEN MEDIA tại Việt Nam. Hãy đọc tin nhắn khách và trích xuất dữ liệu Job.\n\nDanh sách nhân sự hiện có (dùng đúng tên nếu khách chỉ định):\n${JSON.stringify(employees)}\n\nTin nhắn khách:\n${message}\n\nChỉ trả về DUY NHẤT JSON hợp lệ, không markdown, theo mẫu:\n{"customer_name":"","phone":"","secondary_phone":"","event_name":"","service":"Combo VIP","booking_date":"YYYY-MM-DD","shooting_date":"YYYY-MM-DD","start_time":"HH:MM","end_time":"HH:MM","location_name":"Nhà trai|Nhà gái|Địa điểm","address":"","location_phone":"","total_price":0,"deposit":0,"note":"","assignments":[{"role":"Thợ chụp|Thợ quay|Flycam|Editor","employee_name":"","client_requested":false,"salary_amount":0,"note":""}]}\nQuy tắc: không bịa dữ liệu không có; số tiền là số nguyên VND; ngày phải YYYY-MM-DD, giờ HH:MM; nếu chỉ có ngày/tháng mà không rõ năm thì dùng năm hiện tại; nếu khách nói đích danh/chỉ định một thợ thì client_requested=true; nếu không biết tiền công thợ thì salary_amount=0.`;
      const text = await callOpenAI(prompt);
      let parsed: any;
      try { parsed = JSON.parse(text.replace(/^```json\s*/i, "").replace(/```$/i, "").trim()); }
      catch { return NextResponse.json({ error: "AI trả dữ liệu chưa đúng định dạng. Hãy thử lại.", raw: text }, { status: 502 }); }
      return NextResponse.json({ data: parsed, model: MODEL });
    }

    if (mode === "ask") {
      const question = String(body?.question || "").slice(0, 4000);
      const context = JSON.stringify(body?.context || {}).slice(0, MAX_INPUT);
      if (!question.trim()) return NextResponse.json({ error: "Chưa nhập câu hỏi." }, { status: 400 });
      const prompt = `Bạn là trợ lý quản lý nội bộ BEEN MEDIA. Trả lời bằng tiếng Việt, ngắn gọn, rõ ràng và chỉ dựa trên dữ liệu ERP được cung cấp. Nếu dữ liệu không đủ thì nói rõ không đủ, không đoán. Với tiền dùng dấu chấm phân cách hàng nghìn và thêm đ. Với ngày dùng dd/mm/yyyy.\n\nDỮ LIỆU ERP:\n${context}\n\nCÂU HỎI:\n${question}`;
      const answer = await callOpenAI(prompt);
      return NextResponse.json({ answer, model: MODEL });
    }

    return NextResponse.json({ error: "Chế độ AI không hợp lệ." }, { status: 400 });
  } catch (e: any) {
    if (e?.message === "AI_NOT_CONFIGURED") {
      return NextResponse.json({ error: "Chưa cấu hình OPENAI_API_KEY trên máy chủ.", code: "AI_NOT_CONFIGURED" }, { status: 503 });
    }
    return NextResponse.json({ error: e?.message || "Không gọi được AI." }, { status: 500 });
  }
}
